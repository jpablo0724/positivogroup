export interface ClientData {
  razonSocial: string;
  nit: string;
  email: string;
  contacto: string;
}

export interface InvoiceItem {
  id: string;
  nombreProducto: string;
  descripcionProducto: string;
  cantidad: number;
  precioUnitario: number;
}

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

