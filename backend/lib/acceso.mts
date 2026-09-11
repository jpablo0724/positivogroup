import {
  NOMBRE_COOKIE,
  leerCookie,
  usuarioDeSesion,
  type Usuario,
} from "./auth.mts";

/**
 * Control de acceso del backend.
 *
 * Las cotizaciones guardan datos de clientes (razón social, NIT, correos), y
 * la API vive en una URL pública, así que cada petición tiene que venir de una
 * sesión abierta. La sesión se valida contra la cookie, no contra nada que el
 * navegador pueda inventarse.
 */

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/**
 * Devuelve una respuesta de error si quien pide no tiene sesión válida, o
 * null si puede continuar.
 */
export async function revisarSesion(req: Request): Promise<Response | null> {
  const usuario = await quienPide(req);
  return usuario ? null : json({ error: "sin_sesion" }, 401);
}

/**
 * Quién hace la petición, o null si no hay sesión.
 *
 * Lo usan las funciones que además de exigir sesión necesitan saber de quién
 * es: qué cotizaciones puede ver, si puede tocar el catálogo, etc. Sale de la
 * cookie, nunca de nada que mande el navegador en el cuerpo.
 */
export async function quienPide(req: Request): Promise<Usuario | null> {
  return usuarioDeSesion(leerCookie(req, NOMBRE_COOKIE));
}
