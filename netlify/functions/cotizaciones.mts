import { json, quienPide } from "../lib/acceso.mts";
import { randomBytes } from "node:crypto";
import {
  buscarUsuario,
  esAdmin,
  listarUsuarios,
  normalizarEmail,
  type Usuario,
} from "../lib/auth.mts";
import {
  almacenCotizaciones,
  almacenEnlaces,
  claveCotizacion,
  leerTodo,
} from "../lib/almacen.mts";

/**
 * Cotizaciones guardadas.
 *
 *   GET    /api/cotizaciones                     -> listado
 *   GET    /api/cotizaciones/equipo               -> nombre y correo del equipo, para reasignar
 *   POST   /api/cotizaciones                      -> guarda o reemplaza una
 *   POST   /api/cotizaciones/enlace                -> enlace público para el cliente
 *   POST   /api/cotizaciones/PG 0001/26/reasignar -> le pasa el acceso a otra persona
 *   DELETE /api/cotizaciones/PG 0001/26           -> elimina una
 *
 * Quién ve qué se decide aquí y no en el navegador: un administrador ve las de
 * todo el equipo, una cuenta básica solo las que tiene asignadas (las que creó
 * y no ha reasignado, o las que le reasignaron a ella). Cada cotización guarda
 * quién la creó, y ese dato no se toma del cuerpo de la petición sino de la
 * sesión, para que nadie pueda atribuirse las de otro.
 *
 * Reasignar NUNCA cambia quién la creó — ese dato es permanente, se muestra
 * como autor en el listado y en la cotización, y esta ruta no lo toca. Lo que
 * hace es TRASLADAR el acceso al nuevo dueño: a partir de ahí quien la creó ya
 * no la ve, solo la persona a la que se le pasó (o un administrador, que
 * siempre puede). Lo puede hacer un administrador, o quien tenga el acceso en
 * ese momento, para pasárselo a otra persona del equipo.
 */

/** Un movimiento en la vida de la cotización, para el timeline del historial. */
interface HistorialEntrada {
  fecha: string;
  accion: "creada" | "editada" | "reasignada";
  quien: string;
  nuevoDueno?: string;
}

interface CotizacionGuardada {
  guardadoEn: string;
  /** Quién la creó. Es un dato fijo para mostrar; no decide quién la ve. */
  creadoPor?: string;
  /** A quién se le pasó el acceso. Mientras esté puesto, manda sobre creadoPor. */
  reasignadoA?: string;
  /** Creación, ediciones y reasignaciones, en orden. */
  historial?: HistorialEntrada[];
  data: { numeroFactura?: unknown };
}

function esCotizacion(valor: unknown): valor is CotizacionGuardada {
  if (typeof valor !== "object" || valor === null) return false;
  const posible = valor as CotizacionGuardada;
  return (
    typeof posible.data === "object" &&
    posible.data !== null &&
    typeof posible.data.numeroFactura === "string" &&
    posible.data.numeroFactura.trim() !== ""
  );
}

/**
 * Quién la ve y la puede tocar ahora mismo: si se reasignó, es la persona a
 * la que se le dio — no las dos a la vez. Reasignar traslada el acceso, no lo
 * comparte; quien la creó deja de verla igual que si nunca hubiera sido suya.
 *
 * "creadoPor" no entra aquí después de una reasignación: eso es solo el dato
 * que se muestra como autor, y es aparte de quién puede verla.
 */
function duenoActual(cotizacion: CotizacionGuardada): string {
  return normalizarEmail(cotizacion.reasignadoA || cotizacion.creadoPor || "");
}

/**
 * ¿Puede esta persona ver o tocar esta cotización?
 *
 * Las cotizaciones guardadas antes de que existieran los roles no tienen autor.
 * Se tratan como del administrador: nadie las pierde, pero tampoco aparecen en
 * el listado de una cuenta básica que no las creó ni le hayan reasignado.
 */
function esSuya(cotizacion: CotizacionGuardada, quien: Usuario): boolean {
  if (esAdmin(quien)) return true;
  return duenoActual(cotizacion) === quien.email;
}

