export interface ClientData {
  razonSocial: string;
  nit: string;
  email: string;
  contacto: string;
  /**
   * Marca del cliente. Es opcional: la escribe el comercial cuando la
   * cotización es para una marca concreta de la empresa. Las cotizaciones
   * guardadas antes de que existiera este campo no lo traen.
   */
  marca?: string;
  /**
   * Empresa de Clientify de la que salieron estos datos. Se guarda para poder
   * anotarle la cotización después; las escritas a mano no lo tienen.
   */
  clientifyId?: number;
}

export interface InvoiceItem {
  id: string;
  nombreProducto: string;
  descripcionProducto: string;
  cantidad: number;
  precioUnitario: number;
}

/**
 * Id del producto que se está capturando en el formulario y todavía no se ha
 * agregado con el botón. Se muestra en la cotización para ver cómo va
 * quedando, marcado aparte de los ya agregados.
 */
export const ID_BORRADOR = "__borrador__";

export interface InvoiceData {
  numeroFactura: string;
  fecha: string;
  validaHasta: string;
  formaPago: string;
  ivaPorcentaje: number;
  observaciones: string;
  cliente: ClientData;
  items: InvoiceItem[];
}

/** Un movimiento en la vida de la cotización, para el timeline del historial. */
export interface HistorialEntrada {
  fecha: string;
  accion:
    | "creada"
    | "editada"
    | "reasignada"
    | "enviada_clientify"
    | "marcada_ganada"
    | "marcada_perdida"
    | "estado_quitado";
  /** Correo de quién hizo el movimiento. */
  quien: string;
  /** Solo en "reasignada": correo a quien se le dio el acceso, o "" si se quitó. */
  nuevoDueno?: string;
  /** Solo en "marcada_ganada"/"marcada_perdida": el motivo que se escribió. */
  razon?: string;
}

/** Resultado de la cotización: ganada, perdida, o sin definir todavía. */
export type EstadoCotizacion = "ganada" | "perdida";

/**
 * Un archivo adjunto al marcar el resultado de una cotización. El contenido
 * se sube aparte (POST .../adjuntos) y vive en su propio almacén; aquí solo
 * queda la referencia — nombre, tipo, tamaño y el testigo con el que se
 * arma la URL pública (/api/adjuntos/<testigo>) que se anota en Clientify.
 */
export interface AdjuntoEstado {
  nombre: string;
  tipo: string;
  /** Tamaño en bytes del archivo original. */
  tamano: number;
  testigo: string;
}

/** Lo que se manda al subir un archivo, antes de tener testigo. */
export interface AdjuntoParaSubir {
  nombre: string;
  tipo: string;
  /** Contenido en base64 (sin el prefijo "data:...;base64,"). */
  datos: string;
}

export interface CotizacionGuardada {
  guardadoEn: string;
  /** Correo de quién la creó. Las guardadas antes de que existiera este dato no lo traen. Nunca cambia al reasignar. */
  creadoPor?: string;
  /** Correo de quién más tiene acceso, además de quien la creó. */
  reasignadoA?: string;
  /** Ganada, perdida, o sin marcar todavía. */
  estado?: EstadoCotizacion;
  /** Motivo escrito al marcar el estado actual. Vacío si no se marcó ninguno. */
  razonEstado?: string;
  /** Archivos adjuntados al marcar el estado actual. */
  adjuntosEstado?: AdjuntoEstado[];
  /** Creación, ediciones y reasignaciones, en orden. Las guardadas antes de que existiera este dato no lo traen. */
  historial?: HistorialEntrada[];
  data: InvoiceData;
}

/** Quién firma la cotización, para el bloque de firma del documento. */
export interface CreadorFirma {
  nombre: string;
  telefono: string;
  correo: string;
  cargo: string;
}

export const FORMAS_PAGO = [
  "Contado",
  "Crédito a 15 días",
  "Crédito a 30 días",
  "Crédito a 45 días",
  "Crédito a 60 días",
  "Crédito a 90 días",
  "50 anticipo y 50 al finalizar",
] as const;

