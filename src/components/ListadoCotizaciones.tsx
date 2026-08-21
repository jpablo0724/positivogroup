import type { CotizacionGuardada } from "../types";
import { calcInvoiceTotals, formatCurrency, formatDateLong } from "../utils/calculations";

interface ListadoCotizacionesProps {
  cotizaciones: CotizacionGuardada[];
  onVer: (cotizacion: CotizacionGuardada) => void;
  onVerPdf: (cotizacion: CotizacionGuardada) => void;
  onEliminar: (numeroFactura: string) => void;
}

export default function ListadoCotizaciones({
  cotizaciones,
  onVer,
  onVerPdf,
  onEliminar,
}: ListadoCotizacionesProps) {
  if (cotizaciones.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="text-sm font-medium text-slate-700">
            Aún no hay cotizaciones guardadas
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Ve a "Crear Cotización" y usa el botón "Guardar cotización" para que
            aparezcan aquí.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">N.º</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Válida hasta</th>
              <th className="px-4 py-3 text-right">Total antes de IVA</th>
              <th className="px-4 py-3">Guardada</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {cotizaciones.map((c) => {
              const totals = calcInvoiceTotals(
                c.data.items,
                c.data.ivaPorcentaje,
              );
              return (
                <tr
                  key={c.data.numeroFactura}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {c.data.numeroFactura}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {c.data.cliente.razonSocial || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateLong(c.data.fecha) || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateLong(c.data.validaHasta) || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {formatCurrency(totals.subtotal)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(c.guardadoEn).toLocaleString("es-CO")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onVer(c)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => onVerPdf(c)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Ver en PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => onEliminar(c.data.numeroFactura)}
                        className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
