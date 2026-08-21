import { json } from "../lib/acceso.mts";
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
