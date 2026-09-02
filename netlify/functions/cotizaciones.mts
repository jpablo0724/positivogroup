import { json, quienPide } from "../lib/acceso.mts";
import { randomBytes } from "node:crypto";
import { esAdmin, normalizarEmail, type Usuario } from "../lib/auth.mts";
import {
  almacenCotizaciones,
  almacenEnlaces,
  claveCotizacion,
  leerTodo,
} from "../lib/almacen.mts";

/**
 * Cotizaciones guardadas.
 *
 *   GET    /api/cotizaciones            -> listado
 *   POST   /api/cotizaciones            -> guarda o reemplaza una
 *   POST   /api/cotizaciones/enlace     -> enlace público para el cliente
 *   DELETE /api/cotizaciones/PG 0001/26 -> elimina una
 *
 * Quién ve qué se decide aquí y no en el navegador: un administrador ve las de
 * todo el equipo, y una cuenta básica solo las suyas. Cada cotización guarda
 * quién la creó, y ese dato no se toma del cuerpo de la petición sino de la
 * sesión, para que nadie pueda atribuirse las de otro.
 */

interface CotizacionGuardada {
  guardadoEn: string;
  creadoPor?: string;
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
 * ¿Puede esta persona ver o tocar esta cotización?
 *
 * Las cotizaciones guardadas antes de que existieran los roles no tienen autor.
 * Se tratan como del administrador: nadie las pierde, pero tampoco aparecen en
 * el listado de una cuenta básica que no las creó.
 */
function esSuya(cotizacion: CotizacionGuardada, quien: Usuario): boolean {
  if (esAdmin(quien)) return true;
  return normalizarEmail(cotizacion.creadoPor ?? "") === quien.email;
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
    if (req.method === "GET") {
      const todas = await leerTodo<CotizacionGuardada>(almacen);
      const cotizaciones = todas.filter((c) => esSuya(c, quien));
      cotizaciones.sort((a, b) => b.guardadoEn.localeCompare(a.guardadoEn));
      return json({ cotizaciones });
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
        guardadoEn: new Date().toISOString(),
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
