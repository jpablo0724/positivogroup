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

export const PRODUCTOS = [
  "P01 - Publicidad en Ascensores Residenciales x 15 días (Carteleras impresas al interior de ascensores)",
  "P02 - Publicidad en Ascensores Residenciales x 8 días (Carteleras impresas al interior de ascensores)",
  "P03 - Marketing en Buzones Residenciales (Volantes, Cuponeras, Imanes)",
  "P04 - Sampling en Buzones Residenciales (Sampling No refrigerado)",
  "P06 - Espacios para Activaciones de Marca al interior de Conjuntos Residenciales (Activación estándar)",
  "P07 - Espacios para Activaciones de Marca al interior de Conjuntos Residenciales (Activación Express de 4 horas)",
  "P09 - Insertos en Facturas de Servicios Públicos - ENEL",
  "P10 - Insertos en Facturas de Servicios Públicos - EMCALI",
  "P08 - Sampling Urbano Móvil o Estático",
  "PR01 - Cambio de Arte en Ascensores (Incluye impresión e instalación)",
  "PR02 - Servicio de Diseño Gráfico (Precio x pieza diseñada)",
  "PR03 - Impresión de material publicitario (Litografía)",
  "PR08 - Manualidad o reempaque de materal publicitario (No incluye bolsa)",
  "PR09 - Manualidad o reempaque de materal publicitario (Incluye bolsa)",
  "PR10 - Promotores / Volanteros",
  "B01 - BONIFICADO - Publicidad en Ascensores Residenciales x 15 días (Incluye producción e instalación)",
  "B02 - BONIFICADO - Publicidad en Ascensores Residenciales x 8 días (Incluye producción e instalación)",
  "B03 - BONIFICADO - Marketing en Buzones Residenciales (Volantes, Cuponeras, Imanes) No incluye producción",
  "B04 - BONIFICADO - Marketing en Buzones Residenciales (Volantes, Cuponeras, Imanes) Incluye producción",
  "B05 - BONIFICADO - Hombre Valla - PopMan (Día de 6 horas) / Incluye Producción",
  "B06 - BONIFICADO - Cambio de Arte en Ascensores (Incluye impresión e instalación)",
] as const;
