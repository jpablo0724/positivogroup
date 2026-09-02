import { json } from "../lib/acceso.mts";
import { getStore } from "../lib/store.mts";
import {
  MINIMO_CONTRASENA,
  NOMBRE_COOKIE,
  PERMISOS_BASICO,
  buscarUsuario,
  cerrarSesionesDe,
  comoPublico,
  crearUsuario,
  derivarContrasena,
  eliminarUsuario,
  esAdmin,
  guardarUsuario,
  leerCookie,
  listarUsuarios,
  normalizarEmail,
  puede,
  usuarioDeSesion,
  type Permisos,
  type Rol,
  type Usuario,
} from "../lib/auth.mts";

/**
 * Administración de cuentas.
 *
 *   GET    /api/admin/usuarios          -> lista las cuentas
 *   POST   /api/admin/usuarios          -> crea una cuenta
 *   PUT    /api/admin/usuarios/<correo> -> cambia nombre, rol y permisos
 *   DELETE /api/admin/usuarios/<correo> -> elimina una cuenta
 *   GET    /api/admin/exportar          -> vuelca la base de datos completa
 *   POST   /api/admin/importar          -> carga un volcado en la base de datos
 *   POST   /api/admin/restablecer       -> pone una contraseña nueva a alguien
 *
 * Ver la lista solo pide el permiso de usuarios; todo lo que la modifica exige
 * ser administrador. Esa separación es deliberada: si bastara el permiso de
 * ver para editar, una cuenta básica con acceso a la sección podría ascenderse
 * a sí misma.
 *
 * Tanto restablecer como eliminar cierran las sesiones abiertas de esa
 * persona. Sin eso, cambiarle la contraseña no la sacaría del sistema: su
 * sesión seguiría viva en el equipo donde la dejó abierta.
 */

function rolValido(valor: unknown): Rol {
  return valor === "admin" ? "admin" : "basico";
}

