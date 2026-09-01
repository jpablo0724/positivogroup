import { useEffect, useRef } from "react";
import {
  CLASES_CONTENIDO,
  COLORES_TEXTO,
  aHtml,
  estaVacio,
} from "../utils/richText";

interface EditorObservacionesProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
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
}: EditorObservacionesProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const ultimoEmitido = useRef<string | null>(null);

  useEffect(() => {
    if (value === ultimoEmitido.current) return;

    const editor = editorRef.current;
    if (!editor) return;

    const deseado = aHtml(value);
    if (editor.innerHTML !== deseado) editor.innerHTML = deseado;
  }, [value]);

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

  function aplicarColor(color: string) {
    editorRef.current?.focus();
    // Aquí sí se quiere CSS: sin esto el navegador escribe <font color="…">,
    // una etiqueta que el saneado descarta, y el color se perdería al guardar.
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("foreColor", false, color);
    emitir();
  }

  return (
    <div className="rounded-md border border-slate-300 bg-white shadow-sm focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-1.5">
        {BOTONES.map((boton) => (
          <button
            key={boton.comando}
            type="button"
            title={boton.titulo}
            aria-label={boton.titulo}
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

        {COLORES_TEXTO.map((color) => (
          <button
            key={color.valor}
            type="button"
            title={`Texto en ${color.nombre.toLowerCase()}`}
            aria-label={`Texto en ${color.nombre.toLowerCase()}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => aplicarColor(color.valor)}
            className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-slate-100"
          >
            <span
              className="h-3.5 w-3.5 rounded-full ring-1 ring-slate-300"
              style={{ backgroundColor: color.valor }}
            />
          </button>
        ))}
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
          aria-label="Observaciones"
          onInput={emitir}
          onBlur={emitir}
          className={`max-h-72 min-h-24 overflow-auto px-3 py-2 text-sm text-slate-900 outline-none ${CLASES_CONTENIDO} [&_hr]:my-3 [&_hr]:border-slate-300`}
        />
      </div>
    </div>
  );
}
