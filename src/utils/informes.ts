import { pedir } from "./api";

/**
 * Embudo de leads de Clientify: lo que trae /api/informes/contactos, con cada
 * contacto ya clasificado por el servidor (origen, calificación, estado
 * general y estado de gestión). Aquí solo se filtra y se cuenta.
 */

export interface ContactoInforme {
  id: number;
  nombre: string;
  empresa: string;
  comercial: string;
  /** "AAAA-MM-DD", hora de Colombia. */
  creado: string;
  calificacion: string;
  estadoGeneral: string;
  estadoGestion: string;
  origenes: string[];
  comoConocio: string[];
}

export interface OpcionCatalogo {
  clave: string;
  nombre: string;
}

export interface OrigenCatalogo extends OpcionCatalogo {
  grupo: string;
  nota?: string;
}

export interface SubestadoCatalogo {
  valor: string;
  estado: string;
  nombre: string;
}

export interface CatalogosInforme {
  origenes: OrigenCatalogo[];
  comoConocio: { valor: string; nombre: string }[];
  calificaciones: OpcionCatalogo[];
  estadosGenerales: OpcionCatalogo[];
  subestados: SubestadoCatalogo[];
  comerciales: string[];
}

export interface DatosInforme {
  contactos: ContactoInforme[];
  catalogos: CatalogosInforme;
  actualizadoEn: string;
}

export interface Conversion {
  id: number;
  aplicaEn: string;
  aplicaEstimado: boolean;
  clienteEn: string;
}

export async function obtenerInformeContactos(): Promise<DatosInforme> {
  return pedir<DatosInforme>("/api/informes/contactos");
}

export async function obtenerConversiones(): Promise<Conversion[]> {
  const datos = await pedir<{ conversiones: Conversion[] }>("/api/informes/conversion");
  return datos.conversiones;
}

// --- Período -----------------------------------------------------------------

export type Periodo =
  | "este-mes"
  | "mes-pasado"
  | "ultimos-30"
  | "este-trimestre"
  | "trimestre-pasado"
  | "este-ano"
  | "historico"
  | "personalizado";

export const PERIODOS: { clave: Periodo; nombre: string }[] = [
  { clave: "este-mes", nombre: "Este mes" },
  { clave: "mes-pasado", nombre: "Mes pasado" },
  { clave: "ultimos-30", nombre: "Últimos 30 días" },
  { clave: "este-trimestre", nombre: "Este trimestre" },
  { clave: "trimestre-pasado", nombre: "Trimestre pasado" },
  { clave: "este-ano", nombre: "Este año" },
  { clave: "historico", nombre: "Histórico total" },
  { clave: "personalizado", nombre: "Personalizado…" },
];

