export interface ClientData {
  razonSocial: string;
  nit: string;
  email: string;
  contacto: string;
}

export interface InvoiceItem {
  id: string;
  descripcionProducto: string;
  ciudad: string;
  quincena: string;
  cantidad: number;
  precioUnitario: number;
  impactosPromedio15Dias: number;
}

export interface InvoiceData {
  numeroFactura: string;
  fecha: string;
  validaHasta: string;
  formaPago: string;
  descripcion: string;
  ivaPorcentaje: number;
  observaciones: string;
  cliente: ClientData;
  items: InvoiceItem[];
}

export const FORMAS_PAGO = [
  "Contado",
  "Transferencia bancaria",
  "Crédito 30 días",
  "Crédito 60 días",
  "Crédito 90 días",
] as const;

export const CIUDADES = [
  "Medellin",
  "Bogotá",
  "Cali",
  "Barranquilla",
  "Pereira",
  "Armenia",
  "Oriente Antioqueño",
  "A convenir",
  "En cobertura P+G",
] as const;
