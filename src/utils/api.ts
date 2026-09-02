/**
 * Cliente del backend del sistema (funciones serverless en Netlify).
 *
 * La sesión viaja en una cookie HttpOnly que pone el servidor: el navegador la
 * envía sola en cada petición y este código no puede leerla ni copiarla, que
 * es justamente lo que la protege.
 */

/**
 * No hay sesión válida: hay que iniciar sesión otra vez.
 *
 * Lleva el cuerpo de la respuesta porque el backend cuenta algo en ese mismo
 * 401: si el sistema todavía no tiene ninguna cuenta.
 */
export class SinSesion extends Error {
  datos: unknown;

  constructor(mensaje: string, datos: unknown = null) {
    super(mensaje);
    this.datos = datos;
  }
}

/** El backend no respondió o respondió mal. */
export class BackendNoDisponible extends Error {}

interface OpcionesPeticion {
  metodo?: "GET" | "POST" | "PUT" | "DELETE";
  cuerpo?: unknown;
}

export async function pedir<T>(
  ruta: string,
  { metodo = "GET", cuerpo }: OpcionesPeticion = {},
): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      // La aplicación y la API comparten origen, así que la cookie viaja sola.
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(cuerpo === undefined ? {} : { "content-type": "application/json" }),
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
    throw new SinSesion("Sesión no válida", datos);
  }

  if (!respuesta.ok) {
    const cuerpoError = datos as { mensaje?: string; error?: string };
    throw new ErrorApi(
      cuerpoError.mensaje ?? cuerpoError.error ?? `HTTP ${respuesta.status}`,
      cuerpoError.error ?? "",
      respuesta.status,
    );
  }

  return datos as T;
}

/** Error del backend que conserva el código, para traducirlo en pantalla. */
export class ErrorApi extends Error {
  codigo: string;
  status: number;

  constructor(mensaje: string, codigo: string, status: number) {
    super(mensaje);
    this.codigo = codigo;
    this.status = status;
  }
}
