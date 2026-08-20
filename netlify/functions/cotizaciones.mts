import { json, revisarAcceso } from "../lib/acceso.mts";
import {
  almacenCotizaciones,
  claveCotizacion,
  leerTodo,
} from "../lib/almacen.mts";

/**
 * Cotizaciones guardadas, compartidas por todo el equipo.
 *
 *   GET    /api/cotizaciones            -> listado completo
 *   POST   /api/cotizaciones            -> guarda o reemplaza una
 *   DELETE /api/cotizaciones/PG 0001/26 -> elimina una
 */

interface CotizacionGuardada {
  guardadoEn: string;
  data: { numeroFactura?: unknown };
}

function esCotizacion(valor: unknown): valor is CotizacionGuardada {
  if (typeof valor !== "object" || valor === null) return false;
  const posible = valor as CotizacionGuardada;
  return (
    typeof posible.data === "object" &&
    posible.data !== null &&
    typeof posible.data.numeroFactura === "string" &&
    posible.data.numeroFactura.trim() !== ""
  );
}

export default async (req: Request) => {
  const sinAcceso = revisarAcceso(req);
  if (sinAcceso) return sinAcceso;

  const almacen = almacenCotizaciones();
  const url = new URL(req.url);
  // Lo que venga después de /api/cotizaciones/ es el número, que puede traer
  // espacios y una barra ("PG 0001/26").
  const resto = decodeURIComponent(
    url.pathname.replace(/^.*?\/cotizaciones\/?/, ""),
  );

  try {
    if (req.method === "GET") {
      const cotizaciones = await leerTodo<CotizacionGuardada>(almacen);
      cotizaciones.sort((a, b) => b.guardadoEn.localeCompare(a.guardadoEn));
      return json({ cotizaciones });
    }

    if (req.method === "POST") {
      const cuerpo = await req.json();
      if (!esCotizacion(cuerpo)) {
        return json({ error: "cotizacion_invalida" }, 400);
      }

      const numero = String(cuerpo.data.numeroFactura);
      const registro: CotizacionGuardada = {
        ...cuerpo,
        guardadoEn: new Date().toISOString(),
      };

      await almacen.setJSON(claveCotizacion(numero), registro);
      return json({ cotizacion: registro });
    }

    if (req.method === "DELETE") {
      if (resto.trim() === "") return json({ error: "falta_numero" }, 400);
      await almacen.delete(claveCotizacion(resto));
      return json({ eliminada: resto });
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
