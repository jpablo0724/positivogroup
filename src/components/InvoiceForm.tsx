import { useState } from "react";
import {
  FORMAS_PAGO,
  PRODUCTOS,
  type InvoiceData,
  type InvoiceItem,
} from "../types";
import { PRODUCTOS_INFO } from "../data/productosInfo";
import { formatCurrency, formatNumber } from "../utils/calculations";
import SearchableSelect, { selectTriggerClass } from "./SearchableSelect";

interface InvoiceFormProps {
  data: InvoiceData;
  onChange: (data: InvoiceData) => void;
}

const inputClass = selectTriggerClass;

const labelClass = "mb-1 block text-xs font-medium text-slate-600";

// Cantidad y precio se guardan como texto para que el campo pueda quedar
// vacío en vez de mostrar un 0 que hay que borrar antes de escribir.
interface Draft {
  nombreProducto: string;
  descripcionProducto: string;
  cantidad: string;
  precioUnitario: string;
}

const draftVacio: Draft = {
  nombreProducto: "",
  descripcionProducto: "",
  cantidad: "",
  precioUnitario: "",
};

// Separador entre las observaciones de un producto y las del siguiente. Se
// escribe como "---" en su propia línea, y la factura lo dibuja como una
// línea divisoria. Es un marcador explícito porque las observaciones de un
// mismo producto ya contienen líneas en blanco entre sus párrafos.
export const SEPARADOR_OBSERVACIONES = "\n\n---\n\n";

// Une las observaciones de todos los productos de la cotización, una debajo
// de otra y divididas entre sí. Omite las repetidas para que dos productos
// que comparten observaciones no las dupliquen.
function observacionesDeProductos(nombresProducto: string[]): string {
  const vistas = new Set<string>();
  const bloques: string[] = [];

  for (const nombre of nombresProducto) {
    const observaciones = PRODUCTOS_INFO[nombre]?.observaciones?.trim();
    if (observaciones && !vistas.has(observaciones)) {
      vistas.add(observaciones);
      bloques.push(observaciones);
    }
  }

  return bloques.join(SEPARADOR_OBSERVACIONES);
}

