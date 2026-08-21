import type { InvoiceData } from "../types";
import {
  calcInvoiceTotals,
  calcItemTotals,
  formatCurrency,
  formatDateLong,
  formatNumber,
} from "./calculations";
import { pedir } from "./api";
import { buscarEmpresas } from "./clientify";

/**
 * Anotación de una cotización en la ficha de la empresa en Clientify.
 *
 * Se manda como texto plano, no como HTML: es lo que se lee bien en el
 * historial del CRM.
 */

export function tituloDeNota(data: InvoiceData): string {
  return `Cotización ${data.numeroFactura}`;
}

/** Pide (o recupera) el enlace público de la cotización y arma la URL. */
export async function enlacePublico(numeroFactura: string): Promise<string> {
  const { testigo } = await pedir<{ testigo: string }>(
    "/api/cotizaciones/enlace",
    { metodo: "POST", cuerpo: { numeroFactura } },
  );
  return `${window.location.origin}/c/${testigo}`;
}

export function textoDeNota(data: InvoiceData, enlace?: string): string {
  const totales = calcInvoiceTotals(data.items, data.ivaPorcentaje);

  const lineas = [
    `COTIZACIÓN N.º ${data.numeroFactura}`,
    `Fecha: ${formatDateLong(data.fecha) || "—"}`,
    `Válida hasta: ${formatDateLong(data.validaHasta) || "—"}`,
    `Forma de pago: ${data.formaPago || "—"}`,
    "",
    `Cliente: ${data.cliente.razonSocial || "—"}`,
    `NIT: ${data.cliente.nit || "—"}`,
    `Contacto: ${data.cliente.contacto || "—"}${
      data.cliente.email ? ` (${data.cliente.email})` : ""
    }`,
    "",
    "PRODUCTOS",
  ];

  if (data.items.length === 0) {
    lineas.push("  (sin productos)");
  }

  for (const item of data.items) {
    const t = calcItemTotals(item, data.ivaPorcentaje);
    const detalle = [
      item.cantidad > 0 ? `${formatNumber(item.cantidad)} und` : null,
      item.precioUnitario > 0
        ? `${formatCurrency(item.precioUnitario)} c/u`
        : null,
      t.inversionTotalAntesIva > 0
        ? `= ${formatCurrency(t.inversionTotalAntesIva)}`
        : "sin valor",
    ]
      .filter(Boolean)
      .join(" · ");

    lineas.push(`• ${item.nombreProducto}`);
    lineas.push(`  ${detalle}`);
  }

  lineas.push(
    "",
    `Total antes de IVA: ${formatCurrency(totales.subtotal)}`,
    `IVA ${data.ivaPorcentaje}%: ${formatCurrency(totales.iva)}`,
    `TOTAL: ${formatCurrency(totales.total)}`,
  );

  if (enlace) {
    lineas.push(
      "",
      "Ver la cotización y descargarla en PDF:",
      enlace,
    );
  }

  return lineas.join("\n");
}

/** Quita acentos y mayúsculas, para comparar nombres de empresa. */
function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Empresa de Clientify a la que le corresponde la cotización.
 *
 * Lo normal es que venga guardada desde que se eligió en el buscador. Para las
 * cotizaciones viejas, que se guardaron antes de que se registrara ese vínculo,
 * se intenta una coincidencia exacta por razón social o NIT; si hay dudas se
 * devuelve null y el sistema pide elegir la empresa a mano, en vez de anotarle
 * la cotización a quien no es.
 */
export async function empresaDeLaCotizacion(
  data: InvoiceData,
): Promise<number | null> {
  if (typeof data.cliente.clientifyId === "number") {
    return data.cliente.clientifyId;
  }

  const razonSocial = data.cliente.razonSocial.trim();
  if (razonSocial === "") return null;

  const candidatas = await buscarEmpresas(razonSocial);
  const nit = normalizar(data.cliente.nit);
  const buscada = normalizar(razonSocial);

  const exactas = candidatas.filter(
    (empresa) =>
      normalizar(empresa.razonSocial) === buscada ||
      normalizar(empresa.nombre) === buscada ||
      (nit !== "" && normalizar(empresa.nit) === nit),
  );

  return exactas.length === 1 ? exactas[0].id : null;
}

export interface ResultadoNota {
  enviada: boolean;
  endpoint?: string;
  intentos?: { url: string; status: number; respuesta: string }[];
}

export async function enviarNota(
  empresaId: number,
  data: InvoiceData,
  enlace: string,
): Promise<ResultadoNota> {
  return pedir<ResultadoNota>("/api/clientify/nota", {
    metodo: "POST",
    cuerpo: {
      empresaId,
      titulo: tituloDeNota(data),
      texto: textoDeNota(data, enlace),
    },
  });
}
