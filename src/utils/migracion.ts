import type { CotizacionGuardada } from "../types";
import { pedir } from "./api";


/**
 * Sube al servidor lo que quedó guardado en el navegador de cada persona,
 * de cuando el sistema no tenía backend.
 *
 * Los datos locales no se borran: quedan como respaldo por si algo saliera
 * mal en la subida. Una vez subidos se marca la bandera para no repetirla.
 */

const CLAVE_COTIZACIONES = "positivogroup:cotizacionesGuardadas";
const CLAVE_PRODUCTOS = "positivogroup:productosPersonalizados";
const CLAVE_MIGRADO = "positivogroup:migradoAlServidor";

function leerLista<T>(clave: string): T[] {
  try {
    const raw = localStorage.getItem(clave);
    if (!raw) return [];
    const datos = JSON.parse(raw);
    return Array.isArray(datos) ? (datos as T[]) : [];
  } catch {
    return [];
  }
}

/** Forma de los productos guardados en el navegador antes del backend. */
interface ProductoLocal {
  nombre: string;
  descripcion: string;
  observaciones: string;
}

export interface DatosLocales {
  cotizaciones: CotizacionGuardada[];
  productos: ProductoLocal[];
}

/** Qué hay pendiente por subir, o null si no hay nada. */
export function datosLocalesPendientes(): DatosLocales | null {
  try {
    if (localStorage.getItem(CLAVE_MIGRADO)) return null;
  } catch {
    return null;
  }

  const cotizaciones = leerLista<CotizacionGuardada>(CLAVE_COTIZACIONES).filter(
    (c) => typeof c?.data?.numeroFactura === "string",
  );
  const productos = leerLista<ProductoLocal>(CLAVE_PRODUCTOS).filter(
    (p) => typeof p?.nombre === "string" && p.nombre.trim() !== "",
  );

  if (cotizaciones.length === 0 && productos.length === 0) {
    marcarMigrado();
    return null;
  }

  return { cotizaciones, productos };
}

function marcarMigrado() {
  try {
    localStorage.setItem(CLAVE_MIGRADO, new Date().toISOString());
  } catch {
    // localStorage no disponible: se volvería a ofrecer la subida
  }
}

export async function subirDatosLocales(
  datos: DatosLocales,
): Promise<{ subidas: number; productos: number }> {
  for (const cotizacion of datos.cotizaciones) {
    await pedir("/api/cotizaciones", { metodo: "POST", cuerpo: cotizacion });
  }

  for (const producto of datos.productos) {
    await pedir("/api/productos", { metodo: "POST", cuerpo: producto });
  }

  marcarMigrado();

  return {
    subidas: datos.cotizaciones.length,
    productos: datos.productos.length,
  };
}

/** Descarta los datos locales sin subirlos. */
export function omitirDatosLocales() {
  marcarMigrado();
}
