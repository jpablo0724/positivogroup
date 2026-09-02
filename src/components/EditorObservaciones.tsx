import { useEffect, useRef, useState } from "react";
import PaletaHexagonal from "./PaletaHexagonal";
import {
  CLASES_CONTENIDO,
  aHtml,
  estaVacio,
  normalizarColor,
} from "../utils/richText";

interface EditorObservacionesProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Cómo se llama el campo. Hay varios editores en pantalla a la vez. */
  etiqueta?: string;
}

interface Boton {
  comando: string;
  titulo: string;
  icono: React.ReactNode;
}

const trazo = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const BOTONES: Boton[] = [
  {
    comando: "bold",
    titulo: "Negrilla",
    icono: <span className="text-sm font-bold leading-none">N</span>,
  },
  {
    comando: "insertUnorderedList",
    titulo: "Viñetas",
    icono: (
      <svg viewBox="0 0 20 20" {...trazo} className="h-4 w-4">
        <circle cx="4" cy="6" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="4" cy="10" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="4" cy="14" r="1.1" fill="currentColor" stroke="none" />
        <path d="M8 6h9M8 10h9M8 14h9" />
      </svg>
    ),
  },
  {
    comando: "justifyLeft",
    titulo: "Alinear a la izquierda",
    icono: (
      <svg viewBox="0 0 20 20" {...trazo} className="h-4 w-4">
        <path d="M3 5h14M3 9h9M3 13h14M3 17h9" />
      </svg>
    ),
  },
  {
    comando: "justifyCenter",
    titulo: "Centrar el texto",
    icono: (
      <svg viewBox="0 0 20 20" {...trazo} className="h-4 w-4">
        <path d="M3 5h14M5.5 9h9M3 13h14M5.5 17h9" />
      </svg>
    ),
  },
];

/**
 * Campo de observaciones con formato: negrilla, viñetas, alineación y color.
 *
 * Guarda HTML. Es un contentEditable no controlado (React no reescribe el
 * contenido en cada tecla, porque eso movería el cursor al final): solo se
 * vuelca el valor cuando viene de afuera, como al elegir un producto o al
 * abrir una cotización guardada.
 */
