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
 * Tipografías que se pueden aplicar al texto.
 *
 * Cada una es una familia propia y no un grosor de la misma, a propósito: así
 * elegir tipografía y poner negrilla son cosas independientes y no se pisan.
 * Los archivos se declaran en index.css; mientras no estén, el navegador cae
 * en la tipografía base y el texto se sigue leyendo.
 */
export const FUENTES = [
  { nombre: "Display Regular", familia: "Canva Display Regular" },
  { nombre: "Display Medium", familia: "Canva Display Medium" },
  { nombre: "Display Bold", familia: "Canva Display Bold" },
] as const;

const FAMILIAS: Set<string> = new Set(FUENTES.map((f) => f.familia));

/**
 * Devuelve la familia solo si es una de las tres, y null si no.
 *
 * Es una lista cerrada, no un valor libre: lo que salga de aquí acaba en el
 * atributo `style` del HTML guardado, y aceptar cualquier texto abriría la
 * puerta a colar otras declaraciones de CSS.
 *
 * Hay que limpiar antes de comparar porque el navegador guarda la familia
 * entrecomillada: pide "Canva Display Bold" y devuelve `"Canva Display Bold"`.
 */
export function normalizarFuente(valor: string): string | null {
  const limpio = valor
    .trim()
    .replace(/^["']|["']$/g, "")
    .split(",")[0]
    .trim()
    .replace(/^["']|["']$/g, "");

  return FAMILIAS.has(limpio) ? limpio : null;
}

/** Colores que ofrece la paleta. Se puede escribir cualquier otro a mano. */
export const COLORES_SUGERIDOS = [
  { nombre: "Negro", valor: "#0f172a" },
  { nombre: "Gris", valor: "#475569" },
  { nombre: "Gris claro", valor: "#94a3b8" },
  { nombre: "Rojo", valor: "#dc2626" },
  { nombre: "Naranja", valor: "#ea580c" },
  { nombre: "Ámbar", valor: "#ca8a04" },
  { nombre: "Verde", valor: "#16a34a" },
  { nombre: "Verde oscuro", valor: "#047857" },
  { nombre: "Turquesa", valor: "#0891b2" },
  { nombre: "Azul", valor: "#1d4ed8" },
  { nombre: "Morado", valor: "#6d28d9" },
  { nombre: "Fucsia", valor: "#be185d" },
] as const;

/**
 * Devuelve el color como `#rrggbb`, o null si no lo es.
 *
 * Se aceptan colores libres, pero solo en esta forma. Es lo que mantiene
 * seguro el saneado: el valor que acaba en el atributo `style` son seis
 * dígitos hexadecimales y nada más, de modo que no cabe una función de CSS
 * como `url(...)` por mucho que se manipule el contenido guardado.
 *
 * Hay que normalizar además porque el navegador reescribe lo que se le pide:
 * al aplicar "#dc2626" lo guarda como "rgb(220, 38, 38)".
 */
export function normalizarColor(valor: string): string | null {
  const limpio = valor.trim().toLowerCase();
  if (limpio === "") return null;

  const rgb = limpio.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    const canales = [rgb[1], rgb[2], rgb[3]].map(Number);
    if (canales.some((canal) => canal > 255)) return null;
    return `#${canales.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  }

  const corto = limpio.match(/^#?([0-9a-f]{3})$/);
  if (corto) {
    return `#${Array.from(corto[1], (digito) => digito + digito).join("")}`;
  }

  const largo = limpio.match(/^#?([0-9a-f]{6})$/);
  return largo ? `#${largo[1]}` : null;
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
    const color = normalizarColor(
      elemento.style.color || elemento.getAttribute("color") || "",
    );
    const fuente = normalizarFuente(
      elemento.style.fontFamily || elemento.getAttribute("face") || "",
    );

    for (const atributo of Array.from(elemento.attributes)) {
      elemento.removeAttribute(atributo.name);
    }

    const estilos: string[] = [];
    if (ALINEACIONES.has(alineacion)) estilos.push(`text-align: ${alineacion}`);
    if (color) estilos.push(`color: ${color}`);
    // Va entrecomillada porque los nombres llevan espacios.
    if (fuente) estilos.push(`font-family: "${fuente}"`);

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
