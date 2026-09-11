import { useEffect, useState } from "react";
import type { CotizacionGuardada } from "../types";
import { calcInvoiceTotals, formatCurrency, formatDateLong } from "../utils/calculations";
import { nombreCompleto, type UsuarioPublico } from "../utils/auth";
import { listarEquipo, type MiembroEquipo } from "../utils/cotizacionesGuardadas";

interface ListadoCotizacionesProps {
  cotizaciones: CotizacionGuardada[];
  usuarioActual: UsuarioPublico;
  onVer: (cotizacion: CotizacionGuardada) => void;
  onVerPdf: (cotizacion: CotizacionGuardada) => void;
  onEnviarClientify: (cotizacion: CotizacionGuardada) => void;
  onEliminar: (numeroFactura: string) => void;
  onReasignar: (numeroFactura: string, nuevoDueno: string) => void;
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
  historial: (
    <svg viewBox="0 0 24 24" {...trazo} className="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
};

function formatFechaHora(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(fecha);
}

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
  usuarioActual,
  onVer,
  onVerPdf,
  onEnviarClientify,
  onEliminar,
  onReasignar,
}: ListadoCotizacionesProps) {
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  const [porReasignar, setPorReasignar] = useState<{
    numeroFactura: string;
    nuevoDueno: string;
  } | null>(null);
  const [historialAbierto, setHistorialAbierto] =
    useState<CotizacionGuardada | null>(null);

  // Solo hace falta para el selector de reasignar: si falla, el listado
  // sigue viéndose igual, nada más sin esa columna con nombres.
  useEffect(() => {
    listarEquipo()
      .then(setEquipo)
      .catch(() => {});
  }, []);

  const nombresPorCorreo = new Map(
    equipo.map((m) => [m.email, nombreCompleto(m)]),
  );

  function nombreOCorreo(correo: string): string {
    return nombresPorCorreo.get(correo) || correo || "—";
  }

  function describirEntrada(entrada: NonNullable<
    CotizacionGuardada["historial"]
  >[number]): string {
    if (entrada.accion === "creada") return "Creada";
    if (entrada.accion === "editada") return "Editada";
    return entrada.nuevoDueno
      ? `Reasignada a ${nombreOCorreo(entrada.nuevoDueno)}`
      : "Se quitó la reasignación";
  }

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
              <th className="px-4 py-3">Creada por</th>
              <th className="px-4 py-3">Reasignar</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cotizaciones.map((c) => {
              const totals = calcInvoiceTotals(
                c.data.items,
                c.data.ivaPorcentaje,
              );
              // Mientras esté reasignada, quien la ve y la puede reasignar de
              // nuevo es esa persona, no quien la creó — igual que decide el
              // backend. Sin reasignar, es quien la creó. Sin dueño
              // registrado (cotizaciones de antes de los roles), solo el
              // administrador.
              const dueñoActual = c.reasignadoA || c.creadoPor;
              const puedeReasignar =
                usuarioActual.admin || dueñoActual === usuarioActual.email;
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
                  <td className="px-4 py-3 text-slate-700">
                    {(c.creadoPor && nombresPorCorreo.get(c.creadoPor)) ||
                      c.creadoPor ||
                      "—"}
                  </td>
                  <td className="px-4 py-3">
                    {puedeReasignar ? (
                      <select
                        aria-label={`Reasignar ${c.data.numeroFactura}`}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
                        value={c.reasignadoA ?? ""}
                        onChange={(e) => {
                          const nuevoValor = e.target.value;
                          if (nuevoValor !== (c.reasignadoA ?? "")) {
                            setPorReasignar({
                              numeroFactura: c.data.numeroFactura,
                              nuevoDueno: nuevoValor,
                            });
                          }
                        }}
                      >
                        <option value="">Sin reasignar</option>
                        {equipo.map((m) => (
                          <option key={m.email} value={m.email}>
                            {nombreCompleto(m)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
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
                        titulo="Historial de cambios"
                        onClick={() => setHistorialAbierto(c)}
                        icono={ICONOS.historial}
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

      {porReasignar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setPorReasignar(null)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-base font-semibold text-slate-900">
              Reasignar cotización
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              ¿Estás seguro de reasignar esta cotización?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPorReasignar(null)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onReasignar(
                    porReasignar.numeroFactura,
                    porReasignar.nuevoDueno,
                  );
                  setPorReasignar(null);
                }}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                Sí
              </button>
            </div>
          </div>
        </div>
      )}

      {historialAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setHistorialAbierto(null)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-base font-semibold text-slate-900">
              Historial de {historialAbierto.data.numeroFactura}
            </h2>
            <div className="mt-4 flex-1 overflow-y-auto pr-1">
              {historialAbierto.historial &&
              historialAbierto.historial.length > 0 ? (
                <ol className="relative border-l border-slate-200 pl-4">
                  {[...historialAbierto.historial]
                    .reverse()
                    .map((entrada, i) => (
                      <li key={i} className="mb-5 last:mb-0">
                        <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                        <p className="text-sm font-medium text-slate-900">
                          {describirEntrada(entrada)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {nombreOCorreo(entrada.quien)} ·{" "}
                          {formatFechaHora(entrada.fecha)}
                        </p>
                      </li>
                    ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-500">
                  Esta cotización no tiene historial registrado.
                </p>
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setHistorialAbierto(null)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
