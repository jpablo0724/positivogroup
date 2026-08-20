/**
 * Cliente del backend del sistema (funciones serverless en Netlify).
 *
 * Todas las peticiones llevan el código de acceso que el equipo escribe al
 * entrar. El código se guarda en este navegador para no pedirlo en cada
 * recarga; si el servidor lo rechaza, se borra y se vuelve a pedir.
 */

const CLAVE_CODIGO = "positivogroup:codigoAcceso";
const CABECERA_CODIGO = "x-codigo-acceso";

/** El código guardado no sirve: hay que volver a pedirlo. */
export class SinAcceso extends Error {}

/** El backend no respondió o respondió mal. */
export class BackendNoDisponible extends Error {}

export function leerCodigo(): string {
  try {
    return localStorage.getItem(CLAVE_CODIGO) ?? "";
  } catch {
    return "";
  }
}

export function guardarCodigo(codigo: string) {
  try {
    localStorage.setItem(CLAVE_CODIGO, codigo);
  } catch {
    // localStorage no disponible: se pedirá el código en cada recarga
  }
}

export function olvidarCodigo() {
  try {
    localStorage.removeItem(CLAVE_CODIGO);
  } catch {
    // nada que limpiar
  }
}

interface OpcionesPeticion {
  metodo?: "GET" | "POST" | "DELETE";
  cuerpo?: unknown;
  /** Código a usar en vez del guardado, para probarlo antes de guardarlo. */
  codigo?: string;
}

export async function pedir<T>(
  ruta: string,
  { metodo = "GET", cuerpo, codigo }: OpcionesPeticion = {},
): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      headers: {
        Accept: "application/json",
        [CABECERA_CODIGO]: codigo ?? leerCodigo(),
        ...(cuerpo === undefined
          ? {}
          : { "content-type": "application/json" }),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new BackendNoDisponible("No se pudo contactar el servidor");
  }

  const texto = await respuesta.text();
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    // Sin las funciones serverless, /api/... cae en el index.html de la SPA.
    throw new BackendNoDisponible("El backend no está activo todavía");
  }

  if (respuesta.status === 401) {
    throw new SinAcceso("Código de acceso incorrecto");
  }

  if (!respuesta.ok) {
    const cuerpoError = datos as { mensaje?: string; error?: string };
    throw new BackendNoDisponible(
      cuerpoError.mensaje ?? cuerpoError.error ?? `HTTP ${respuesta.status}`,
    );
  }

  return datos as T;
}

/** Comprueba un código contra el servidor sin guardarlo. */
export async function verificarCodigo(codigo: string): Promise<void> {
  await pedir("/api/numero", { codigo });
}