export default async (req: Request) => {
  const quien = await quienPide(req);
  if (!quien) return json({ error: "sin_sesion" }, 401);

  const almacen = almacenCotizaciones();
  const url = new URL(req.url);
  // Lo que venga después de /api/cotizaciones/ es el número, que puede traer
  // espacios y una barra ("PG 0001/26").
  const resto = decodeURIComponent(
    url.pathname.replace(/^.*?\/cotizaciones\/?/, ""),
  );

  try {
    // --- Con quién se puede compartir una cotización ---
    //
    // Nombre, apellidos, teléfono, cargo y correo: lo que hace falta para elegir a
    // quién reasignar y para armar la firma de quien creó la cotización en el
    // documento, no la lista completa de cuentas que ve Usuarios.
    if (req.method === "GET" && resto === "equipo") {
      const cuentas = await listarUsuarios();
      return json({
        equipo: cuentas.map((u) => ({
          email: u.email,
          nombre: u.nombre,
          apellidos: u.apellidos ?? "",
          telefono: u.telefono ?? "",
          cargo: u.cargo ?? "",
        })),
      });
    }

    if (req.method === "GET") {
      const todas = await leerTodo<CotizacionGuardada>(almacen);
      const cotizaciones = todas.filter((c) => esSuya(c, quien));
      cotizaciones.sort((a, b) => b.guardadoEn.localeCompare(a.guardadoEn));
      return json({ cotizaciones });
    }

    // --- Reasignar: traslada el acceso, sin tocar quién la creó ---
    if (req.method === "POST" && resto.endsWith("/reasignar")) {
      const numero = resto.replace(/\/reasignar$/, "");
      const guardada = (await almacen.get(claveCotizacion(numero), {
        type: "json",
      })) as CotizacionGuardada | null;

      if (!guardada) return json({ error: "cotizacion_no_existe" }, 404);
      if (!esSuya(guardada, quien)) {
        return json({ error: "cotizacion_de_otra_persona" }, 403);
      }

      const cuerpo = (await req.json().catch(() => ({}))) as {
        nuevoDueno?: unknown;
      };
      const texto = String(cuerpo.nuevoDueno ?? "").trim();

      // Vacío quita la reasignación: vuelve a verla solo quien la creó (y un
      // administrador, que siempre puede).
      if (texto === "") {
        const { reasignadoA: _quitado, ...resto } = guardada;
        const registro: CotizacionGuardada = {
          ...resto,
          historial: [
            ...(guardada.historial ?? []),
            {
              fecha: new Date().toISOString(),
              accion: "reasignada",
              quien: quien.email,
              nuevoDueno: "",
            },
          ],
        };
        await almacen.setJSON(claveCotizacion(numero), registro);
        return json({ cotizacion: registro });
      }

      const nuevoDueno = normalizarEmail(texto);
      const cuenta = await buscarUsuario(nuevoDueno);
      if (!cuenta) return json({ error: "usuario_no_existe" }, 404);

      const registro: CotizacionGuardada = {
        ...guardada,
        reasignadoA: nuevoDueno,
        historial: [
          ...(guardada.historial ?? []),
          {
            fecha: new Date().toISOString(),
            accion: "reasignada",
            quien: quien.email,
            nuevoDueno,
          },
        ],
      };

      await almacen.setJSON(claveCotizacion(numero), registro);
      return json({ cotizacion: registro });
    }

    // --- Enlace público para mandarle al cliente ---
    if (req.method === "POST" && resto === "enlace") {
      const cuerpo = (await req.json().catch(() => ({}))) as {
        numeroFactura?: unknown;
      };
      const numero = String(cuerpo.numeroFactura ?? "").trim();
      if (numero === "") return json({ error: "falta_numero" }, 400);

      const guardada = (await almacen.get(claveCotizacion(numero), {
        type: "json",
      })) as (CotizacionGuardada & { enlace?: string }) | null;

      if (!guardada) return json({ error: "cotizacion_no_existe" }, 404);
      // El mismo 404 que si no existiera: quien no la creó no tiene por qué
      // saber siquiera que ese número está usado.
      if (!esSuya(guardada, quien)) {
        return json({ error: "cotizacion_no_existe" }, 404);
      }

      // El enlace se reutiliza: pedirlo dos veces no invalida el que ya se le
      // mandó al cliente.
      if (guardada.enlace) return json({ testigo: guardada.enlace });

      const testigo = randomBytes(32).toString("base64url");
      await almacenEnlaces().setJSON(testigo, {
        numeroFactura: numero,
        creadoEn: new Date().toISOString(),
      });
      await almacen.setJSON(claveCotizacion(numero), {
        ...guardada,
        enlace: testigo,
      });

      return json({ testigo });
    }

    if (req.method === "POST") {
      const cuerpo = await req.json();
      if (!esCotizacion(cuerpo)) {
        return json({ error: "cotizacion_invalida" }, 400);
      }

      const numero = String(cuerpo.data.numeroFactura);

      // Si ya tenía enlace público, se conserva: el cliente puede haberlo
      // recibido y debe seguir viendo la versión al día.
      const previa = (await almacen.get(claveCotizacion(numero), {
        type: "json",
      })) as (CotizacionGuardada & { enlace?: string }) | null;

      if (previa && !esSuya(previa, quien)) {
        return json({ error: "cotizacion_de_otra_persona" }, 403);
      }

      const registro: CotizacionGuardada = {
        ...cuerpo,
        ...(previa?.enlace ? { enlace: previa.enlace } : {}),
        // El autor se conserva al reeditar y, si es nueva, es quien la guarda.
        // Sale de la sesión y no del cuerpo, para que nadie firme por otro.
        creadoPor: previa?.creadoPor ?? quien.email,
        // La reasignación también se conserva: guardar cambios no es
        // reasignar, así que no debe quitarle el acceso a quien se lo dieron.
        ...(previa?.reasignadoA ? { reasignadoA: previa.reasignadoA } : {}),
        guardadoEn: new Date().toISOString(),
        historial: [
          ...(previa?.historial ?? []),
          {
            fecha: new Date().toISOString(),
            accion: previa ? "editada" : "creada",
            quien: quien.email,
          },
        ],
      };

      await almacen.setJSON(claveCotizacion(numero), registro);
      return json({ cotizacion: registro });
    }

    if (req.method === "DELETE") {
      if (resto.trim() === "") return json({ error: "falta_numero" }, 400);

      const guardada = (await almacen.get(claveCotizacion(resto), {
        type: "json",
      })) as CotizacionGuardada | null;

      if (guardada && !esSuya(guardada, quien)) {
        return json({ error: "cotizacion_de_otra_persona" }, 403);
      }

      await almacen.delete(claveCotizacion(resto));
      return json({ eliminada: resto });
    }

    return json({ error: "metodo_no_permitido", metodo: req.method }, 405);
  } catch (err) {
    return json(
      {
        error: "fallo_almacenamiento",
        detalle: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
};
