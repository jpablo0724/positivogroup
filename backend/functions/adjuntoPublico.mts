import { almacenAdjuntos } from "../lib/almacen.mts";

/**
 * Sirve el archivo adjunto a una marca de ganada/perdida, por su testigo.
 *
 *   GET /api/adjuntos/<testigo>
 *
 * Como el enlace público de una cotización (/api/publico/<testigo>), no exige
 * sesión: lo protege que el testigo son 24 bytes al azar, imposibles de
 * adivinar o recorrer. Es lo que permite que el enlace quede pegado en la
 * nota de Clientify y se pueda abrir con un clic.
 */

interface AdjuntoGuardado {
  nombre: string;
  tipo: string;
  datos: string;
}

function noEncontrado(): Response {
  return new Response("No encontrado", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "metodo_no_permitido" }), {
      status: 405,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const url = new URL(req.url);
  const testigo = decodeURIComponent(
    url.pathname.replace(/^.*?\/adjuntos\/?/, ""),
  ).trim();

  if (!/^[A-Za-z0-9_-]{30,50}$/.test(testigo)) return noEncontrado();

  try {
    const adjunto = (await almacenAdjuntos().get(testigo, {
      type: "json",
    })) as AdjuntoGuardado | null;

    if (!adjunto) return noEncontrado();

    const bytes = Buffer.from(adjunto.datos, "base64");
    const nombre = (adjunto.nombre || "archivo").replace(/"/g, "");

    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": adjunto.tipo || "application/octet-stream",
        "content-disposition": `inline; filename="${nombre}"`,
        // El testigo es al azar y de un solo archivo: el contenido de esta
        // URL nunca cambia, así que se puede cachear para siempre.
        "cache-control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "fallo_almacenamiento" }), {
      status: 502,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};
