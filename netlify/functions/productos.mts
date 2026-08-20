import { json, revisarAcceso } from "../lib/acceso.mts";
import {
  almacenProductos,
  claveProducto,
  leerTodo,
} from "../lib/almacen.mts";

/**
 * Productos creados a mano, compartidos por todo el equipo.
 *
 *   GET    /api/productos          -> listado completo
 *   POST   /api/productos          -> crea o reemplaza uno
 *   DELETE /api/productos/<nombre> -> elimina uno
 */

interface ProductoPersonalizado {
  nombre: string;
  descripcion: string;
  observaciones: string;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

export default async (req: Request) => {
  const sinAcceso = revisarAcceso(req);
  if (sinAcceso) return sinAcceso;

  const almacen = almacenProductos();
  const url = new URL(req.url);
  const resto = decodeURIComponent(
    url.pathname.replace(/^.*?\/productos\/?/, ""),
  );

  try {
    if (req.method === "GET") {
      const productos = await leerTodo<ProductoPersonalizado>(almacen);
      productos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      return json({ productos });
    }

    if (req.method === "POST") {
      const cuerpo = await req.json();
      const nombre = texto((cuerpo as ProductoPersonalizado)?.nombre).trim();
      if (nombre === "") return json({ error: "falta_nombre" }, 400);

      const producto: ProductoPersonalizado = {
        nombre,
        descripcion: texto((cuerpo as ProductoPersonalizado)?.descripcion),
        observaciones: texto((cuerpo as ProductoPersonalizado)?.observaciones),
      };

      await almacen.setJSON(claveProducto(nombre), producto);
      return json({ producto });
    }

    if (req.method === "DELETE") {
      if (resto.trim() === "") return json({ error: "falta_nombre" }, 400);
      await almacen.delete(claveProducto(resto));
      return json({ eliminado: resto });
    }

    return json({ error: "metodo_no_permitido", metodo: req.method }, 405);
  } catch (err) {
    return json(
      {
        error: "fallo_almacenamiento",
        detalle: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
};