export default function InvoiceForm({ data, onChange }: InvoiceFormProps) {
  const [draft, setDraft] = useState<Draft>(draftVacio);
  // id del producto que se está editando; null mientras se captura uno nuevo.
  const [editandoId, setEditandoId] = useState<string | null>(null);

  function updateCliente<K extends keyof InvoiceData["cliente"]>(
    field: K,
    value: InvoiceData["cliente"][K],
  ) {
    onChange({ ...data, cliente: { ...data.cliente, [field]: value } });
  }

  function updateField<K extends keyof InvoiceData>(
    field: K,
    value: InvoiceData[K],
  ) {
    onChange({ ...data, [field]: value });
  }

  function updateDraft<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function selectProducto(nombreProducto: string) {
    const info = PRODUCTOS_INFO[nombreProducto];
    setDraft((prev) => ({
      ...prev,
      nombreProducto,
      descripcionProducto: info?.descripcion ?? "",
    }));

    // Al editar se sustituye el producto de ese ítem; al capturar uno nuevo
    // se suma al final.
    const nombres = editandoId
      ? data.items.map((item) =>
          item.id === editandoId ? nombreProducto : item.nombreProducto,
        )
      : [...data.items.map((item) => item.nombreProducto), nombreProducto];

    onChange({ ...data, observaciones: observacionesDeProductos(nombres) });
  }

  const draftValido =
    draft.nombreProducto !== "" &&
    Number(draft.cantidad) > 0 &&
    Number(draft.precioUnitario) > 0;

  function guardarProducto() {
    if (!draftValido) return;

    const producto = {
      nombreProducto: draft.nombreProducto,
      descripcionProducto: draft.descripcionProducto,
      cantidad: Number(draft.cantidad),
      precioUnitario: Number(draft.precioUnitario),
    };

    const items = editandoId
      ? data.items.map((item) =>
          item.id === editandoId ? { ...item, ...producto } : item,
        )
      : [...data.items, { id: crypto.randomUUID(), ...producto }];

    onChange({
      ...data,
      items,
      observaciones: observacionesDeProductos(
        items.map((item) => item.nombreProducto),
      ),
    });
    setDraft(draftVacio);
    setEditandoId(null);
  }

  function editarProducto(item: InvoiceItem) {
    setDraft({
      nombreProducto: item.nombreProducto,
      descripcionProducto: item.descripcionProducto,
      cantidad: String(item.cantidad),
      precioUnitario: String(item.precioUnitario),
    });
    setEditandoId(item.id);
  }

  function cancelarEdicion() {
    setDraft(draftVacio);
    setEditandoId(null);
  }

  function removeItem(id: string) {
    const items = data.items.filter((item) => item.id !== id);
    const enEdicion = editandoId === id;

    onChange({
      ...data,
      items,
      observaciones: observacionesDeProductos([
        ...items.map((item) => item.nombreProducto),
        enEdicion ? "" : draft.nombreProducto,
      ]),
    });

    // Si se elimina el producto que se estaba editando, se limpia el formulario.
    if (enEdicion) {
      setDraft(draftVacio);
      setEditandoId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Datos del cliente
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Razón social</label>
            <input
              className={inputClass}
              value={data.cliente.razonSocial}
              onChange={(e) => updateCliente("razonSocial", e.target.value)}
              placeholder="Positivo Group S.A.S."
            />
          </div>
          <div>
            <label className={labelClass}>NIT</label>
            <input
              className={inputClass}
              value={data.cliente.nit}
              onChange={(e) => updateCliente("nit", e.target.value)}
              placeholder="900.000.000-1"
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              className={inputClass}
              value={data.cliente.email}
              onChange={(e) => updateCliente("email", e.target.value)}
              placeholder="contacto@positivogroup.com"
            />
          </div>
          <div>
            <label className={labelClass}>Contacto</label>
            <input
              className={inputClass}
              value={data.cliente.contacto}
              onChange={(e) => updateCliente("contacto", e.target.value)}
              placeholder="Nombre del contacto"
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Datos de la factura
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Fecha</label>
            <input
              type="date"
              className={inputClass}
              value={data.fecha}
              onChange={(e) => updateField("fecha", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Válida hasta</label>
            <input
              type="date"
              className={inputClass}
              value={data.validaHasta}
              onChange={(e) => updateField("validaHasta", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Forma de pago</label>
            <SearchableSelect
              value={data.formaPago}
              onChange={(value) => updateField("formaPago", value)}
              options={FORMAS_PAGO}
              placeholder="Selecciona una opción"
            />
          </div>
          <div>
            <label className={labelClass}>IVA (%)</label>
            <input
              type="number"
              min={0}
              step="0.1"
              className={inputClass}
              value={data.ivaPorcentaje}
              onChange={(e) =>
                updateField("ivaPorcentaje", Number(e.target.value) || 0)
              }
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Productos
        </h2>

        {data.items.length > 0 && (
          <div className="mb-4 space-y-2">
            {data.items.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${
                  editandoId === item.id
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {index + 1}. {item.nombreProducto}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Cantidad: {formatNumber(item.cantidad)} · Precio unitario:{" "}
                    {formatCurrency(item.precioUnitario)}
                  </p>
                  {editandoId === item.id && (
                    <p className="mt-1 text-xs font-medium text-emerald-700">
                      Editando abajo
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    onClick={() => editarProducto(item)}
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-xs font-medium text-red-500 hover:text-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>Nombre producto</label>
              <SearchableSelect
                value={draft.nombreProducto}
                onChange={selectProducto}
                options={PRODUCTOS}
                placeholder="Selecciona un producto"
              />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Descripción del producto</label>
              <textarea
                className={inputClass}
                rows={4}
                value={draft.descripcionProducto}
                onChange={(e) =>
                  updateDraft("descripcionProducto", e.target.value)
                }
                placeholder="Se completa automáticamente al elegir el producto"
              />
            </div>
            <div>
              <label className={labelClass}>Cantidad</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={draft.cantidad}
                onChange={(e) => updateDraft("cantidad", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelClass}>Precio unitario</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={draft.precioUnitario}
                onChange={(e) => updateDraft("precioUnitario", e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={guardarProducto}
              disabled={!draftValido}
              className="w-full rounded-md bg-emerald-600 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {editandoId ? "Guardar cambios" : "Agregar producto"}
            </button>
            {editandoId && (
              <button
                type="button"
                onClick={cancelarEdicion}
                className="shrink-0 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
              >
                Cancelar
              </button>
            )}
          </div>

          <p className="mt-2 text-[11px] text-slate-400">
            {editandoId
              ? "Estás editando un producto ya agregado a la cotización."
              : "Se agrega a la cotización y los campos quedan vacíos para seguir agregando productos."}
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Observaciones
        </h2>
        <textarea
          className={inputClass}
          rows={3}
          value={data.observaciones}
          onChange={(e) => updateField("observaciones", e.target.value)}
          placeholder="Notas adicionales para el cliente"
        />
      </section>
    </div>
  );
}
