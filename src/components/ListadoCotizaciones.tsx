import { useEffect, useState } from "react";
import type { CotizacionGuardada, EstadoCotizacion } from "../types";
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
  onMarcarEstado: (
    numeroFactura: string,
    estado: EstadoCotizacion | undefined,
  ) => void;
}

/**
 * Normaliza para comparar por coincidencia: sin tildes/diacríticos, sin
 * caracteres que no sean letras o números, y en minúsculas. Así "Peña S.A."
 * coincide al escribir "pena sa" o "peña".
 */
function normalizarBusqueda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
  ganada: (
    <svg viewBox="0 0 24 24" {...trazo} className="h-4 w-4">
      <path d="m5 13 4 4L19 7" />
    </svg>
  ),
  perdida: (
    <svg viewBox="0 0 24 24" {...trazo} className="h-4 w-4">
      <path d="M6 6l12 12M18 6 6 18" />
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
  "verde-activo":
    "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 focus-visible:outline-emerald-500",
  rojo: "text-red-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-red-400",
  "rojo-activo":
    "bg-red-100 text-red-700 hover:bg-red-200 focus-visible:outline-red-400",
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
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${TONOS[tono]}`}
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
  onMarcarEstado,
}: ListadoCotizacionesProps) {
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  const [porReasignar, setPorReasignar] = useState<{
    numeroFactura: string;
    nuevoDueno: string;
  } | null>(null);
  const [historialAbierto, setHistorialAbierto] =
    useState<CotizacionGuardada | null>(null);
  const [porEliminar, setPorEliminar] = useState<string | null>(null);
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroCreador, setFiltroCreador] = useState("");

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
    if (entrada.accion === "enviada_clientify")
      return "Cotización enviada a Clientify";
    if (entrada.accion === "marcada_ganada") return "Marcada como ganada";
    if (entrada.accion === "marcada_perdida") return "Marcada como perdida";
    if (entrada.accion === "estado_quitado")
      return "Se quitó la marca de ganada/perdida";
    return entrada.nuevoDueno
      ? `Reasignada a ${nombreOCorreo(entrada.nuevoDueno)}`
      : "Se quitó la reasignación";
  }

  const creadoresDisponibles = Array.from(
    new Set(
      cotizaciones
        .map((c) => c.creadoPor)
        .filter((v): v is string => Boolean(v)),
    ),
  ).sort((a, b) => nombreOCorreo(a).localeCompare(nombreOCorreo(b)));

  const filtroClienteNormalizado = normalizarBusqueda(filtroCliente);

  const cotizacionesFiltradas = cotizaciones.filter((c) => {
    if (
      filtroClienteNormalizado &&
      !normalizarBusqueda(c.data.cliente.razonSocial || "").includes(
        filtroClienteNormalizado,
      )
    ) {
      return false;
    }
    if (filtroFecha && c.data.fecha !== filtroFecha) {
      return false;
    }
    if (filtroCreador && c.creadoPor !== filtroCreador) {
      return false;
    }
    return true;
  });

  const hayFiltrosActivos = Boolean(filtroCliente || filtroFecha || filtroCreador);

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
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filtro-cliente"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Cliente
          </label>
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              {...trazo}
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              id="filtro-cliente"
              type="text"
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              placeholder="Buscar por nombre de empresa..."
              className="min-w-[240px] rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-sm text-slate-700 transition-colors hover:border-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="filtro-fecha"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Fecha de creación
          </label>
          <input
            id="filtro-fecha"
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 transition-colors hover:border-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="filtro-creador"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Creada por
          </label>
          <select
            id="filtro-creador"
            value={filtroCreador}
            onChange={(e) => setFiltroCreador(e.target.value)}
            className="min-w-[180px] cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 transition-colors hover:border-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">Todos los creadores</option>
            {creadoresDisponibles.map((correo) => (
              <option key={correo} value={correo}>
                {nombreOCorreo(correo)}
              </option>
            ))}
          </select>
        </div>

        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={() => {
              setFiltroCliente("");
              setFiltroFecha("");
              setFiltroCreador("");
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full table-fixed text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="w-[26%] px-3 py-3">Cotización</th>
              <th className="w-[18%] px-3 py-3">Fechas</th>
              <th className="w-[13%] px-3 py-3 text-right">Total antes de IVA</th>
              <th className="w-[20%] px-3 py-3">Creada por / Reasignar</th>
              <th className="w-[23%] px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
              {cotizacionesFiltradas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    No hay cotizaciones que coincidan con los filtros.
                  </td>
                </tr>
              )}
            {cotizacionesFiltradas.map((c) => {
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
                  className="group border-b border-slate-100 last:border-0 odd:bg-white even:bg-slate-50/60 hover:bg-indigo-50/40"
                >
                  <td className="px-3 py-3">
                    <div className="truncate font-semibold text-slate-900">
                      {c.data.numeroFactura}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 truncate text-xs text-slate-600">
                      <span className="truncate">
                        {c.data.cliente.razonSocial || "—"}
                      </span>
                      {c.estado === "ganada" && (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Ganada
                        </span>
                      )}
                      {c.estado === "perdida" && (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                          Perdida
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    <div>{formatDateLong(c.data.fecha) || "—"}</div>
                    <div className="mt-0.5 text-slate-400">
                      Válida: {formatDateLong(c.data.validaHasta) || "—"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-slate-900">
                    {formatCurrency(totals.subtotal)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="truncate text-xs text-slate-600">
                      {(c.creadoPor && nombresPorCorreo.get(c.creadoPor)) ||
                        c.creadoPor ||
                        "—"}
                    </div>
                    <div className="mt-1">
                      {puedeReasignar ? (
                        <select
                          aria-label={`Reasignar ${c.data.numeroFactura}`}
                          className="w-full cursor-pointer rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-700 transition-colors hover:border-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1">
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
                      </div>
                      <div className="flex items-center gap-1">
                        <BotonIcono
                          titulo={
                            c.estado === "ganada"
                              ? "Quitar marca de ganada"
                              : "Marcar como ganada"
                          }
                          onClick={() =>
                            onMarcarEstado(
                              c.data.numeroFactura,
                              c.estado === "ganada" ? undefined : "ganada",
                            )
                          }
                          icono={ICONOS.ganada}
                          tono={
                            c.estado === "ganada" ? "verde-activo" : "verde"
                          }
                        />
                        <BotonIcono
                          titulo={
                            c.estado === "perdida"
                              ? "Quitar marca de perdida"
                              : "Marcar como perdida"
                          }
                          onClick={() =>
                            onMarcarEstado(
                              c.data.numeroFactura,
                              c.estado === "perdida" ? undefined : "perdida",
                            )
                          }
                          icono={ICONOS.perdida}
                          tono={c.estado === "perdida" ? "rojo-activo" : "rojo"}
                        />
                        <BotonIcono
                          titulo="Eliminar"
                          onClick={() => setPorEliminar(c.data.numeroFactura)}
                          icono={ICONOS.eliminar}
                          tono="rojo"
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
              Eliminar cotización
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              ¿Estás seguro de eliminar la cotización {porEliminar}? Esta
              acción no se puede deshacer.
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
                onClick={() => {
                  onEliminar(porEliminar);
                  setPorEliminar(null);
                }}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

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
