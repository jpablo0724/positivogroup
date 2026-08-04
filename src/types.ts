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

export const PRODUCTOS = [
  "Publicidad en ascensores residenciales x 15 días",
  "Insertos en buzones de correo residencial",
  "Sampling en Conjuntos Residenciales",
  "Insertos en facturas de servicios públicos (ENEL) Bogotá y C/marca (VOLANTE 8,5 x 14)",
  "Insertos en facturas de servicios públicos (ENEL) Bogotá y C/marca (VOLANTE + IMAN)",
  "Insertos en facturas de servicios públicos (EMCALI) Cali - VOLANTES",
  "Insertos en facturas de servicios públicos (EMCALI) Cali - VOLANTE + IMAN",
  "Comunicación Urbana - Hombres Valla por 1 día",
  "Comunicación Urbana - Bici Valla por 1 día",
  "Comunicación Urbana - Carro Valla por un día",
  "Espacios para activaciones de marca en conjuntos residenciales (Fin de Semana)",
  "Espacios para activaciones de marca en conjuntos residenciales (Solo sábado o Domingo)",
  "Volanteo peatonal (Día)",
  "Volanteo puerta a puerta (unidad)",
  "Supervisor con moto",
  "Producción Dotación",
  "Reimpresión de artes ascensores",
  "Cambio de arte ascensores",
  "Recargo traslado a municipios cercanos",
  "Diseño gráfico Ascensores y Volantes",
  "PRODUCCIÓN Hombre Valla",
  "PRODUCCIÓN Bici Valla",
  "PRODUCCIÓN Carro Valla",
  "PRODUCCIÓN de Volantes",
  "BONIFICADO. Insertos en buzones de correo residencial (NO Incluye producción)",
  "BONIFICADO. Insertos en buzones de correo residencial (Incluye producción)",
  "BONIFICADO. Hombres Valla y/o Bici Vallas (Incluye producción de lonas)",
  "BONIFICADO. Ascensores adicionales sin costo (Incluye impresión)",
  "BONIFICADO. Cambio de arte a mitad de cada quincena (incluye impresión)",
] as const;

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const QUINCENAS: readonly string[] = MESES.flatMap((mes) => [
  `${mes} Q1`,
  `${mes} Q2`,
]);
