/**
 * Proxy hacia la API de Clientify.
 *
 * El token de Clientify da acceso a todo el CRM, así que nunca puede viajar
 * al navegador: vive solo aquí, como variable de entorno del sitio en Netlify
 * (Site configuration → Environment variables → CLIENTIFY_API_TOKEN).
 *
 * La app llama a /api/clientify/<recurso> y esta función reenvía la consulta
 * a Clientify agregándole el token.
 *
 * Recursos disponibles:
 *   /api/clientify/me                    -> valida el token y devuelve la cuenta
 *   /api/clientify/companies?name=acme   -> busca empresas
 *   /api/clientify/contacts?company=123  -> busca contactos
 */

const CLIENTIFY_BASE = "https://api.clientify.net/v1";

// Solo recursos de lectura, para que el proxy no pueda usarse para modificar
// ni borrar nada en el CRM.
const RECURSOS_PERMITIDOS = new Set(["me", "companies", "contacts"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default async (req: Request) => {
  const token = process.env.CLIENTIFY_API_TOKEN;

  if (!token) {
    // Diagnóstico: se listan solo los NOMBRES de variables visibles para la
    // función (nunca sus valores), para distinguir entre "la variable no
    // llegó al despliegue" y "llegó pero vacía".
    const nombresVisibles = Object.keys(process.env)
      .filter((nombre) => /CLIENTIFY|CONTEXT|DEPLOY/i.test(nombre))
      .sort();

    return json(
      {
        error: "falta_token",
        mensaje:
          "La función no puede leer CLIENTIFY_API_TOKEN. Si la variable ya " +
          "está creada en Netlify, hay que desplegar de nuevo para que entre.",
        diagnostico: {
          variableDefinida: "CLIENTIFY_API_TOKEN" in process.env,
          contexto: process.env.CONTEXT ?? "(desconocido)",
          variablesVisibles: nombresVisibles,
        },
      },
      503,
    );
  }

  const entrante = new URL(req.url);

  // El recurso es el último segmento de la ruta, así funciona tanto en
  // /api/clientify/<recurso> como en /.netlify/functions/clientify/<recurso>.
  const segmentos = entrante.pathname.split("/").filter(Boolean);
  const recurso = segmentos[segmentos.length - 1] ?? "";

  if (!RECURSOS_PERMITIDOS.has(recurso)) {
    return json(
      {
        error: "recurso_no_permitido",
        recurso,
        ruta: entrante.pathname,
        permitidos: [...RECURSOS_PERMITIDOS],
        ejemplo: "/api/clientify/me",
      },
      400,
    );
  }

  // Se reenvían los parámetros tal cual llegan, para poder buscar por nombre,
  // paginar, filtrar por empresa, etc.
  const destino = new URL(`${CLIENTIFY_BASE}/${recurso}/`);
  entrante.searchParams.forEach((valor, clave) => {
    destino.searchParams.append(clave, valor);
  });

  try {
    const respuesta = await fetch(destino, {
      headers: {
        Authorization: `Token ${token}`,
        Accept: "application/json",
      },
    });

    const texto = await respuesta.text();

    if (!respuesta.ok) {
      return json(
        {
          error: "clientify_respondio_error",
          status: respuesta.status,
          url: destino.toString(),
          respuesta: texto.slice(0, 1000),
        },
        respuesta.status,
      );
    }

    try {
      return json(JSON.parse(texto));
    } catch {
      return json(
        {
          error: "respuesta_no_es_json",
          url: destino.toString(),
          respuesta: texto.slice(0, 1000),
        },
        502,
      );
    }
  } catch (err) {
    return json(
      {
        error: "no_se_pudo_conectar",
        detalle: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
};
