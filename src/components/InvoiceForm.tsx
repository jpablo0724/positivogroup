import { useState } from "react";
import {
  CIUDADES,
  FORMAS_PAGO,
  PRODUCTOS,
  QUINCENAS,
  type InvoiceData,
  type InvoiceItem,
} from "../types";
import SearchableSelect, { selectTriggerClass } from "./SearchableSelect";

interface InvoiceFormProps {
  data: InvoiceData;
  onChange: (data: InvoiceData) => void;
}

const inputClass = selectTriggerClass;

const labelClass = "mb-1 block text-xs font-medium text-slate-600";

export default function InvoiceForm({ data, onChange }: InvoiceFormProps) {
  const [customCityIds, setCustomCityIds] = useState<Set<string>>(new Set());

  function isCiudadCustom(item: InvoiceItem) {
    return (
      customCityIds.has(item.id) ||
      (item.ciudad !== "" &&
        !(CIUDADES as readonly string[]).includes(item.ciudad))
    );
  }

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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Producto
        </h2>

        <div className="space-y-4">
          {data.items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelClass}>Descripción del producto</label>
                  <SearchableSelect
                    value={item.descripcionProducto}
                    onChange={(value) =>
                      updateItem(item.id, { descripcionProducto: value })
                    }
                    options={PRODUCTOS}
                    placeholder="Selecciona un producto"
                  />
                </div>
                <div>
                  <label className={labelClass}>Ciudad</label>
                  {isCiudadCustom(item) ? (
                    <div className="flex gap-1">
                      <input
                        className={inputClass}
                        value={item.ciudad}
                        onChange={(e) =>
                          updateItem(item.id, { ciudad: e.target.value })
                        }
                        placeholder="Escribe la ciudad"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCustomCityIds((prev) => {
                            const next = new Set(prev);
                            next.delete(item.id);
                            return next;
                          });
                          updateItem(item.id, { ciudad: "" });
                        }}
                        title="Elegir de la lista"
                        className="shrink-0 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-500 shadow-sm hover:bg-slate-100"
                      >
                        Lista
                      </button>
                    </div>
                  ) : (
                    <SearchableSelect
                      value={item.ciudad}
                      onChange={(value) => updateItem(item.id, { ciudad: value })}
                      options={CIUDADES}
                      placeholder="Selecciona una ciudad"
                      extraOptionLabel="+ Agregar si no existe"
                      onExtraOption={() => {
                        setCustomCityIds((prev) => new Set(prev).add(item.id));
                        updateItem(item.id, { ciudad: "" });
                      }}
                    />
                  )}
                </div>
                <div>
                  <label className={labelClass}>Quincena</label>
                  <SearchableSelect
                    value={item.quincena}
                    onChange={(value) => updateItem(item.id, { quincena: value })}
                    options={QUINCENAS}
                    placeholder="Selecciona la quincena"
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
