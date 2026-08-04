import type { InvoiceData } from "../types";
import {
  calcInvoiceTotals,
  calcItemTotals,
  formatCurrency,
  formatDateLong,
  formatNumber,
} from "../utils/calculations";

interface InvoicePreviewProps {
  data: InvoiceData;
}

export default function InvoicePreview({ data }: InvoicePreviewProps) {
  const totals = calcInvoiceTotals(data.items, data.ivaPorcentaje);
  const hasItems = data.items.some(
    (item) => item.descripcionProducto || item.cantidad || item.precioUnitario,
  );

  return (
    <div
      id="invoice-preview"
      className="mx-auto w-full max-w-[850px] bg-white p-10 text-slate-800 shadow-lg"
    >
      <header className="flex items-start justify-between border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500 text-base font-bold text-white">
            PG
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">Positivo Group</p>
            <p className="text-xs text-slate-500">Sistema de facturación</p>
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold text-slate-900">FACTURA</h1>
          <p className="text-sm text-slate-500">
            N.º{" "}
            <span className="font-semibold text-slate-700">
              {data.numeroFactura || "—"}
            </span>
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 py-6">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Facturar a
          </p>
          <p className="text-sm font-semibold text-slate-900">
            {data.cliente.razonSocial || "Razón social del cliente"}
          </p>
          <p className="text-sm text-slate-600">
            NIT: {data.cliente.nit || "—"}
          </p>
          <p className="text-sm text-slate-600">
            {data.cliente.email || "—"}
          </p>
          <p className="text-sm text-slate-600">
            Contacto: {data.cliente.contacto || "—"}
          </p>
        </div>
        <div className="text-sm text-slate-600">
          <div className="grid grid-cols-2 gap-y-1.5">
            <span className="text-slate-400">Fecha</span>
            <span className="text-right font-medium text-slate-800">
              {formatDateLong(data.fecha) || "—"}
            </span>
            <span className="text-slate-400">Válida hasta</span>
            <span className="text-right font-medium text-slate-800">
              {formatDateLong(data.validaHasta) || "—"}
            </span>
            <span className="text-slate-400">Forma de pago</span>
            <span className="text-right font-medium text-slate-800">
              {data.formaPago || "—"}
            </span>
          </div>
        </div>
      </section>

      {data.descripcion && (
        <section className="mb-6 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {data.descripcion}
        </section>
      )}

      <section className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-300 text-left text-[10px] uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-2">Producto</th>
              <th className="py-2 pr-2">Ciudad</th>
              <th className="py-2 pr-2">Quincena</th>
              <th className="py-2 pr-2 text-right">Cant.</th>
              <th className="py-2 pr-2 text-right">Precio unit.</th>
              <th className="py-2 pr-2 text-right">Inv. antes IVA</th>
              <th className="py-2 pr-2 text-right">Impactos 15d</th>
              <th className="py-2 pr-2 text-right">Costo/impacto</th>
              <th className="py-2 pr-2 text-right">Subtotal</th>
              <th className="py-2 pr-2 text-right">IVA</th>
            </tr>
          </thead>
          <tbody>
            {hasItems ? (
              data.items.map((item) => {
                const t = calcItemTotals(item, data.ivaPorcentaje);
                return (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2 font-medium text-slate-800">
                      {item.descripcionProducto || "—"}
                    </td>
                    <td className="py-2 pr-2 text-slate-600">
                      {item.ciudad || "—"}
                    </td>
                    <td className="py-2 pr-2 text-slate-600">
                      {item.quincena || "—"}
                    </td>
                    <td className="py-2 pr-2 text-right text-slate-600">
                      {formatNumber(item.cantidad)}
                    </td>
                    <td className="py-2 pr-2 text-right text-slate-600">
                      {formatCurrency(item.precioUnitario)}
                    </td>
                    <td className="py-2 pr-2 text-right text-slate-600">
                      {formatCurrency(t.inversionTotalAntesIva)}
                    </td>
                    <td className="py-2 pr-2 text-right text-slate-600">
                      {formatNumber(item.impactosPromedio15Dias)}
                    </td>
                    <td className="py-2 pr-2 text-right text-slate-600">
                      {formatCurrency(t.costoPorImpacto)}
                    </td>
                    <td className="py-2 pr-2 text-right text-slate-600">
                      {formatCurrency(t.subtotal)}
                    </td>
                    <td className="py-2 pr-2 text-right text-slate-600">
                      {formatCurrency(t.iva)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={10}
                  className="py-6 text-center text-slate-400"
                >
                  Agrega productos en el formulario para verlos aquí
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-6 flex justify-end">
        <div className="w-64 text-sm">
          <div className="flex justify-between border-b border-slate-100 py-1.5">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium text-slate-800">
              {formatCurrency(totals.subtotal)}
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-100 py-1.5">
            <span className="text-slate-500">IVA ({data.ivaPorcentaje}%)</span>
            <span className="font-medium text-slate-800">
              {formatCurrency(totals.iva)}
            </span>
          </div>
          <div className="flex justify-between py-2 text-base">
            <span className="font-semibold text-slate-900">Total</span>
            <span className="font-bold text-emerald-600">
              {formatCurrency(totals.total)}
            </span>
          </div>
        </div>
      </section>

      {data.observaciones && (
        <section className="mt-6 border-t border-slate-200 pt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Observaciones
          </p>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">
            {data.observaciones}
          </p>
        </section>
      )}
    </div>
  );
}
