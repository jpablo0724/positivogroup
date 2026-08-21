import type { CotizacionGuardada } from "../types";
import { calcInvoiceTotals, formatCurrency, formatDateLong } from "../utils/calculations";

interface ListadoCotizacionesProps {
  cotizaciones: CotizacionGuardada[];
  onVer: (cotizacion: CotizacionGuardada) => void;
  onVerPdf: (cotizacion: CotizacionGuardada) => void;
  onEnviarClientify: (cotizacion: CotizacionGuardada) => void;
  onEliminar: (numeroFactura: string) => void;
}

const trazo = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const ICONOS = {
  editar: (
    <svg viewBox="0 0 24 24" {...trazo} className="h-4 w-4">
      <path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  ),
  pdf: (
    <svg viewBox="0 0 24 24" {...trazo} className="h-4 w-4">
      <path d="M9 2h6l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
      <path d="M14 2v5h5" />
      <path d="M12 11v6" />
      <path d="m9.5 14.5 2.5 2.5 2.5-2.5" />
    </svg>
  ),
  enviar: (
    <svg viewBox="0 0 24 24" {...trazo} className="h-4 w-4">
      <path d="M21 3 10.5 13.5" />
      <path d="M21 3l-6.5 18-4-8-8-4Z" />
    </svg>
  ),
  eliminar: (
    <svg viewBox="0 0 24 24" {...trazo} className="h-4 w-4">
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  ),
};

const TONOS = {
  neutro:
    "text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-slate-400",
  verde:
    "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-emerald-500",
  rojo: "text-red-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-red-400",
};

/**
 * Botón de solo icono. El nombre va en `title` y en `aria-label`, así que se
 * ve al pasar el mouse y lo leen los lectores de pantalla.
 */
function BotonIcono({
  titulo,
  onClick,
  icono,
  tono = "neutro",
}: {
  titulo: string;
  onClick: () => void;
  icono: React.ReactNode;
  tono?: keyof typeof TONOS;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${TONOS[tono]}`}
    >
      {icono}
    </button>
  );
}

export default function ListadoCotizaciones({
  cotizaciones,
  onVer,
  onVerPdf,
  onEnviarClientify,
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
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">N.º</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Válida hasta</th>
              <th className="px-4 py-3 text-right">Total antes de IVA</th>
              <th className="px-4 py-3">Guardada</th>
              <th className="px-4 py-3 text-right">Acciones</th>
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
                    <div className="flex items-center justify-end gap-1">
                      <BotonIcono
                        titulo="Abrir para editar"
                        onClick={() => onVer(c)}
                        icono={ICONOS.editar}
                      />
                      <BotonIcono
                        titulo="Guardar en PDF"
                        onClick={() => onVerPdf(c)}
                        icono={ICONOS.pdf}
                      />
                      <BotonIcono
                        titulo="Enviar a Clientify"
                        onClick={() => onEnviarClientify(c)}
                        icono={ICONOS.enviar}
                        tono="verde"
                      />
                      <BotonIcono
                        titulo="Eliminar"
                        onClick={() => onEliminar(c.data.numeroFactura)}
                        icono={ICONOS.eliminar}
                        tono="rojo"
                      />
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
