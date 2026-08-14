import type { CotizacionGuardada, InvoiceData } from "../types";

const STORAGE_KEY = "positivogroup:cotizacionesGuardadas";

export function listarCotizaciones(): CotizacionGuardada[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CotizacionGuardada[];
    return parsed.sort((a, b) => b.guardadoEn.localeCompare(a.guardadoEn));
  } catch {
    return [];
  }
}

export function guardarCotizacion(data: InvoiceData): CotizacionGuardada[] {
  const existentes = listarCotizaciones().filter(
    (c) => c.data.numeroFactura !== data.numeroFactura,
  );
  const nueva: CotizacionGuardada = {
    guardadoEn: new Date().toISOString(),
    data,
  };
  const actualizadas = [nueva, ...existentes];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizadas));
  } catch {
    // localStorage no disponible: la cotización no persiste entre sesiones
  }
  return actualizadas.sort((a, b) => b.guardadoEn.localeCompare(a.guardadoEn));
}

export function eliminarCotizacion(numeroFactura: string): CotizacionGuardada[] {
  const actualizadas = listarCotizaciones().filter(
    (c) => c.data.numeroFactura !== numeroFactura,
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizadas));
  } catch {
    // localStorage no disponible
  }
  return actualizadas;
}