/** Solo se aceptan los tres permisos conocidos, y solo como sí o no. */
function permisosValidos(valor: unknown): Permisos {
  const dado = (valor ?? {}) as Partial<Record<keyof Permisos, unknown>>;
  return {
    cotizaciones: dado.cotizaciones === true,
    catalogo: dado.catalogo === true,
    usuarios: dado.usuarios === true,
  };
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Los almacenes que entran y salen en un respaldo.
 *
 * Las sesiones quedan fuera a propósito: son temporales y cada quien vuelve a
 * entrar con su contraseña. Que la lista sea fija también evita que un archivo
 * manipulado escriba en un almacén que no le corresponde.
 */
const ALMACENES_EXPORTABLES = [
  "cotizaciones",
  "productos",
  "contadores",
  "usuarios",
  "enlaces",
];

export default async (req: Request) => {
  const quien = await usuarioDeSesion(leerCookie(req, NOMBRE_COOKIE));
  if (!quien) return json({ error: "sin_sesion" }, 401);

  const administra = esAdmin(quien);
  const soloLeeUsuarios =
    req.method === "GET" && new URL(req.url).pathname.endsWith("/usuarios");

  // Ver la lista basta con el permiso; cambiar cualquier cosa exige el rol.
  if (!administra && !(soloLeeUsuarios && puede(quien, "usuarios"))) {
    return json({ error: "requiere_admin" }, 403);
  }

  const url = new URL(req.url);
  const segmentos = url.pathname.split("/").filter(Boolean);
  // .../admin/usuarios/<correo>  ó  .../admin/restablecer
  const indiceAdmin = segmentos.indexOf("admin");
  const recurso = segmentos[indiceAdmin + 1] ?? "";
  const objetivo = decodeURIComponent(segmentos.slice(indiceAdmin + 2).join("/"));

  try {
    // --- Volcado completo, para respaldo o para migrar a otro servidor ---
    if (recurso === "exportar" && req.method === "GET") {
      const almacenes: Record<string, Record<string, unknown>> = {};

      for (const nombre of ALMACENES_EXPORTABLES) {
        const store = getStore({ name: nombre, consistency: "strong" });
        const { blobs } = await store.list();
        const registros = await Promise.all(
          blobs.map(async (blob) => [
            blob.key,
            await store.get(blob.key, { type: "json" }),
          ]),
        );
        almacenes[nombre] = Object.fromEntries(registros);
      }

      const cuerpo = {
        exportadoEn: new Date().toISOString(),
        version: 1,
        almacenes,
      };

      // Se entrega como descarga: el volcado trae los hash de las contraseñas
      // y los datos de los clientes, así que no conviene dejarlo abierto en
      // una pestaña del navegador.
      return new Response(JSON.stringify(cuerpo, null, 2), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "content-disposition":
            'attachment; filename="positivogroup-respaldo.json"',
        },
      });
    }

    // --- Restauración de un volcado ---
    if (recurso === "importar" && req.method === "POST") {
      const cuerpo = (await req.json().catch(() => null)) as {
        almacenes?: Record<string, Record<string, unknown>>;
        reemplazar?: boolean;
      } | null;

      if (!cuerpo?.almacenes || typeof cuerpo.almacenes !== "object") {
        return json({ error: "respaldo_invalido" }, 400);
      }

      const reemplazar = cuerpo.reemplazar === true;
      const claveDeQuien = Buffer.from(quien.email, "utf8").toString(
        "base64url",
      );

      const detalle: Record<string, { escritos: number; omitidos: number }> = {};
      let escritos = 0;
      let omitidos = 0;
      const ignorados: string[] = [];

      for (const [nombre, registros] of Object.entries(cuerpo.almacenes)) {
        if (!ALMACENES_EXPORTABLES.includes(nombre)) {
          ignorados.push(nombre);
          continue;
        }
        if (!registros || typeof registros !== "object") continue;

        const store = getStore({ name: nombre, consistency: "strong" });
        const cuenta = { escritos: 0, omitidos: 0 };

        for (const [clave, valor] of Object.entries(registros)) {
          if (valor === null || valor === undefined) continue;

          // La cuenta con la que se está importando nunca se pisa: si el
          // respaldo trajera otra contraseña para ella, quien está haciendo
          // la restauración quedaría fuera del sistema a mitad de camino.
          const esLaPropia = nombre === "usuarios" && clave === claveDeQuien;

          const { modified } = await store.setJSON(
            clave,
            valor,
            reemplazar && !esLaPropia ? {} : { onlyIfNew: true },
          );

          if (modified) cuenta.escritos++;
          else cuenta.omitidos++;
        }

        detalle[nombre] = cuenta;
        escritos += cuenta.escritos;
        omitidos += cuenta.omitidos;
      }

      return json({ escritos, omitidos, detalle, ignorados, reemplazar });
    }

    if (recurso === "usuarios" && req.method === "GET") {
      const cuentas = await listarUsuarios();
      return json({ usuarios: cuentas.map(comoPublico) });
    }

    // --- Crear una cuenta ---
    if (recurso === "usuarios" && req.method === "POST") {
      const cuerpo = await req.json().catch(() => ({}));
      const correo = normalizarEmail(texto((cuerpo as never)["email"]));
      const nombre = texto((cuerpo as never)["nombre"]).trim();
      const contrasena = texto((cuerpo as never)["contrasena"]);

      if (nombre === "") return json({ error: "falta_nombre" }, 400);
      if (!EMAIL_VALIDO.test(correo)) return json({ error: "email_invalido" }, 400);
      if (contrasena.length < MINIMO_CONTRASENA) {
        return json({ error: "contrasena_corta", minimo: MINIMO_CONTRASENA }, 400);
      }

      const rol = rolValido((cuerpo as never)["rol"]);
      const { clave, sal } = await derivarContrasena(contrasena);

      const creado = await crearUsuario({
        email: correo,
        nombre,
        apellidos: texto((cuerpo as never)["apellidos"]).trim(),
        rol,
        // A un administrador no se le guardan permisos: los tiene todos por su
        // rol, y guardarlos solo crearía dos fuentes de verdad.
        ...(rol === "basico"
          ? {
              permisos: (cuerpo as never)["permisos"]
                ? permisosValidos((cuerpo as never)["permisos"])
                : { ...PERMISOS_BASICO },
            }
          : {}),
        clave,
        sal,
        creadoEn: new Date().toISOString(),
      });

      if (!creado) return json({ error: "email_ya_registrado" }, 409);
      return json({ usuario: comoPublico(creado) }, 201);
    }

    // --- Cambiar nombre, rol y permisos ---
    if (recurso === "usuarios" && req.method === "PUT") {
      const correo = normalizarEmail(objetivo);
      const cuenta = await buscarUsuario(correo);
      if (!cuenta) return json({ error: "usuario_no_existe" }, 404);

      const cuerpo = await req.json().catch(() => ({}));
      const rol = rolValido((cuerpo as never)["rol"]);

      // Quitarse a uno mismo el rol dejaría el sistema sin quien administre.
      if (correo === quien.email && rol !== "admin") {
        return json({ error: "no_puede_quitarse_admin" }, 400);
      }

      const nombre = texto((cuerpo as never)["nombre"]).trim();
      const actualizado: Usuario = {
        ...cuenta,
        nombre: nombre === "" ? cuenta.nombre : nombre,
        apellidos: texto((cuerpo as never)["apellidos"]).trim(),
        rol,
        admin: rol === "admin",
        permisos:
          rol === "basico"
            ? permisosValidos((cuerpo as never)["permisos"])
            : undefined,
      };

      await guardarUsuario(actualizado);
      return json({ usuario: comoPublico(actualizado) });
    }

    if (recurso === "usuarios" && req.method === "DELETE") {
      const correo = normalizarEmail(objetivo);
      if (correo === "") return json({ error: "falta_correo" }, 400);

      // Quitarse a uno mismo dejaría el sistema sin administrador.
      if (correo === quien.email) {
        return json({ error: "no_puede_eliminarse" }, 400);
      }

      const cuenta = await buscarUsuario(correo);
      if (!cuenta) return json({ error: "usuario_no_existe" }, 404);

      await eliminarUsuario(correo);
      await cerrarSesionesDe(correo);
      return json({ eliminado: correo });
    }

    if (recurso === "restablecer" && req.method === "POST") {
      const cuerpo = await req.json().catch(() => ({}));
      const correo = normalizarEmail(texto((cuerpo as never)["email"]));
      const nueva = texto((cuerpo as never)["contrasena"]);

      if (nueva.length < MINIMO_CONTRASENA) {
        return json(
          { error: "contrasena_corta", minimo: MINIMO_CONTRASENA },
          400,
        );
      }

      const cuenta = await buscarUsuario(correo);
      if (!cuenta) return json({ error: "usuario_no_existe" }, 404);

      const { clave, sal } = await derivarContrasena(nueva);
      await guardarUsuario({ ...cuenta, clave, sal });
      await cerrarSesionesDe(correo);

      return json({ restablecido: correo });
    }

    return json({ error: "ruta_desconocida", recurso, metodo: req.method }, 404);
  } catch (err) {
    return json(
      {
        error: "fallo_administracion",
        detalle: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
};