export default function EditorObservaciones({
  value,
  onChange,
  placeholder = "Notas adicionales para el cliente",
  etiqueta = "Observaciones",
}: EditorObservacionesProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const ultimoEmitido = useRef<string | null>(null);

  const [paletaAbierta, setPaletaAbierta] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [ultimoColor, setUltimoColor] = useState("#0f172a");
  const paletaRef = useRef<HTMLDivElement>(null);
  // Escribir en la casilla del código saca el foco del editor y con él se
  // pierde el texto seleccionado, así que se guarda para reponerlo al aplicar.
  const seleccion = useRef<Range | null>(null);

  useEffect(() => {
    if (value === ultimoEmitido.current) return;

    const editor = editorRef.current;
    if (!editor) return;

    const deseado = aHtml(value);
    if (editor.innerHTML !== deseado) editor.innerHTML = deseado;
  }, [value]);

  useEffect(() => {
    if (!paletaAbierta) return;

    function alPulsarFuera(evento: MouseEvent) {
      if (!paletaRef.current?.contains(evento.target as Node)) {
        setPaletaAbierta(false);
      }
    }
    function alEscape(evento: KeyboardEvent) {
      if (evento.key === "Escape") setPaletaAbierta(false);
    }

    document.addEventListener("mousedown", alPulsarFuera);
    document.addEventListener("keydown", alEscape);
    return () => {
      document.removeEventListener("mousedown", alPulsarFuera);
      document.removeEventListener("keydown", alEscape);
    };
  }, [paletaAbierta]);

  function emitir() {
    const html = editorRef.current?.innerHTML ?? "";
    ultimoEmitido.current = html;
    onChange(html);
  }

  function ejecutar(comando: string) {
    editorRef.current?.focus();
    // Con styleWithCSS desactivado, negrilla y viñetas producen etiquetas
    // semánticas (<b>, <ul>) en vez de <span style="font-weight: bold">. Es lo
    // que conserva el saneado, así que el formato sobrevive al guardar.
    document.execCommand("styleWithCSS", false, "false");
    // execCommand está marcado como obsoleto, pero sigue siendo la única forma
    // de dar formato en un contentEditable sin traer una librería completa.
    document.execCommand(comando);
    emitir();
  }

  function alternarPaleta() {
    const actual = window.getSelection();
    if (actual && actual.rangeCount > 0) {
      const rango = actual.getRangeAt(0);
      if (editorRef.current?.contains(rango.commonAncestorContainer)) {
        seleccion.current = rango.cloneRange();
      }
    }
    setPaletaAbierta((abierta) => !abierta);
  }

  function aplicarColor(valor: string) {
    const color = normalizarColor(valor);
    if (!color) return;

    editorRef.current?.focus();
    if (seleccion.current) {
      const actual = window.getSelection();
      actual?.removeAllRanges();
      actual?.addRange(seleccion.current);
    }

    // Aquí sí se quiere CSS: sin esto el navegador escribe <font color="…">,
    // una etiqueta que el saneado descarta, y el color se perdería al guardar.
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("foreColor", false, color);

    emitir();
    setUltimoColor(color);
    setPaletaAbierta(false);
  }

  const codigoValido = normalizarColor(codigo);

  return (
    <div className="rounded-md border border-slate-300 bg-white shadow-sm focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-1.5">
        {BOTONES.map((boton) => (
          <button
            key={boton.comando}
            type="button"
            title={boton.titulo}
            // Hay varios editores en pantalla: la etiqueta lleva el campo para
            // que cada botón se distinga del de al lado.
            aria-label={`${boton.titulo} en ${etiqueta}`}
            // Sin esto el clic quita el foco del editor y se pierde la
            // selección antes de aplicar el formato.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => ejecutar(boton.comando)}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            {boton.icono}
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />

        <div className="relative" ref={paletaRef}>
          <button
            type="button"
            title="Color del texto"
            aria-label={`Color del texto en ${etiqueta}`}
            aria-expanded={paletaAbierta}
            onMouseDown={(e) => e.preventDefault()}
            onClick={alternarPaleta}
            className="flex h-7 items-center gap-1 rounded px-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <span className="flex flex-col items-center leading-none">
              <span className="text-sm font-semibold">A</span>
              <span
                className="mt-0.5 h-1.5 w-4 rounded-sm"
                style={{ backgroundColor: ultimoColor }}
              />
            </span>
            <svg viewBox="0 0 20 20" {...trazo} className="h-3 w-3">
              <path d="M6 8l4 4 4-4" />
            </svg>
          </button>

          {paletaAbierta && (
            <div className="absolute left-0 top-9 z-20 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
              <p className="mb-2 text-xs font-medium text-slate-600">Colores:</p>
              <PaletaHexagonal onElegir={aplicarColor} />

              <div className="mt-2 flex items-center gap-1.5 border-t border-slate-200 pt-2">
                <span className="text-sm text-slate-400">#</span>
                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    aplicarColor(codigo);
                  }}
                  placeholder="dc2626"
                  aria-label="Color en código hexadecimal"
                  className="w-full min-w-0 rounded border border-slate-300 px-2 py-1 font-mono text-xs text-slate-900 outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => aplicarColor(codigo)}
                  disabled={!codigoValido}
                  className="shrink-0 rounded boton-accion px-2 py-1 text-xs font-semibold text-white transition-colors"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        {estaVacio(value) && (
          <p className="pointer-events-none absolute left-3 top-2 text-sm text-slate-400">
            {placeholder}
          </p>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={etiqueta}
          onInput={emitir}
          onBlur={emitir}
          className={`max-h-72 min-h-24 overflow-auto px-3 py-2 text-sm text-slate-900 outline-none ${CLASES_CONTENIDO} [&_hr]:my-3 [&_hr]:border-slate-300`}
        />
      </div>
    </div>
  );
}
