import { json, revisarSesion } from "../lib/acceso.mts";
import {
  CLAVE_CATALOGO_SEMBRADO,
  almacenContadores,
  almacenProductos,
  claveProducto,
  leerTodo,
  type Producto,
} from "../lib/almacen.mts";
import { CATALOGO_INICIAL } from "../lib/catalogoInicial.mts";

/**
 * Catálogo de productos, completo y en la base de datos.
 *
 *   GET    /api/productos          -> listado, en orden
 *   POST   /api/productos          -> crea o edita uno
 *   DELETE /api/productos/<nombre> -> elimina uno
 *
 * Los 21 servicios de Positivo Group ya no viven en el código: se copian a la
 * base de datos la primera vez que alguien consulta el catálogo, y desde ahí
 * se editan y se borran como cualquier otro.
 */

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

/**
 * Copia el catálogo inicial la primera vez, y solo la primera vez.
 *
 * La marca es necesaria además de mirar si el almacén está vacío: sin ella,
 * borrar todos los productos haría reaparecer los 21 de fábrica. Cada producto
 * se escribe con `onlyIfNew`, así que si alguien ya creó uno con el mismo
 * nombre, el suyo manda.
 */
async function sembrarSiHaceFalta() {
  const estado = almacenContadores();
  const yaSembrado = await estado.get(CLAVE_CATALOGO_SEMBRADO, {
    type: "json",
  });
  if (yaSembrado) return;

  const almacen = almacenProductos();
  await Promise.all(
    CATALOGO_INICIAL.map((producto) =>
      almacen.setJSON(claveProducto(producto.nombre), producto, {
        onlyIfNew: true,
      }),
    ),
  );

  await estado.setJSON(CLAVE_CATALOGO_SEMBRADO, {
    sembradoEn: new Date().toISOString(),
    productos: CATALOGO_INICIAL.length,
  });
}

/** El siguiente hueco de orden, para que un producto nuevo quede al final. */
function ordenSiguiente(productos: Producto[]): number {
  const mayor = productos.reduce((max, p) => Math.max(max, p.orden ?? 0), 0);
  return mayor + 10;
}

export default async (req: Request) => {
  const sinSesion = await revisarSesion(req);
  if (sinSesion) return sinSesion;

  const almacen = almacenProductos();
  const url = new URL(req.url);
  const resto = decodeURIComponent(
    url.pathname.replace(/^.*?\/productos\/?/, ""),
  );

  try {
    await sembrarSiHaceFalta();

    if (req.method === "GET") {
      const productos = await leerTodo<Producto>(almacen);
      productos.sort(
        (a, b) =>
          (a.orden ?? 0) - (b.orden ?? 0) ||
          a.nombre.localeCompare(b.nombre, "es"),
      );
      return json({ productos });
    }

    if (req.method === "POST") {
      const cuerpo = (await req.json()) as Partial<Producto> & {
        nombreAnterior?: string;
      };

      const nombre = texto(cuerpo.nombre).trim();
      if (nombre === "") return json({ error: "falta_nombre" }, 400);

      const anterior = texto(cuerpo.nombreAnterior).trim();
      const existentes = await leerTodo<Producto>(almacen);

      // Al editar se conserva la posición; al crear, va al final.
      const previo = existentes.find(
        (p) => p.nombre === (anterior || nombre),
      );

      const producto: Producto = {
        nombre,
        descripcion: texto(cuerpo.descripcion),
        observaciones: texto(cuerpo.observaciones),
        orden:
          typeof cuerpo.orden === "number"
            ? cuerpo.orden
            : (previo?.orden ?? ordenSiguiente(existentes)),
      };

      await almacen.setJSON(claveProducto(nombre), producto);

      // Si al editar le cambiaron el nombre, la clave es otra: hay que borrar
      // el registro viejo para no dejarlo duplicado.
      if (anterior !== "" && anterior !== nombre) {
        await almacen.delete(claveProducto(anterior));
      }

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
