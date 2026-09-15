import type {
  AdjuntoEstado,
  AdjuntoParaSubir,
  CotizacionGuardada,
  EstadoCotizacion,
  InvoiceData,
} from "../types";
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

export interface MiembroEquipo {
  email: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  cargo: string;
}

/**
 * Nombre, apellidos, teléfono, cargo y correo del equipo: para elegir a quién
 * reasignar y para armar la firma de quien creó la cotización.
 */
export async function listarEquipo(): Promise<MiembroEquipo[]> {
  const { equipo } = await pedir<{ equipo: MiembroEquipo[] }>(
    "/api/cotizaciones/equipo",
  );
  return equipo;
}

/**
 * Cambia el dueño de una cotización. No toca nada más de su contenido.
 *
 * El servidor devuelve la cotización ya actualizada, así que no hace falta
 * pedir el listado completo de nuevo: eso ahorra un viaje redondo y hace que
 * el cambio se vea al instante.
 */
export async function reasignarCotizacion(
  numeroFactura: string,
  nuevoDueno: string,
): Promise<CotizacionGuardada> {
  const { cotizacion } = await pedir<{ cotizacion: CotizacionGuardada }>(
    `/api/cotizaciones/${encodeURIComponent(numeroFactura)}/reasignar`,
    { metodo: "POST", cuerpo: { nuevoDueno } },
  );
  return cotizacion;
}

/**
 * Anota en el historial de la cotización que se mandó a Clientify.
 *
 * Se llama después de que la nota ya quedó guardada en el CRM
 * (`/api/clientify/nota`): esto no manda nada allá, solo deja el registro
 * en el timeline.
 */
/**
 * Sube UN archivo adjunto para una marca de ganada/perdida y devuelve su
 * referencia (con el testigo con el que arma su URL pública). Se sube antes
 * de marcarEstadoCotizacion: esta ruta solo guarda el archivo, no lo asocia
 * a ningún estado todavía.
 */
export async function subirAdjuntoEstado(
  numeroFactura: string,
  archivo: AdjuntoParaSubir,
): Promise<AdjuntoEstado> {
  return pedir<AdjuntoEstado>(
    `/api/cotizaciones/${encodeURIComponent(numeroFactura)}/adjuntos`,
    { metodo: "POST", cuerpo: archivo },
  );
}

/**
 * Marca la cotización como ganada o perdida. Pasar undefined quita la marca.
 */
export async function marcarEstadoCotizacion(
  numeroFactura: string,
  estado: EstadoCotizacion | undefined,
  razon?: string,
  adjuntos?: AdjuntoEstado[],
): Promise<CotizacionGuardada> {
  const { cotizacion } = await pedir<{ cotizacion: CotizacionGuardada }>(
    `/api/cotizaciones/${encodeURIComponent(numeroFactura)}/estado`,
    {
      metodo: "POST",
      cuerpo: { estado: estado ?? "", razon: razon ?? "", adjuntos: adjuntos ?? [] },
    },
  );
  return cotizacion;
}

export async function registrarEnvioClientify(
  numeroFactura: string,
): Promise<CotizacionGuardada> {
  const { cotizacion } = await pedir<{ cotizacion: CotizacionGuardada }>(
    `/api/cotizaciones/${encodeURIComponent(numeroFactura)}/enviada-clientify`,
    { metodo: "POST" },
  );
  return cotizacion;
}
