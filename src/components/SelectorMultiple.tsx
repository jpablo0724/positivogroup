import { useEffect, useRef, useState } from "react";
import { selectTriggerClass } from "./SearchableSelect";

export interface GrupoOpciones {
  titulo?: string;
  opciones: { valor: string; nombre: string }[];
}

interface SelectorMultipleProps {
  grupos: GrupoOpciones[];
  elegidos: string[];
  onCambiar: (elegidos: string[]) => void;
  /** Texto del botón cuando no hay nada elegido. */
  textoVacio: string;
  /** Texto del botón cuando está todo elegido; si falta, se cuentan. */
  textoTodos?: string;
}

/** Desplegable con casillas para elegir varias opciones a la vez. */
export default function SelectorMultiple({
  grupos,
  elegidos,
  onCambiar,
  textoVacio,
  textoTodos,
}: SelectorMultipleProps) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function alClicFuera(e: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) {
        setAbierto(false);
        setBusqueda("");
      }
    }
    document.addEventListener("mousedown", alClicFuera);
    return () => document.removeEventListener("mousedown", alClicFuera);
  }, [abierto]);

  const todas = grupos.flatMap((g) => g.opciones);
  const marcadas = new Set(elegidos);
  const nombres = todas.filter((o) => marcadas.has(o.valor)).map((o) => o.nombre);
  const texto =
    nombres.length === 0
      ? textoVacio
      : nombres.length === todas.length && textoTodos
        ? textoTodos
        : nombres.length <= 2
          ? nombres.join(", ")
          : `${nombres.length} seleccionados`;

  const alternar = (valor: string) =>
    onCambiar(marcadas.has(valor) ? elegidos.filter((v) => v !== valor) : [...elegidos, valor]);

  const q = busqueda.trim().toLowerCase();
  const visibles = grupos
    .map((g) => ({ ...g, opciones: g.opciones.filter((o) => o.nombre.toLowerCase().includes(q)) }))
    .filter((g) => g.opciones.length > 0);

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className={`${selectTriggerClass} flex items-center justify-between gap-2 text-left`}
      >
        <span className="truncate">{texto}</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0 text-slate-400"
        >
          <path d="m5 8 5 5 5-5" />
        </svg>
      </button>

      {abierto && (
        <div className="absolute z-30 mt-1 w-full min-w-[260px] rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 p-1.5">
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar..."
              className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => onCambiar(todas.map((o) => o.valor))}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => onCambiar([])}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Limpiar
            </button>
          </div>
          <ul className="max-h-72 overflow-auto py-1 text-sm">
            {visibles.length === 0 && (
              <li className="px-3 py-1.5 text-xs text-slate-400">Sin resultados</li>
            )}
            {visibles.map((g, i) => (
              <li key={g.titulo ?? i}>
                {g.titulo && (
                  <p className="px-3 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {g.titulo}
                  </p>
                )}
                {g.opciones.map((o) => (
                  <label
                    key={o.valor}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={marcadas.has(o.valor)}
                      onChange={() => alternar(o.valor)}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    <span className="truncate">{o.nombre}</span>
                  </label>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
