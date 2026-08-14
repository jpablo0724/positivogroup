import { useState } from "react";
import { FORMAS_PAGO, PRODUCTOS, type InvoiceData } from "../types";
import { PRODUCTOS_INFO } from "../data/productosInfo";
import { formatCurrency, formatNumber } from "../utils/calculations";
import SearchableSelect, { selectTriggerClass } from "./SearchableSelect";

interface InvoiceFormProps {
  data: InvoiceData;
  onChange: (data: InvoiceData) => void;
}

const inputClass = selectTriggerClass;

const labelClass = "mb-1 block text-xs font-medium text-slate-600";

interface Draft {
  nombreProducto: string;
  descripcionProducto: string;
  cantidad: number;
  precioUnitario: number;
}

const draftVacio: Draft = {
  nombreProducto: "",
  descripcionProducto: "",
  cantidad: 0,
  precioUnitario: 0,
};

export default function InvoiceForm({ data, onChange }: InvoiceFormProps) {
  const [draft, setDraft] = useState<Draft>(draftVacio);

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
    if (info?.observaciones) {
      onChange({ ...data, observaciones: info.observaciones });
    }
  }

  const draftValido =
    draft.nombreProducto !== "" && draft.cantidad > 0 && draft.precioUnitario > 0;

  function agregarProducto() {
    if (!draftValido) return;
    onChange({
      ...data,
      items: [...data.items, { id: crypto.randomUUID(), ...draft }],
    });
    setDraft(draftVacio);
  }

  function removeItem(id: string) {
    onChange({ ...data, items: data.items.filter((item) => item.id !== id) });
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
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {index + 1}. {item.nombreProducto}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Cantidad: {formatNumber(item.cantidad)} · Precio unitario:{" "}
                    {formatCurrency(item.precioUnitario)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="shrink-0 text-xs font-medium text-red-500 hover:text-red-600"
                >
                  Eliminar
                </button>
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
                onChange={(e) =>
                  updateDraft("cantidad", Number(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <label className={labelClass}>Precio unitario</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={draft.precioUnitario}
                onChange={(e) =>
                  updateDraft("precioUnitario", Number(e.target.value) || 0)
                }
              />
            </div>
          </div>

          <button
            type="button"
            onClick={agregarProducto}
            disabled={!draftValido}
            className="mt-3 w-full rounded-md bg-emerald-600 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Agregar producto
          </button>

          <p className="mt-2 text-[11px] text-slate-400">
            Se agrega a la cotización y los campos quedan vacíos para seguir
            agregando productos.
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
