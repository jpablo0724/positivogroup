import type { ProductoInfo } from "../data/productosInfo";

/**
 * Productos creados a mano desde el formulario, además de los del catálogo de
 * servicios. Se guardan en el navegador igual que las cotizaciones.
 */
export interface ProductoPersonalizado extends ProductoInfo {
  nombre: string;
}

const STORAGE_KEY = "positivogroup:productosPersonalizados";

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

export function listarProductosPersonalizados(): ProductoPersonalizado[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entrada) => ({
        nombre: texto(entrada?.nombre).trim(),
        descripcion: texto(entrada?.descripcion),
        observaciones: texto(entrada?.observaciones),
      }))
      .filter((producto) => producto.nombre !== "");
  } catch {
    return [];
  }
}

/** Guarda el producto; si el nombre ya existe, lo reemplaza. */
export function guardarProductoPersonalizado(
  producto: ProductoPersonalizado,
): ProductoPersonalizado[] {
  const nombre = producto.nombre.trim();
  const actualizados = [
    ...listarProductosPersonalizados().filter((p) => p.nombre !== nombre),
    { ...producto, nombre },
  ].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizados));
  } catch {
    // localStorage no disponible: el producto no persiste entre sesiones
  }

  return actualizados;
}

export function eliminarProductoPersonalizado(
  nombre: string,
): ProductoPersonalizado[] {
  const actualizados = listarProductosPersonalizados().filter(
    (p) => p.nombre !== nombre,
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizados));
  } catch {
    // localStorage no disponible
  }
  return actualizados;
}
