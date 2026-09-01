import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

import auth from "../netlify/functions/auth.mts";
import admin from "../netlify/functions/admin.mts";
import clientify from "../netlify/functions/clientify.mts";
import cotizaciones from "../netlify/functions/cotizaciones.mts";
import numero from "../netlify/functions/numero.mts";
import productos from "../netlify/functions/productos.mts";
import publico from "../netlify/functions/publico.mts";

/**
 * Servidor propio, para alojar el sistema fuera de Netlify.
 *
 * Las funciones del backend se escribieron con Request y Response, que son
 * estándar del lenguaje y no de Netlify, así que aquí se reutilizan tal cual:
 * este archivo solo traduce entre el servidor HTTP de Node y esos objetos, y
 * sirve los archivos del frontend.
 *
 * Variables de entorno que necesita:
 *   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME   la base de datos MySQL
 *   APP_ACCESS_CODE                          código para registrarse
 *   CLIENTIFY_API_TOKEN                      token del CRM
 *   ADMIN_EMAILS                             (opcional) administradores
 *   PORT                                     (opcional) puerto, por defecto 3000
 */

type Manejador = (req: Request) => Promise<Response>;

// Mismo mapa que los redirects de netlify.toml, en el mismo orden.
const RUTAS: { prefijo: string; manejador: Manejador }[] = [
  { prefijo: "/api/auth/", manejador: auth },
  { prefijo: "/api/admin/", manejador: admin },
  { prefijo: "/api/clientify/", manejador: clientify },
  { prefijo: "/api/publico/", manejador: publico },
  { prefijo: "/api/cotizaciones", manejador: cotizaciones },
  { prefijo: "/api/productos", manejador: productos },
  { prefijo: "/api/numero", manejador: numero },
];

const RAIZ_ESTATICOS = resolve(process.env.DIST_DIR ?? "dist");
const PUERTO = Number(process.env.PORT ?? 3000);

const TIPOS: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
};

/** Convierte la petición de Node en un Request estándar. */
async function comoRequest(req: IncomingMessage): Promise<Request> {
  // Detrás del proxy de Hostinger la petición llega por HTTP; el esquema real
  // lo dice la cabecera que pone el proxy.
  const protocolo =
    (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `${protocolo}://${host}`);

  const cabeceras = new Headers();
  for (const [nombre, valor] of Object.entries(req.headers)) {
    if (typeof valor === "string") cabeceras.set(nombre, valor);
    else if (Array.isArray(valor)) cabeceras.set(nombre, valor.join(", "));
  }

  const sinCuerpo = req.method === "GET" || req.method === "HEAD";
  let cuerpo: string | undefined;

  if (!sinCuerpo) {
    const trozos: Buffer[] = [];
    for await (const trozo of req) trozos.push(trozo as Buffer);
    cuerpo = Buffer.concat(trozos).toString("utf8");
  }

  return new Request(url, {
    method: req.method,
    headers: cabeceras,
    body: cuerpo,
  });
}

async function responder(res: ServerResponse, respuesta: Response) {
  const cabeceras: Record<string, string | string[]> = {};

  respuesta.headers.forEach((valor, nombre) => {
    cabeceras[nombre] = valor;
  });

  // Set-Cookie puede venir repetida y Headers la junta con comas, lo que
  // rompería la cookie. getSetCookie las devuelve separadas.
  const cookies = respuesta.headers.getSetCookie?.() ?? [];
  if (cookies.length > 0) cabeceras["set-cookie"] = cookies;

  res.writeHead(respuesta.status, cabeceras);
  res.end(Buffer.from(await respuesta.arrayBuffer()));
}

/**
 * Deshace el %XX de la dirección. Un archivo con tildes o espacios en el
 * nombre llega pedido como "Logo-Cotizaci%C3%B3n.png", y sin esto se buscaría
 * en el disco un archivo llamado literalmente así.
 *
 * Si viene mal formado se deja tal cual: no encontrará nada, que es lo
 * correcto, en vez de reventar la petición.
 */
function decodificar(ruta: string): string {
  try {
    return decodeURIComponent(ruta);
  } catch {
    return ruta;
  }
}

/** Sirve un archivo de dist/, o devuelve false si no existe. */
function servirArchivo(ruta: string, res: ServerResponse): boolean {
  // normalize + startsWith evita que "../../etc/passwd" salga de dist/. Se
  // descodifica antes de normalizar, para que un "..%2f" tampoco se escape.
  const destino = join(RAIZ_ESTATICOS, normalize(decodificar(ruta)));
  if (!destino.startsWith(RAIZ_ESTATICOS)) return false;
  if (!existsSync(destino) || !statSync(destino).isFile()) return false;

  const extension = extname(destino);
  const esAssetConHash = destino.startsWith(join(RAIZ_ESTATICOS, "assets"));

  res.writeHead(200, {
    "content-type": TIPOS[extension] ?? "application/octet-stream",
    // Los assets llevan un hash en el nombre y cambian de nombre en cada
    // compilación; el index.html nunca se cachea, para que una versión nueva
    // se vea al recargar.
    "cache-control": esAssetConHash
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate",
  });

  createReadStream(destino).pipe(res);
  return true;
}

const servidor = createServer(async (req, res) => {
  const ruta = new URL(req.url ?? "/", "http://local").pathname;

  try {
    const entrada = RUTAS.find((r) => ruta.startsWith(r.prefijo));
    if (entrada) {
      const respuesta = await entrada.manejador(await comoRequest(req));
      await responder(res, respuesta);
      return;
    }

    if (ruta !== "/" && servirArchivo(ruta, res)) return;

    // Cualquier otra dirección la resuelve la aplicación en el navegador
    // (incluidos los enlaces públicos /c/<testigo>).
    if (servirArchivo("index.html", res)) return;

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("No encontrado");
  } catch (error) {
    console.error("Error atendiendo", ruta, error);
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "fallo_interno" }));
  }
});

servidor.listen(PUERTO, () => {
  console.log(`Sistema de cotizaciones escuchando en el puerto ${PUERTO}`);
  console.log(`Frontend servido desde ${RAIZ_ESTATICOS}`);
  if (process.env.DB_HOST) {
    console.log(`Base de datos MySQL en ${process.env.DB_HOST}`);
  } else if (process.env.SQLITE_FILE) {
    console.log(`Base de datos SQLite en ${process.env.SQLITE_FILE}`);
  } else {
    console.log(
      "AVISO: sin DB_HOST ni SQLITE_FILE definidos, intentará usar Netlify Blobs",
    );
  }
});
