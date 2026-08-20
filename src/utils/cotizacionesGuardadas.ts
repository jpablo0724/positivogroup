import type { CotizacionGuardada, InvoiceData } from "../types";
import { pedir } from "./api";

/**
 * Cotizaciones guardadas en el servidor, compartidas por todo el equipo.
 *
 * Antes vivían en el navegador de cada persona; `datosLocalesPendientes` y
 * `subirDatosLocales` (en migracion.ts) se encargan de subir las que quedaron
 * guardadas de esa época.
 */

export async function listarCotizaciones(): Promise<CotizacionGuardada[]> {
  const { cotizaciones } = await pedir<{ cotizaciones: CotizacionGuardada[] }>(
    "/api/cotizaciones",
  );
  return cotizaciones;
}

export async function guardarCotizacion(
  data: InvoiceData,
): Promise<CotizacionGuardada[]> {
  await pedir("/api/cotizaciones", {
    metodo: "POST",
    cuerpo: { guardadoEn: new Date().toISOString(), data },
  });
  return listarCotizaciones();
}

export async function eliminarCotizacion(
  numeroFactura: string,
): Promise<CotizacionGuardada[]> {
  await pedir(`/api/cotizaciones/${encodeURIComponent(numeroFactura)}`, {
    metodo: "DELETE",
  });
  return listarCotizaciones();
}
