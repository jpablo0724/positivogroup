import { useState } from "react";
import {
  eliminarProducto,
  guardarProducto,
  type Producto,
} from "../utils/catalogo";
import ModalProducto, { type DatosProducto } from "./ModalNuevoProducto";
import { CLASES_CONTENIDO, aHtml } from "../utils/richText";

/** El texto sin etiquetas, para las líneas de resumen y la búsqueda. */
function resumen(valor: string): string {
  return valor
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Descripción u observaciones con su formato, o una raya si están vacías. */
function TextoConFormato({ valor }: { valor: string }) {
  const html = aHtml(valor);
  if (html === "") return <p className="text-slate-700">—</p>;
  return (
    <div
      className={`text-slate-700 ${CLASES_CONTENIDO}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface CatalogoProductosProps {
  productos: Producto[];
  onProductosChange: (productos: Producto[]) => void;
  onError: (err: unknown) => void;
}

/**
 * Catálogo completo, tal como está en la base de datos. Desde aquí se crean,
 * editan y borran los productos, incluidos los servicios con los que arrancó
 * el sistema.
 */
export default function CatalogoProductos({
  productos,
  onProductosChange,
  onError,
}: CatalogoProductosProps) {
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<DatosProducto | null>(null);
  const [porEliminar, setPorEliminar] = useState<Producto | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  const consulta = busqueda.trim().toLowerCase();
  const visibles = consulta
    ? productos.filter(
        (p) =>
          p.nombre.toLowerCase().includes(consulta) ||
          resumen(p.descripcion).toLowerCase().includes(consulta),
      )
    : productos;

  function abrirNuevo() {
    setEditando(null);
    setModalAbierto(true);
  }

  function abrirEdicion(producto: Producto) {
    setEditando({
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      observaciones: producto.observaciones,
    });
    setModalAbierto(true);
  }

  async function guardar(datos: DatosProducto, nombreAnterior?: string) {
    setModalAbierto(false);
    setOcupado(true);
    try {
      onProductosChange(await guardarProducto(datos, nombreAnterior));
    } catch (err) {
      onError(err);
    } finally {
      setOcupado(false);
    }
  }

  async function confirmarEliminar() {
    if (!porEliminar) return;
    const nombre = porEliminar.nombre;
    setPorEliminar(null);
    setOcupado(true);
    try {
      onProductosChange(await eliminarProducto(nombre));
    } catch (err) {
      onError(err);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-8 py-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto…"
          className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {visibles.length} de {productos.length}
          </span>
          <button
            type="button"
            onClick={abrirNuevo}
            disabled={ocupado}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:bg-slate-300"
          >
            + Agregar producto
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {productos.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            El catálogo está vacío. Usa "+ Agregar producto" para empezar.
          </p>
        ) : (
          <div className="space-y-2">
            {visibles.map((producto) => {
              const abierto = expandido === producto.nombre;
              return (
                <div
                  key={producto.nombre}
                  className="rounded-lg border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4 p-4">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandido(abierto ? null : producto.nombre)
                      }
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-sm font-medium text-slate-800">
                        {producto.nombre}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {resumen(producto.descripcion) || "Sin descripción"}
                      </p>
                    </button>

                    <div className="flex shrink-0 gap-3">
                      <button
                        type="button"
                        onClick={() => abrirEdicion(producto)}
                        disabled={ocupado}
                        className="text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:text-slate-300"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setPorEliminar(producto)}
                        disabled={ocupado}
                        className="text-xs font-medium text-red-500 hover:text-red-600 disabled:text-slate-300"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {abierto && (
                    <div className="space-y-3 border-t border-slate-100 px-4 py-3 text-xs">
                      <div>
                        <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
                          Descripción
                        </p>
                        <TextoConFormato valor={producto.descripcion} />
                      </div>
                      <div>
                        <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
                          Observaciones
                        </p>
                        <TextoConFormato valor={producto.observaciones} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {visibles.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-500">
                Ningún producto coincide con "{busqueda}".
              </p>
            )}
          </div>
        )}
      </div>

      <ModalProducto
        abierto={modalAbierto}
        inicial={editando}
        nombresExistentes={productos.map((p) => p.nombre)}
        onGuardar={guardar}
        onCerrar={() => setModalAbierto(false)}
      />

      {porEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setPorEliminar(null)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-base font-semibold text-slate-900">
              Eliminar producto
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Se va a eliminar <strong>{porEliminar.nombre}</strong> del
              catálogo, para todo el equipo.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Las cotizaciones ya guardadas que lo usen no se modifican:
              guardaron su propia copia del producto.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPorEliminar(null)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminar}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