function aTexto(fecha: Date): string {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${a}-${m}-${d}`;
}

/**
 * Rango de fechas ("AAAA-MM-DD", ambos incluidos) de un período. "" en un
 * extremo significa sin límite.
 */
export function rangoDePeriodo(periodo: Periodo, hoy = new Date()): { desde: string; hasta: string } {
  const a = hoy.getFullYear();
  const m = hoy.getMonth();
  const trimestre = Math.floor(m / 3) * 3;
  switch (periodo) {
    case "este-mes":
      return { desde: aTexto(new Date(a, m, 1)), hasta: aTexto(hoy) };
    case "mes-pasado":
      return { desde: aTexto(new Date(a, m - 1, 1)), hasta: aTexto(new Date(a, m, 0)) };
    case "ultimos-30":
      return { desde: aTexto(new Date(a, m, hoy.getDate() - 29)), hasta: aTexto(hoy) };
    case "este-trimestre":
      return { desde: aTexto(new Date(a, trimestre, 1)), hasta: aTexto(hoy) };
    case "trimestre-pasado":
      return {
        desde: aTexto(new Date(a, trimestre - 3, 1)),
        hasta: aTexto(new Date(a, trimestre, 0)),
      };
    case "este-ano":
      return { desde: aTexto(new Date(a, 0, 1)), hasta: aTexto(hoy) };
    default:
      return { desde: "", hasta: "" };
  }
}

// --- Filtros -------------------------------------------------------------------

/** Valores especiales del filtro de origen, además de una campaña o un grupo. */
export const ORIGEN_IDENTIFICADO = "__identificado__";
export const ORIGEN_NINGUNO = "__ninguno__";
export const ORIGEN_TODOS = "__todos__";

export interface FiltrosInforme {
  desde: string;
  hasta: string;
  comercial: string;
  /** Clave de origen, "grupo:<nombre>", "conocio:<valor>" o uno de los ORIGEN_*. */
  origen: string;
}

export function tieneOrigen(c: ContactoInforme): boolean {
  return c.origenes.length > 0 || c.comoConocio.length > 0;
}

export function aplicarFiltros(
  contactos: ContactoInforme[],
  filtros: FiltrosInforme,
  catalogos: CatalogosInforme,
): ContactoInforme[] {
  const { desde, hasta, comercial, origen } = filtros;
  let pasaOrigen: (c: ContactoInforme) => boolean;

  if (origen === ORIGEN_TODOS) pasaOrigen = () => true;
  else if (origen === ORIGEN_IDENTIFICADO) pasaOrigen = tieneOrigen;
  else if (origen === ORIGEN_NINGUNO) pasaOrigen = (c) => !tieneOrigen(c);
  else if (origen.startsWith("grupo:")) {
    const grupo = origen.slice(6);
    const claves = new Set(catalogos.origenes.filter((o) => o.grupo === grupo).map((o) => o.clave));
    pasaOrigen = (c) => c.origenes.some((o) => claves.has(o));
  } else if (origen.startsWith("conocio:")) {
    const valor = origen.slice(8);
    pasaOrigen = (c) => c.comoConocio.includes(valor);
  } else {
    pasaOrigen = (c) => c.origenes.includes(origen);
  }

  return contactos.filter(
    (c) =>
      (!desde || c.creado >= desde) &&
      (!hasta || c.creado <= hasta) &&
      (!comercial || c.comercial === comercial) &&
      pasaOrigen(c),
  );
}

// --- Conteos -------------------------------------------------------------------

export function contarPor<T extends string>(
  contactos: ContactoInforme[],
  clave: (c: ContactoInforme) => T,
): Map<T, number> {
  const conteo = new Map<T, number>();
  for (const c of contactos) {
    const k = clave(c);
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }
  return conteo;
}

/** Fila de las tablas de desglose (por origen, por comercial…). */
export interface FilaDesglose {
  clave: string;
  nombre: string;
  grupo?: string;
  nota?: string;
  leads: number;
  aplica: number;
  gestion: number;
  clientes: number;
}

export function resumir(
  clave: string,
  nombre: string,
  contactos: ContactoInforme[],
  extra: Partial<FilaDesglose> = {},
): FilaDesglose {
  let aplica = 0;
  let gestion = 0;
  let clientes = 0;
  for (const c of contactos) {
    if (c.calificacion !== "aplica") continue;
    aplica++;
    if (c.estadoGeneral === "gestion") gestion++;
    if (c.estadoGeneral === "cliente") clientes++;
  }
  return { clave, nombre, leads: contactos.length, aplica, gestion, clientes, ...extra };
}

export function porcentaje(parte: number, total: number): string {
  if (total === 0) return "—";
  const valor = (parte / total) * 100;
  return `${valor.toLocaleString("es-CO", { maximumFractionDigits: valor < 10 ? 1 : 0 })}%`;
}

// --- Tabla de KPI's (formato de la hoja de seguimiento mensual) -------------------

export interface ColumnaKpi {
  clave: string;
  nombre: string;
  /** De dónde sale en el CRM: la etiqueta o "Campo" (¿Cómo nos conoció?). */
  fuente: string;
  /** Columnas de total, que se resaltan. */
  total?: boolean;
  pasa: (c: ContactoInforme) => boolean;
}

export type TonoKpi = "neutro" | "cliente" | "oportunidad" | "gestion" | "no-aplica" | "off";

export interface FilaKpi {
  clave: string;
  nombre: string;
  tono: TonoKpi;
  cuenta: (c: ContactoInforme) => boolean;
}

const conOrigen =
  (...claves: string[]) =>
  (c: ContactoInforme) =>
    c.origenes.some((o) => claves.includes(o));

const conConocio = (valor: string) => (c: ContactoInforme) => c.comoConocio.includes(valor);

/**
 * Columnas en el orden de la hoja "KPI's MES". Las ciudades suman la campaña
 * de abril y la de octubre; Pereira solo la de octubre (Pereira-Armenia),
 * porque la de abril era Pereira-Manizales.
 */
export function columnasKpi(catalogos: CatalogosInforme): ColumnaKpi[] {
  const meta = new Set(
    catalogos.origenes.filter((o) => o.grupo.startsWith("Meta Ads")).map((o) => o.clave),
  );
  const columnas: ColumnaKpi[] = [
    { clave: "medellin", nombre: "Medellín", fuente: "medellín-", pasa: conOrigen("medellin-abr", "medellin-oct") },
    { clave: "bogota", nombre: "Bogotá", fuente: "bogotá-", pasa: conOrigen("bogota-abr", "bogota-oct") },
    { clave: "cali", nombre: "Cali", fuente: "cali-", pasa: conOrigen("cali-abr", "cali-oct") },
    { clave: "pereira", nombre: "Pereira Armenia", fuente: "pereira-armenia-oct2026", pasa: conOrigen("pereira-oct") },
    { clave: "barranquilla", nombre: "Barranquilla", fuente: "barranquilla-", pasa: conOrigen("barranquilla-abr", "barranquilla-oct") },
    { clave: "advantage", nombre: "Advantage", fuente: "advantage-", pasa: conOrigen("advantage") },
    {
      clave: "total-meta",
      nombre: "Total Meta",
      fuente: "facebook-ads-lead",
      total: true,
      pasa: (c) => c.origenes.some((o) => meta.has(o)),
    },
    { clave: "google-ads", nombre: "Google Ads", fuente: "positivo - pauta - google ads", pasa: conOrigen("google-ads") },
    { clave: "facebook", nombre: "Facebook", fuente: "Campo", pasa: conConocio("Facebook") },
    { clave: "instagram", nombre: "Instagram", fuente: "Campo", pasa: conConocio("Instagram") },
    { clave: "linkedin", nombre: "LinkedIn", fuente: "Campo", pasa: conConocio("LinkedIn") },
    { clave: "tiktok", nombre: "TikTok", fuente: "Campo", pasa: conConocio("TikTok") },
    { clave: "youtube", nombre: "YouTube", fuente: "Campo", pasa: conConocio("YouTube") },
    { clave: "sitio-web", nombre: "Sitio web", fuente: "positivo-organico", pasa: conOrigen("organico") },
    { clave: "ascensor", nombre: "Ascensor", fuente: "Campo", pasa: conConocio("Ascensor") },
  ];
  // Un lead con varias fuentes (p. ej. etiqueta de Meta y "Conoció por:
  // Facebook") cuenta una sola vez en el total, no una por columna.
  const fuentes = columnas.filter((col) => !col.total);
  columnas.push({
    clave: "total",
    nombre: "Total",
    fuente: "Sin repetir",
    total: true,
    pasa: (c) => fuentes.some((col) => col.pasa(c)),
  });
  return columnas;
}

const conEstado =
  (...valores: string[]) =>
  (c: ContactoInforme) =>
    valores.some((v) => v.toLowerCase() === c.estadoGestion.trim().toLowerCase());

const estado = (valor: string, tono: TonoKpi): FilaKpi => ({
  clave: valor,
  nombre: valor,
  tono,
  cuenta: conEstado(valor),
});

/** Filas en el orden de la hoja, con los valores de "Estado de gestión" tal cual en Clientify. */
export const FILAS_KPI: FilaKpi[] = [
  { clave: "leads", nombre: "Leads Clientify", tono: "neutro", cuenta: () => true },
  { clave: "aplica", nombre: "Aplica", tono: "neutro", cuenta: (c) => c.calificacion === "aplica" },
  // "Cliente" a secas es el valor viejo de la misma opción.
  { clave: "cliente", nombre: "C - Cliente", tono: "cliente", cuenta: conEstado("C - Cliente", "Cliente") },
  estado("OP - Contactado por Email", "oportunidad"),
  estado("OP - Contactado por WApp", "oportunidad"),
  estado("OP - Interes de Compra Mayor a 3 Meses", "oportunidad"),
  estado("G - Informacion Comercial Enviada", "gestion"),
  estado("G - Cotizacion Enviada", "gestion"),
  estado("G - Interes de Compra Menos a 3 Meses", "gestion"),
  estado("G - En Espera de documentos para Creacion de cliente", "gestion"),
  estado("G - Estudio de Credito", "gestion"),
  estado("NA - Administrador de PH", "no-aplica"),
  estado("NA - Descartado por Presupuesto", "no-aplica"),
  estado("NA - No tenemos lo que busca", "no-aplica"),
  estado("NA - Numero equivocado", "no-aplica"),
  estado("NA - No Info No Contesta", "no-aplica"),
  estado("OFF - Solo Busca Informacion", "off"),
  estado("OFF - No contesta", "off"),
  estado("Contacto Secundario", "neutro"),
  estado("Duplicado", "neutro"),
];

/** Conteos [fila][columna] de la tabla de KPI's. */
export function calcularKpi(
  contactos: ContactoInforme[],
  columnas: ColumnaKpi[],
  filas: FilaKpi[] = FILAS_KPI,
): number[][] {
  const porColumna = columnas.map((col) => contactos.filter(col.pasa));
  return filas.map((fila) => porColumna.map((lista) => lista.filter(fila.cuenta).length));
}

// --- Tiempo de conversión --------------------------------------------------------

export interface ResumenConversion {
  /** Clientes del filtro con las dos fechas en el historial. */
  medidos: number;
  /** Clientes del filtro a los que no se les pudo medir (sin registro). */
  sinRegistro: number;
  promedioDias: number;
  medianaDias: number;
  detalle: { id: number; dias: number; aplicaEstimado: boolean }[];
}

const MS_DIA = 24 * 60 * 60 * 1000;

export function resumirConversion(
  clientes: ContactoInforme[],
  conversiones: Map<number, Conversion>,
): ResumenConversion {
  const detalle: ResumenConversion["detalle"] = [];
  let sinRegistro = 0;
  for (const c of clientes) {
    const conv = conversiones.get(c.id);
    if (!conv?.clienteEn || !conv.aplicaEn) {
      sinRegistro++;
      continue;
    }
    const dias = Math.max(0, (Date.parse(conv.clienteEn) - Date.parse(conv.aplicaEn)) / MS_DIA);
    detalle.push({ id: c.id, dias, aplicaEstimado: conv.aplicaEstimado });
  }
  const ordenados = detalle.map((d) => d.dias).sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  const mediana =
    ordenados.length === 0
      ? 0
      : ordenados.length % 2
        ? ordenados[mitad]
        : (ordenados[mitad - 1] + ordenados[mitad]) / 2;
  return {
    medidos: detalle.length,
    sinRegistro,
    promedioDias: detalle.length ? ordenados.reduce((a, b) => a + b, 0) / detalle.length : 0,
    medianaDias: mediana,
    detalle,
  };
}

export function formatoDias(dias: number): string {
  if (dias < 1) {
    const horas = Math.round(dias * 24);
    return `${horas} ${horas === 1 ? "hora" : "horas"}`;
  }
  const redondeado = Math.round(dias * 10) / 10;
  return `${redondeado.toLocaleString("es-CO")} ${redondeado === 1 ? "día" : "días"}`;
}
