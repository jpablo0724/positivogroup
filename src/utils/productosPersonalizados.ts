import type { ProductoInfo } from "../data/productosInfo";
import { pedir } from "./api";

/**
 * Productos creados a mano desde el formulario, además de los del catálogo de
 * servicios. Viven en el servidor, así que los ve todo el equipo.
 */
export interface ProductoPersonalizado extends ProductoInfo {
  nombre: string;
}

export async function listarProductosPersonalizados(): Promise<
  ProductoPersonalizado[]
> {
  const { productos } = await pedir<{ productos: ProductoPersonalizado[] }>(
    "/api/productos",
  );
  return productos;
}

/** Guarda el producto; si el nombre ya existe, lo reemplaza. */
export async function guardarProductoPersonalizado(
  producto: ProductoPersonalizado,
): Promise<ProductoPersonalizado[]> {
  await pedir("/api/productos", {
    metodo: "POST",
    cuerpo: { ...producto, nombre: producto.nombre.trim() },
  });
  return listarProductosPersonalizados();
}

export async function eliminarProductoPersonalizado(
  nombre: string,
): Promise<ProductoPersonalizado[]> {
  await pedir(`/api/productos/${encodeURIComponent(nombre)}`, {
    metodo: "DELETE",
  });
  return listarProductosPersonalizados();
}
