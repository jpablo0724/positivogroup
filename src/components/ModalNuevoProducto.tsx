import { useEffect, useState } from "react";
import type { ProductoPersonalizado } from "../utils/productosPersonalizados";
import { selectTriggerClass } from "./SearchableSelect";

interface ModalNuevoProductoProps {
  abierto: boolean;
  /** Nombres ya usados, para no crear dos productos iguales. */
  nombresExistentes: readonly string[];
  onGuardar: (producto: ProductoPersonalizado) => void;
  onCerrar: () => void;
}

const labelClass = "mb-1 block text-xs font-medium text-slate-600";

const vacio: ProductoPersonalizado = {
  nombre: "",
  descripcion: "",
  observaciones: "",
};

/**
 * Ventana para crear un producto nuevo con su descripción y observaciones.
 * Queda guardado en el catálogo para reutilizarlo en otras cotizaciones.
 */
export default function ModalNuevoProducto({
  abierto,
  nombresExistentes,
  onGuardar,
  onCerrar,
}: ModalNuevoProductoProps) {
  const [producto, setProducto] = useState<ProductoPersonalizado>(vacio);

  // Cada vez que se abre, empieza en blanco.
  useEffect(() => {
    if (abierto) setProducto(vacio);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  const nombre = producto.nombre.trim();
  const repetido = nombresExistentes.some(
    (existente) => existente.toLowerCase() === nombre.toLowerCase(),
  );
  const valido = nombre !== "" && !repetido;

  function actualizar<K extends keyof ProductoPersonalizado>(
    campo: K,
    valor: ProductoPersonalizado[K],
  ) {
    setProducto((prev) => ({ ...prev, [campo]: valor }));
  }

  function guardar() {
    if (!valido) return;
    onGuardar({ ...producto, nombre });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={onCerrar}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Agregar producto"
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Agregar producto
            </h2>
            <p className="text-xs text-slate-500">
              Queda guardado en el catálogo para próximas cotizaciones.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="m5 5 10 10M15 5 5 15" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 overflow-auto px-5 py-4">
          <div>
            <label className={labelClass}>Nombre del producto</label>
            <input
              autoFocus
              className={selectTriggerClass}
              value={producto.nombre}
              onChange={(e) => actualizar("nombre", e.target.value)}
              placeholder="Ej: P11 - Publicidad en parqueaderos residenciales"
            />
            {repetido && (
              <p className="mt-1 text-xs text-red-600">
                Ya existe un producto con ese nombre.
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Descripción del producto</label>
            <textarea
              className={selectTriggerClass}
              rows={6}
              value={producto.descripcion}
              onChange={(e) => actualizar("descripcion", e.target.value)}
              placeholder="Lo que se carga en la cotización al elegir el producto"
            />
          </div>

          <div>
            <label className={labelClass}>Observaciones</label>
            <textarea
              className={selectTriggerClass}
              rows={6}
              value={producto.observaciones}
              onChange={(e) => actualizar("observaciones", e.target.value)}
              placeholder="Condiciones del servicio, qué incluye y qué no incluye"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={!valido}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Guardar producto
          </button>
        </div>
      </div>
    </div>
  );
}
