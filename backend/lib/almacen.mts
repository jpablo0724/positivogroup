import { getStore } from "./store.mts";

/**
 * Almacenamiento compartido del sistema, sobre SQL (MySQL o SQLite, según
 * decida `store.mts`). Cada cotización y cada producto es un registro JSON
 * dentro de su almacén.
 */

/** Un producto del catálogo, venga del catálogo inicial o creado a mano. */
export interface Producto {
  nombre: string;
  descripcion: string;
  observaciones: string;
  /**
   * Posición en la lista. Va de diez en diez para poder intercalar productos
   * nuevos entre dos existentes sin renumerar todo.
   */
  orden: number;
}

export function almacenCotizaciones() {
  return getStore({ name: "cotizaciones", consistency: "strong" });
}

export function almacenProductos() {
  return getStore({ name: "productos", consistency: "strong" });
}

/**
 * Estado interno del sistema: el contador de la numeración y la marca de que
 * el catálogo inicial ya se copió a la base de datos.
 */
export function almacenContadores() {
  return getStore({ name: "contadores", consistency: "strong" });
}

export const CLAVE_CATALOGO_SEMBRADO = "catalogo_sembrado";

/**
 * Enlaces públicos: testigo al azar -> número de cotización. Es lo que permite
 * que el cliente vea su cotización sin tener cuenta, y que un enlace no deje
 * ver ninguna otra.
 */
export function almacenEnlaces() {
  return getStore({ name: "enlaces", consistency: "strong" });
}

/**
 * Archivos adjuntados al marcar el estado de una cotización: testigo al azar
 * -> {nombre, tipo, datos en base64, numeroFactura}. Guardarlos aparte de la
 * cotización (en vez de dentro de su JSON) es lo que permite servirlos por
 * una URL propia y clicable desde la nota de Clientify.
 */
export function almacenAdjuntos() {
  return getStore({ name: "adjuntos", consistency: "strong" });
}

/**
 * Clave legible para un número de cotización: "PG 0001/26" → "pg-0001-26".
 * El formato lo genera el propio sistema, así que dos números distintos nunca
 * caen en la misma clave.
 */
export function claveCotizacion(numero: string): string {
  return numero
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Clave para un nombre de producto. Se codifica en base64url porque los
 * nombres los escribe el usuario y un "slug" podría juntar dos nombres
 * distintos en la misma clave.
 */
export function claveProducto(nombre: string): string {
  return Buffer.from(nombre.trim(), "utf8").toString("base64url");
}

/**
 * Cambia un correo por otro en todas las cotizaciones: autor (creadoPor),
 * a quién se reasignó y el historial. Se usa cuando alguien cambia el correo
 * de su cuenta, para que siga viendo sus cotizaciones y siga firmándolas.
 * Devuelve cuántas se tocaron.
 */
export async function reemplazarCorreoEnCotizaciones(
  viejo: string,
  nuevo: string,
): Promise<number> {
  const almacen = almacenCotizaciones();
  const mismo = (valor: unknown) =>
    typeof valor === "string" && valor.trim().toLowerCase() === viejo;

  const { blobs } = await almacen.list();
  const tocadas = await Promise.all(
    blobs.map(async (blob) => {
      const registro = (await almacen.get(blob.key, { type: "json" })) as
        | Record<string, unknown>
        | null;
      if (!registro) return false;

      let cambio = false;
      const copia: Record<string, unknown> = { ...registro };
      for (const campo of ["creadoPor", "reasignadoA"]) {
        if (mismo(copia[campo])) {
          copia[campo] = nuevo;
          cambio = true;
        }
      }
      if (Array.isArray(copia.historial)) {
        copia.historial = copia.historial.map((entrada: Record<string, unknown>) => {
          const nueva = { ...entrada };
          for (const campo of ["quien", "nuevoDueno"]) {
            if (mismo(nueva[campo])) {
              nueva[campo] = nuevo;
              cambio = true;
            }
          }
          return nueva;
        });
      }

      if (cambio) await almacen.setJSON(blob.key, copia);
      return cambio;
    }),
  );

  return tocadas.filter(Boolean).length;
}

/** Lee todos los registros de un almacén, en paralelo. */
export async function leerTodo<T>(
  almacen: ReturnType<typeof getStore>,
): Promise<T[]> {
  const { blobs } = await almacen.list();
  const registros = await Promise.all(
    blobs.map((blob) => almacen.get(blob.key, { type: "json" })),
  );
  return registros.filter((registro): registro is T => registro != null);
}
