import { json, revisarSesion } from "../lib/acceso.mts";
import { randomBytes } from "node:crypto";
import {
  almacenCotizaciones,
  almacenEnlaces,
  claveCotizacion,
  leerTodo,
} from "../lib/almacen.mts";

/**
 * Cotizaciones guardadas, compartidas por todo el equipo.
 *
 *   GET    /api/cotizaciones            -> listado completo
 *   POST   /api/cotizaciones            -> guarda o reemplaza una
 *   POST   /api/cotizaciones/enlace     -> enlace público para el cliente
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
  const sinSesion = await revisarSesion(req);
  if (sinSesion) return sinSesion;

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

    // --- Enlace público para mandarle al cliente ---
    if (req.method === "POST" && resto === "enlace") {
      const cuerpo = (await req.json().catch(() => ({}))) as {
        numeroFactura?: unknown;
      };
      const numero = String(cuerpo.numeroFactura ?? "").trim();
      if (numero === "") return json({ error: "falta_numero" }, 400);

      const guardada = (await almacen.get(claveCotizacion(numero), {
        type: "json",
      })) as (CotizacionGuardada & { enlace?: string }) | null;

      if (!guardada) return json({ error: "cotizacion_no_existe" }, 404);

      // El enlace se reutiliza: pedirlo dos veces no invalida el que ya se le
      // mandó al cliente.
      if (guardada.enlace) return json({ testigo: guardada.enlace });

      const testigo = randomBytes(32).toString("base64url");
      await almacenEnlaces().setJSON(testigo, {
        numeroFactura: numero,
        creadoEn: new Date().toISOString(),
      });
      await almacen.setJSON(claveCotizacion(numero), {
        ...guardada,
        enlace: testigo,
      });

      return json({ testigo });
    }

    if (req.method === "POST") {
      const cuerpo = await req.json();
      if (!esCotizacion(cuerpo)) {
        return json({ error: "cotizacion_invalida" }, 400);
      }

      const numero = String(cuerpo.data.numeroFactura);

      // Si ya tenía enlace público, se conserva: el cliente puede haberlo
      // recibido y debe seguir viendo la versión al día.
      const previa = (await almacen.get(claveCotizacion(numero), {
        type: "json",
      })) as { enlace?: string } | null;

      const registro: CotizacionGuardada = {
        ...cuerpo,
        ...(previa?.enlace ? { enlace: previa.enlace } : {}),
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
