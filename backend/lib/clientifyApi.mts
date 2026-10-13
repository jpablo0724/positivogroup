/**
 * Lo mínimo para hablar con la API de Clientify (v2), compartido entre el
 * proxy general (clientify.mts) y los informes (informes.mts): la base de la
 * URL y cómo se autentica una petición. Cada archivo arma sus propias rutas y
 * su propio caché encima de esto.
 */

export const CLIENTIFY_BASE = (
  process.env.CLIENTIFY_API_BASE ?? "https://api-plus.clientify.com/v2"
).replace(/\/+$/, "");

interface OpcionesClientify {
  metodo?: "GET" | "POST";
  cuerpo?: unknown;
}

// Si Clientify no contesta en este tiempo se corta, en vez de dejar al
// usuario mirando "Buscando…" indefinidamente.
const LIMITE_ESPERA_MS = 20_000;

// Esquema que funcionó la última vez. Sin recordarlo, si el bueno fuera
// "Bearer", cada petición se haría dos veces (la primera, rechazada).
let esquemaQueFunciona: "Token" | "Bearer" = "Token";

/**
 * La v1 autentica con "Token <clave>"; si la v2 esperara "Bearer", el primer
 * intento devuelve 401 y se reintenta con el otro esquema, y se recuerda cuál
 * sirvió para las siguientes peticiones.
 */
export async function pedirAClientify(
  url: URL,
  token: string,
  { metodo = "GET", cuerpo }: OpcionesClientify = {},
): Promise<Response> {
  const opciones = (esquema: string): RequestInit => ({
    method: metodo,
    headers: {
      Authorization: `${esquema} ${token}`,
      Accept: "application/json",
      ...(cuerpo === undefined ? {} : { "content-type": "application/json" }),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(LIMITE_ESPERA_MS),
  });

  const primero = esquemaQueFunciona;
  let respuesta = await fetch(url, opciones(primero));

  if (respuesta.status === 401 || respuesta.status === 403) {
    const otro = primero === "Token" ? "Bearer" : "Token";
    respuesta = await fetch(url, opciones(otro));
    if (respuesta.ok) esquemaQueFunciona = otro;
  }

  return respuesta;
}
