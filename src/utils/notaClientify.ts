import type { InvoiceData } from "../types";
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

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Cuerpo de la nota: el número de la cotización y el enlace, nada más.
 *
 * Va en HTML porque Clientify lo renderiza como tal —se vio en que colapsó el
 * salto de línea del texto plano—, así que el enlace tiene que ir con <a> para
 * poder abrirse desde la ficha. El texto del enlace es la propia dirección: si
 * algún día Clientify quitara las etiquetas, la URL seguiría a la vista para
 * copiarla.
 */
export function textoDeNota(data: InvoiceData, enlace?: string): string {
  const lineas: string[] = [];

  // La marca es opcional y encabeza la nota solo si el comercial la escribió.
  // Sin ella no se deja una línea vacía ni un rótulo suelto en la ficha.
  const marca = (data.cliente.marca ?? "").trim();
  if (marca !== "") lineas.push(escaparHtml(marca));

  lineas.push(escaparHtml(`COTIZACIÓN N° ${data.numeroFactura}`));

  if (enlace) {
    const url = escaparHtml(enlace);
    lineas.push(
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
    );
  }

  return lineas.join("<br>");
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
