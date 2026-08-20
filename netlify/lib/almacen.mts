import { getStore } from "@netlify/blobs";

/**
 * Almacenamiento compartido del sistema, sobre Netlify Blobs.
 *
 * Es el mismo sitio de Netlify donde ya está publicada la aplicación, así que
 * no hace falta otra cuenta ni otra contraseña de base de datos. Cada
 * cotización y cada producto es un registro JSON dentro de su almacén.
 *
 * "strong" obliga a que una lectura vea siempre la última escritura: sin eso
 * alguien podría guardar una cotización y no verla al recargar.
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
