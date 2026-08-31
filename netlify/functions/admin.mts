import { json } from "../lib/acceso.mts";
import { getStore } from "../lib/store.mts";
import {
  MINIMO_CONTRASENA,
  NOMBRE_COOKIE,
  buscarUsuario,
  cerrarSesionesDe,
  comoPublico,
  derivarContrasena,
  eliminarUsuario,
  esAdmin,
  guardarUsuario,
  leerCookie,
  listarUsuarios,
  normalizarEmail,
  usuarioDeSesion,
} from "../lib/auth.mts";

/**
 * Administración de cuentas. Solo para quien sea administrador.
 *
 *   GET    /api/admin/usuarios          -> lista las cuentas
 *   GET    /api/admin/exportar          -> vuelca la base de datos completa
 *   POST   /api/admin/importar          -> carga un volcado en la base de datos
 *   POST   /api/admin/restablecer       -> pone una contraseña nueva a alguien
 *   DELETE /api/admin/usuarios/<correo> -> elimina una cuenta
 *
 * Tanto restablecer como eliminar cierran las sesiones abiertas de esa
 * persona. Sin eso, cambiarle la contraseña no la sacaría del sistema: su
 * sesión seguiría viva en el equipo donde la dejó abierta.
 */

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

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
  if (!esAdmin(quien)) return json({ error: "requiere_admin" }, 403);

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
