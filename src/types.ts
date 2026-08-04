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
