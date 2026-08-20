import { NOMBRE_COOKIE, leerCookie, usuarioDeSesion } from "./auth.mts";

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
  const usuario = await usuarioDeSesion(leerCookie(req, NOMBRE_COOKIE));
  return usuario ? null : json({ error: "sin_sesion" }, 401);
}
