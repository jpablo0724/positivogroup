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

export interface CotizacionGuardada {
  guardadoEn: string;
  data: InvoiceData;
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

