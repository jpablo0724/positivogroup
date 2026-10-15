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

/**
 * Tipos que se pueden abrir directamente en el navegador. Ninguno puede
 * ejecutar código en la página.
 *
 * Cualquier otro tipo (Word, Excel, ZIP, y sobre todo HTML o SVG) se entrega
 * como descarga y con un tipo genérico. El tipo lo declara quien sube el
 * archivo, así que no se puede confiar en él: un "adjunto" que dijera ser
 * text/html se abriría como una página de la intranet, con la sesión de quien
 * hiciera clic, y podría actuar en su nombre (crear cuentas, sacar datos).
 */
const TIPOS_EN_LINEA = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

/** Nombre del archivo apto para la cabecera, con la versión UTF-8 aparte. */
function disposicion(modo: "inline" | "attachment", nombre: string): string {
  const ascii = nombre.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  return `${modo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
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
    const nombre = (adjunto.nombre || "archivo").replace(/[\r\n]/g, "");
    const tipo = (adjunto.tipo || "").toLowerCase().split(";")[0].trim();
    const enLinea = TIPOS_EN_LINEA.has(tipo);

    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": enLinea ? tipo : "application/octet-stream",
        "content-disposition": disposicion(
          enLinea ? "inline" : "attachment",
          nombre,
        ),
        "x-content-type-options": "nosniff",
        // Aunque el navegador intentara mostrarlo como página, no podría
        // correr scripts ni tocar la sesión. El PDF queda fuera porque el
        // visor de Chrome no abre dentro de un "sandbox".
        ...(tipo === "application/pdf"
          ? {}
          : { "content-security-policy": "sandbox; default-src 'none'; img-src 'self'" }),
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
