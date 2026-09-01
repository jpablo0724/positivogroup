/**
 * Observaciones con formato (negrilla, alineación, viñetas y color).
 *
 * El campo se guarda como HTML, pero el catálogo de productos y las
 * cotizaciones guardadas antes de este cambio traen texto plano, así que
 * `aHtml` acepta las dos formas y siempre devuelve HTML limpio.
 *
 * Todo lo que se va a pintar con dangerouslySetInnerHTML pasa antes por
 * `sanitizarHtml`: solo sobreviven las etiquetas de formato, el `text-align` y
 * los colores de la lista, de modo que un contenido manipulado en el
 * almacenamiento del navegador no pueda inyectar nada ejecutable en la
 * cotización.
 */

/**
 * Colores que puede tomar el texto de las observaciones.
 *
 * Es una lista cerrada y no un selector libre a propósito. Por un lado, lo que
 * se guarda aquí se vuelve a pintar con dangerouslySetInnerHTML, y cuanto más
 * estrecho sea lo que se acepta, menos superficie hay que vigilar. Por otro,
 * mantiene todas las cotizaciones dentro de una misma gama.
 */
export const COLORES_TEXTO = [
  { nombre: "Negro", valor: "#0f172a" },
  { nombre: "Rojo", valor: "#dc2626" },
  { nombre: "Verde", valor: "#047857" },
  { nombre: "Azul", valor: "#1d4ed8" },
  { nombre: "Gris", valor: "#64748b" },
] as const;

const VALORES_COLOR: Set<string> = new Set(
  COLORES_TEXTO.map((color) => color.valor),
);

/**
 * Devuelve el color solo si está en la lista, y null si no.
 *
 * Hay que normalizar antes de comparar: al aplicar el formato se pide
 * "#dc2626" pero el navegador lo guarda como "rgb(220, 38, 38)".
 */
function colorPermitido(valor: string): string | null {
  const limpio = valor.trim().toLowerCase();
  if (limpio === "") return null;

  const rgb = limpio.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  const hex = rgb
    ? `#${[rgb[1], rgb[2], rgb[3]]
        .map((canal) => Number(canal).toString(16).padStart(2, "0"))
        .join("")}`
    : limpio;

  return VALORES_COLOR.has(hex) ? hex : null;
}

const ETIQUETAS_PERMITIDAS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "UL",
  "OL",
  "LI",
  "BR",
  "P",
  "DIV",
  "HR",
  "SPAN",
]);

const ALINEACIONES = new Set(["left", "center", "right", "justify"]);

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Convierte texto plano a HTML, tratando una línea "---" como separador. */
export function textoPlanoAHtml(texto: string): string {
  return texto
    .split(/^[ \t]*---[ \t]*$/m)
    .map((bloque) => bloque.trim())
    .filter(Boolean)
    .map((bloque) => `<div>${escapar(bloque).replace(/\n/g, "<br>")}</div>`)
    .join("<hr>");
}

function esHtml(valor: string): boolean {
  return /<[a-z][^>]*>/i.test(valor);
}

function limpiar(padre: Element) {
  for (const nodo of Array.from(padre.childNodes)) {
    if (nodo.nodeType === Node.TEXT_NODE) continue;

    if (nodo.nodeType !== Node.ELEMENT_NODE) {
      nodo.remove();
      continue;
    }

    const elemento = nodo as HTMLElement;
    // Primero los hijos, para que al desenvolver una etiqueta no permitida lo
    // que sube al padre ya venga limpio.
    limpiar(elemento);

    if (!ETIQUETAS_PERMITIDAS.has(elemento.tagName)) {
      elemento.replaceWith(...Array.from(elemento.childNodes));
      continue;
    }

    // Se leen antes de vaciar los atributos, que es lo que descarta todo lo
    // demás.
    const alineacion = (
      elemento.style.textAlign ||
      elemento.getAttribute("align") ||
      ""
    ).toLowerCase();
    const color = colorPermitido(
      elemento.style.color || elemento.getAttribute("color") || "",
    );

    for (const atributo of Array.from(elemento.attributes)) {
      elemento.removeAttribute(atributo.name);
    }

    const estilos: string[] = [];
    if (ALINEACIONES.has(alineacion)) estilos.push(`text-align: ${alineacion}`);
    if (color) estilos.push(`color: ${color}`);

    if (estilos.length > 0) {
      elemento.setAttribute("style", estilos.join("; "));
    }
  }
}

export function sanitizarHtml(html: string): string {
  // DOMParser no ejecuta scripts ni carga recursos: solo arma el árbol.
  const documento = new DOMParser().parseFromString(
    `<div id="raiz">${html}</div>`,
    "text/html",
  );
  const raiz = documento.getElementById("raiz");
  if (!raiz) return "";

  limpiar(raiz);
  return raiz.innerHTML;
}

/** HTML listo para pintar, venga el valor como HTML o como texto plano. */
export function aHtml(valor: string): string {
  if (valor.trim() === "") return "";
  return esHtml(valor) ? sanitizarHtml(valor) : textoPlanoAHtml(valor);
}

/** ¿El contenido con formato quedaría vacío al quitarle las etiquetas? */
export function estaVacio(valor: string): boolean {
  return valor.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "";
}

// Clases para que las listas y las líneas divisorias se vean igual en el
// editor y en la cotización (Tailwind quita los estilos por defecto).
export const CLASES_CONTENIDO =
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5";
