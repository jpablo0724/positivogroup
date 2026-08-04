import { FORMAS_PAGO, type InvoiceData, type InvoiceItem } from "../types";

interface InvoiceFormProps {
  data: InvoiceData;
  onChange: (data: InvoiceData) => void;
}

function emptyItem(): InvoiceItem {
  return {
    id: crypto.randomUUID(),
    descripcionProducto: "",
    ciudad: "",
    quincena: "",
    cantidad: 0,
    precioUnitario: 0,
    impactosPromedio15Dias: 0,
  };
}

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

const labelClass = "mb-1 block text-xs font-medium text-slate-600";

export default function InvoiceForm({ data, onChange }: InvoiceFormProps) {
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

  function updateItem(id: string, patch: Partial<InvoiceItem>) {
    onChange({
      ...data,
      items: data.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  }

  function addItem() {
    onChange({ ...data, items: [...data.items, emptyItem()] });
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
            <label className={labelClass}>Número de factura</label>
            <input
              className={inputClass}
              value={data.numeroFactura}
              onChange={(e) => updateField("numeroFactura", e.target.value)}
            />
          </div>
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
            <select
              className={inputClass}
              value={data.formaPago}
              onChange={(e) => updateField("formaPago", e.target.value)}
            >
              <option value="" disabled>
                Selecciona una opción
              </option>
              {FORMAS_PAGO.map((forma) => (
                <option key={forma} value={forma}>
                  {forma}
                </option>
              ))}
            </select>
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
        <div className="mt-3">
          <label className={labelClass}>Descripción</label>
          <textarea
            className={inputClass}
            rows={2}
            value={data.descripcion}
            onChange={(e) => updateField("descripcion", e.target.value)}
            placeholder="Descripción general de la factura / campaña"
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Productos
          </h2>
          <button
            type="button"
            onClick={addItem}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            + Agregar producto
          </button>
        </div>

        <div className="space-y-4">
          {data.items.map((item, index) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Producto {index + 1}
                </span>
                {data.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-xs font-medium text-red-500 hover:text-red-600"
                  >
                    Eliminar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelClass}>Descripción del producto</label>
                  <input
                    className={inputClass}
                    value={item.descripcionProducto}
                    onChange={(e) =>
                      updateItem(item.id, {
                        descripcionProducto: e.target.value,
                      })
                    }
                    placeholder="Ej. Pauta valla digital"
                  />
                </div>
                <div>
                  <label className={labelClass}>Ciudad</label>
                  <input
                    className={inputClass}
                    value={item.ciudad}
                    onChange={(e) =>
                      updateItem(item.id, { ciudad: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>Quincena</label>
                  <input
                    className={inputClass}
                    value={item.quincena}
                    onChange={(e) =>
                      updateItem(item.id, { quincena: e.target.value })
                    }
                    placeholder="Ej. 1ra quincena julio"
                  />
                </div>
                <div>
                  <label className={labelClass}>Cantidad</label>
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={item.cantidad}
                    onChange={(e) =>
                      updateItem(item.id, {
                        cantidad: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <label className={labelClass}>Precio unitario</label>
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={item.precioUnitario}
                    onChange={(e) =>
                      updateItem(item.id, {
                        precioUnitario: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>
                    Impactos promedio 15 días
                  </label>
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={item.impactosPromedio15Dias}
                    onChange={(e) =>
                      updateItem(item.id, {
                        impactosPromedio15Dias: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <p className="mt-2 text-[11px] text-slate-400">
                Inversión total antes de IVA, costo por impacto, subtotal e
                IVA se calculan automáticamente en la factura.
              </p>
            </div>
          ))}
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
