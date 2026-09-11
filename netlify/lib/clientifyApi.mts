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

/**
 * La v1 autentica con "Token <clave>"; si la v2 esperara "Bearer", el primer
 * intento devuelve 401 y se reintenta con el otro esquema.
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
  });

  let respuesta = await fetch(url, opciones("Token"));

  if (respuesta.status === 401 || respuesta.status === 403) {
    respuesta = await fetch(url, opciones("Bearer"));
  }

  return respuesta;
}
