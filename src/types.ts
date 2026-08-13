export interface ClientData {
  razonSocial: string;
  nit: string;
  email: string;
  contacto: string;
}

export interface InvoiceItem {
  id: string;
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

export const OBSERVACIONES_DEFAULT = [
  "PRECIOS ANTES DE IVA / PRECIOS DE PAUTA EN ASCENSORES CORRESPONDE A CICLO QUINCENAL",
  "Los ciclos de pauta de los ascensores son por quincenas cerradas, lo que significa que los ciclos de pauta solo van del 1 al 15 y del 16 al 30 de cada mes.",
  "El cliente selecciona la ubicación de los espacios en los que desea pautar / La reserva final está sujeta a disponibilidad al momento de ser confirmada / No se admiten selecciones fraccionadas de ascensores en cada Conjunto Residencial, esto significa que se deben contabilizar el 100% de ascensores de cada conjunto residencial seleccionado para pautar.",
  "Se pueden presentar novedades al momento de la instalación de la pauta debido a mantenimientos de ascensores, mudanzas u otros hechos que impidan la instalación efectiva en algunos espacios. En tal caso POSITIVO GROUP sustituirá el/los espacio(s) por otro(s) que reuna(n) características similares a los previamente seleccionados por el cliente. En caso que no existan espacios sustitutos similares, POSITIVO GROUP facturará los espacios efectivamente instalados.",
  "Dependiendo de la cantidad y de la disperción de las ubicaciones seleccionadas, el 90% de la instalación de la pauta contratada podria tardar un máximo de 2 días contados a partir del inicio del ciclo de pauta. (El 100% se puede llegar completar a más tardar el tercer día).",
  "Las pautas deberán ser confirmadas mediante Orden de Compra, Cotización Firmada, o Mediante aceptación expresa vía email por parte del cliente anunciante.",
  "El arte para la pauta en ASCENSORES debe ser bajo estructura CMYK, debe ser entregado por el cliente en las siguientes medidas: (Ancho: 20,5 cm x Alto: 25 cm). Se debe enviar un archivo PDF en Alta y curvas con imágenes incrustadas para impresión y un archivo JPG en Baja para previsualización. El arte se debe enviar mínimo 3 días hábiles antes del inicio del ciclo de pauta con el fin de garantizar el tiempo de exposición ofrecido.",
  "En la tarifa se incluye costo logístico, impresión de artes, registro fotográfico de la pauta que será enviado al correo mediante un link.",
  "El registro fotográfico y el reporte de la pauta se enviará al cliente vía email en un lapso no superior a 5 días hábiles contados a partir del inicio del ciclo de pauta.",
  "** Cálculo de Impactos: En promedio, 1 Ascensor impacta 30 apartamentos, 1 persona usa el ascensor 3,4 veces al día, un apartamento tiene 3,65 habitantes, los visitantes usan el ascensor 2 veces al día",
].join("\n");
