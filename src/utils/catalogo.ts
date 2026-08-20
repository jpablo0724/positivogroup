import { pedir } from "./api";

/**
 * Catálogo de productos, servido por el backend.
 *
 * Incluye los servicios de Positivo Group y los que se crean desde el sistema:
 * desde que el catálogo vive en la base de datos, no hay diferencia entre unos
 * y otros, todos se pueden editar y borrar.
 */
export interface Producto {
  nombre: string;
  descripcion: string;
  observaciones: string;
  orden: number;
}

export async function listarProductos(): Promise<Producto[]> {
  const { productos } = await pedir<{ productos: Producto[] }>(
    "/api/productos",
  );
  return productos;
}

/**
 * Crea el producto, o lo edita si se indica `nombreAnterior`. Al editar se
 * conserva la posición en la lista, incluso si le cambian el nombre.
 */
export async function guardarProducto(
  producto: Pick<Producto, "nombre" | "descripcion" | "observaciones">,
  nombreAnterior?: string,
): Promise<Producto[]> {
  await pedir("/api/productos", {
    metodo: "POST",
    cuerpo: {
      ...producto,
      nombre: producto.nombre.trim(),
      ...(nombreAnterior ? { nombreAnterior } : {}),
    },
  });
  return listarProductos();
}

export async function eliminarProducto(nombre: string): Promise<Producto[]> {
  await pedir(`/api/productos/${encodeURIComponent(nombre)}`, {
    metodo: "DELETE",
  });
  return listarProductos();
}
