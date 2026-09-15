import { useEffect, useState } from "react";
import type { AdjuntoEstado, CotizacionGuardada, EstadoCotizacion } from "../types";
import { calcInvoiceTotals, formatCurrency, formatDateLong } from "../utils/calculations";
import { ErrorApi } from "../utils/api";
import { nombreCompleto, type UsuarioPublico } from "../utils/auth";
import {
  listarEquipo,
  subirAdjuntoEstado,
  type MiembroEquipo,
} from "../utils/cotizacionesGuardadas";
import { empresaDeLaCotizacion, enviarNotaEstado } from "../utils/notaClientify";

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
    razon?: string,
    adjuntos?: AdjuntoEstado[],
  ) => Promise<CotizacionGuardada>;
}

/** Límites del lado del navegador: dan un aviso rápido, antes de que el backend los rechace. */
const ADJUNTO_MAX_BYTES = 3.3 * 1024 * 1024;
const ADJUNTOS_MAX_CANTIDAD = 5;

/**
 * Tipos de archivo permitidos como adjunto: documentos de oficina, PDF,
 * comprimidos e imágenes. A propósito NO se usa el atributo `accept` del
 * input: en varios sistemas operativos ese filtro hace que el cuadro de
 * "Elegir archivos" solo MUESTRE los tipos indicados y esconda el resto sin
 * ningún aviso, así que si el archivo que alguien quiere subir no calzaba
 * exacto con la lista, ni siquiera aparecía para poder elegirlo — parecía
 * que el botón no hacía nada. En su lugar se deja elegir cualquier archivo y
 * se valida después, con un mensaje claro si no es un tipo permitido.
 */
const EXTENSIONES_ADJUNTO_PERMITIDAS = [
  ".pdf",
  ".doc",
  ".docx",
  ".rtf",
  ".odt",
  ".xls",
  ".xlsx",
  ".ods",
  ".csv",
  ".ppt",
  ".pptx",
  ".odp",
  ".txt",
  ".zip",
  ".rar",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
  ".heic",
  ".svg",
];

function extensionPermitida(archivo: File): boolean {
  const nombre = archivo.name.toLowerCase();
  if (archivo.type.startsWith("image/")) return true;
  return EXTENSIONES_ADJUNTO_PERMITIDAS.some((ext) => nombre.endsWith(ext));
}

const ETIQUETAS_ESTADO = {
  creada: "Creada",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  enviada: "Enviada",
} as const;

const ESTILOS_ETIQUETA_ESTADO = {
  creada: "bg-slate-100 text-slate-600",
  aceptada: "bg-emerald-100 text-emerald-700",
  rechazada: "bg-red-100 text-red-700",
  enviada: "bg-blue-100 text-blue-700",
} as const;

function formatTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [porMarcarEstado, setPorMarcarEstado] =
    useState<CotizacionGuardada | null>(null);
  const [estadoAMarcar, setEstadoAMarcar] = useState<EstadoCotizacion | null>(
    null,
  );
  const [razonEstado, setRazonEstado] = useState("");
  const [archivosEstado, setArchivosEstado] = useState<File[]>([]);
  const [progresoArchivos, setProgresoArchivos] = useState<
    Record<number, "subiendo" | "listo" | "error">
  >({});
  const [envioEstado, setEnvioEstado] = useState<
    "idle" | "guardando" | "guardado" | "guardado_sin_clientify" | "error"
  >("idle");
  const [errorEstado, setErrorEstado] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroCreador, setFiltroCreador] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<
    "" | "creada" | "aceptada" | "rechazada" | "enviada"
  >("");

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
    if (entrada.accion === "marcada_ganada") {
      return entrada.razon
        ? `Marcada como ganada — ${entrada.razon}`
        : "Marcada como ganada";
    }
    if (entrada.accion === "marcada_perdida") {
      return entrada.razon
        ? `Marcada como perdida — ${entrada.razon}`
        : "Marcada como perdida";
    }
    if (entrada.accion === "estado_quitado")
      return "Se quitó la marca de ganada/perdida";
    return entrada.nuevoDueno
      ? `Reasignada a ${nombreOCorreo(entrada.nuevoDueno)}`
      : "Se quitó la reasignación";
  }

  /** Una sola etiqueta por cotización: aceptada/rechazada manda sobre enviada, y esa sobre creada. */
  function etiquetaEstado(
    c: CotizacionGuardada,
  ): "creada" | "aceptada" | "rechazada" | "enviada" {
    if (c.estado === "ganada") return "aceptada";
    if (c.estado === "perdida") return "rechazada";
    const enviada = (c.historial ?? []).some(
      (h) => h.accion === "enviada_clientify",
    );
    return enviada ? "enviada" : "creada";
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
    if (filtroEstado && etiquetaEstado(c) !== filtroEstado) {
      return false;
    }
    return true;
  });

  const hayFiltrosActivos = Boolean(
    filtroCliente || filtroFecha || filtroCreador || filtroEstado,
  );

  function abrirMarcarEstado(c: CotizacionGuardada, estado: EstadoCotizacion) {
    setPorMarcarEstado(c);
    setEstadoAMarcar(estado);
    setRazonEstado("");
    setArchivosEstado([]);
    setProgresoArchivos({});
    setEnvioEstado("idle");
    setErrorEstado("");
  }

  function cerrarMarcarEstado() {
    setPorMarcarEstado(null);
    setEstadoAMarcar(null);
    setArchivosEstado([]);
    setProgresoArchivos({});
    setEnvioEstado("idle");
    setErrorEstado("");
  }

  function agregarArchivosEstado(nuevos: FileList | null) {
    if (!nuevos || nuevos.length === 0) return;
    setArchivosEstado((previos) => {
      const seleccionados = Array.from(nuevos);
      const noPermitido = seleccionados.find((a) => !extensionPermitida(a));
      if (noPermitido) {
        setErrorEstado(
          `"${noPermitido.name}" no es un tipo permitido. Solo documentos de oficina, PDF, comprimidos o imágenes.`,
        );
        seleccionados.splice(seleccionados.indexOf(noPermitido), 1);
      }
      const combinados = [...previos, ...seleccionados];
      if (combinados.length > ADJUNTOS_MAX_CANTIDAD) {
        setErrorEstado(`Máximo ${ADJUNTOS_MAX_CANTIDAD} archivos.`);
        return combinados.slice(0, ADJUNTOS_MAX_CANTIDAD);
      }
      const muyGrande = combinados.find((a) => a.size > ADJUNTO_MAX_BYTES);
      if (muyGrande) {
        setErrorEstado(
          `"${muyGrande.name}" pesa más de ${formatTamano(ADJUNTO_MAX_BYTES)}.`,
        );
      }
      return combinados;
    });
  }

  function quitarArchivoEstado(indice: number) {
    setArchivosEstado((previos) => previos.filter((_, i) => i !== indice));
    setProgresoArchivos((previos) => {
      const copia: Record<number, "subiendo" | "listo" | "error"> = {};
      Object.entries(previos).forEach(([clave, valor]) => {
        const i = Number(clave);
        if (i === indice) return;
        copia[i > indice ? i - 1 : i] = valor;
      });
      return copia;
    });
  }

  /**
   * Guarda el estado con su motivo (obligatorio) y los adjuntos, y si la
   * cotización está vinculada a una empresa de Clientify, deja el motivo
   * como anotación en su ficha. Si no hay empresa vinculada, el estado igual
   * queda guardado — solo avisa que no se pudo anotar en el CRM.
   */
  async function confirmarMarcarEstado() {
    if (!porMarcarEstado || !estadoAMarcar) return;

    const motivo = razonEstado.trim();
    if (motivo === "") {
      setErrorEstado("Escribe el motivo antes de guardar.");
      setEnvioEstado("error");
      return;
    }
    if (archivosEstado.some((a) => a.size > ADJUNTO_MAX_BYTES)) {
      setErrorEstado(`Hay un archivo que pesa más de ${formatTamano(ADJUNTO_MAX_BYTES)}.`);
      setEnvioEstado("error");
      return;
    }

    setEnvioEstado("guardando");
    setErrorEstado("");
    const numeroFactura = porMarcarEstado.data.numeroFactura;

    try {
      // Cada archivo se sube en su propia petición: así uno solo, no toda la
      // marca de estado junto con los demás, es lo que puede fallar si pesa
      // de más, y el error dice cuál.
      const adjuntos: AdjuntoEstado[] = [];
      for (let i = 0; i < archivosEstado.length; i++) {
        const archivo = archivosEstado[i];
        setProgresoArchivos((previos) => ({ ...previos, [i]: "subiendo" }));
        try {
          const subido = await subirAdjuntoEstado(numeroFactura, archivo);
          adjuntos.push(subido);
          setProgresoArchivos((previos) => ({ ...previos, [i]: "listo" }));
        } catch (err) {
          setProgresoArchivos((previos) => ({ ...previos, [i]: "error" }));
          const detalle =
            err instanceof ErrorApi
              ? err.message
              : err instanceof Error
                ? err.message
                : "No se pudo subir";
          throw new Error(`"${archivo.name}": ${detalle}`);
        }
      }

      await onMarcarEstado(numeroFactura, estadoAMarcar, motivo, adjuntos);

      const empresaId = await empresaDeLaCotizacion(porMarcarEstado.data);
      if (empresaId === null) {
        setEnvioEstado("guardado_sin_clientify");
        return;
      }

      await enviarNotaEstado(
        empresaId,
        numeroFactura,
        estadoAMarcar,
        motivo,
        adjuntos,
      );
      setEnvioEstado("guardado");
    } catch (err) {
      const detalle =
        err instanceof ErrorApi
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo guardar";
      setErrorEstado(detalle);
      setEnvioEstado("error");
    }
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

        <div className="flex flex-col gap-1">
          <label
            htmlFor="filtro-estado"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            Estado
          </label>
          <select
            id="filtro-estado"
            value={filtroEstado}
            onChange={(e) =>
              setFiltroEstado(
                e.target.value as
                  | ""
                  | "creada"
                  | "aceptada"
                  | "rechazada"
                  | "enviada",
              )
            }
            className="min-w-[160px] cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 transition-colors hover:border-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">Todos los estados</option>
            <option value="creada">Creada</option>
            <option value="aceptada">Aceptada</option>
            <option value="rechazada">Rechazada</option>
            <option value="enviada">Enviada</option>
          </select>
        </div>

        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={() => {
              setFiltroCliente("");
              setFiltroFecha("");
              setFiltroCreador("");
              setFiltroEstado("");
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
              <th className="w-[20%] px-3 py-3">Cotización</th>
              <th className="w-[12%] px-3 py-3">Fechas</th>
              <th className="w-[10%] px-3 py-3 text-right">Total antes de IVA</th>
              <th className="w-[11%] px-3 py-3">Creada por</th>
              <th className="w-[13%] px-3 py-3">Reasignar</th>
              <th className="w-[10%] px-3 py-3">Estado</th>
              <th className="w-[24%] px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
              {cotizacionesFiltradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
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
                    <div className="mt-0.5 truncate text-xs text-slate-600">
                      {c.data.cliente.razonSocial || "—"}
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
                  <td className="px-3 py-3 text-xs text-slate-600">
                    <div className="truncate">
                      {(c.creadoPor && nombresPorCorreo.get(c.creadoPor)) ||
                        c.creadoPor ||
                        "—"}
                    </div>
                  </td>
                  <td className="px-3 py-3">
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
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTILOS_ETIQUETA_ESTADO[etiquetaEstado(c)]}`}
                    >
                      {ETIQUETAS_ESTADO[etiquetaEstado(c)]}
                    </span>
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
                            c.estado === "ganada"
                              ? onMarcarEstado(
                                  c.data.numeroFactura,
                                  undefined,
                                ).catch(() => {})
                              : abrirMarcarEstado(c, "ganada")
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
                            c.estado === "perdida"
                              ? onMarcarEstado(
                                  c.data.numeroFactura,
                                  undefined,
                                ).catch(() => {})
                              : abrirMarcarEstado(c, "perdida")
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

      {porMarcarEstado && estadoAMarcar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={cerrarMarcarEstado}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-base font-semibold text-slate-900">
              Marcar como {estadoAMarcar === "ganada" ? "ganada" : "perdida"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Cotización {porMarcarEstado.data.numeroFactura}
              {porMarcarEstado.data.cliente.razonSocial
                ? ` · ${porMarcarEstado.data.cliente.razonSocial}`
                : ""}
            </p>

            <label
              htmlFor="razon-estado"
              className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Motivo
            </label>
            <textarea
              id="razon-estado"
              value={razonEstado}
              onChange={(e) => setRazonEstado(e.target.value)}
              disabled={envioEstado === "guardando"}
              required
              rows={3}
              placeholder={
                estadoAMarcar === "ganada"
                  ? "Por qué se ganó la cotización..."
                  : "Por qué se perdió la cotización..."
              }
              className="mt-1 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Adjuntos
            </label>
            <p className="mt-1 text-xs text-slate-400">
              PDF, Word, Excel, PowerPoint, imágenes o comprimidos — máx.{" "}
              {formatTamano(ADJUNTO_MAX_BYTES)} c/u.
            </p>
            <input
              type="file"
              multiple
              disabled={
                envioEstado === "guardando" ||
                archivosEstado.length >= ADJUNTOS_MAX_CANTIDAD
              }
              // A propósito NO se limpia e.target.value tras leer los
              // archivos: si se hiciera, el propio navegador vuelve a
              // mostrar "Ningún archivo seleccionado" junto al botón aunque
              // la selección sí se haya tomado — deja la impresión de que no
              // pasó nada. Se deja como el navegador lo muestra de por sí.
              onChange={(e) => agregarArchivosEstado(e.target.files)}
              className="mt-1 block w-full cursor-pointer text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            />
            {archivosEstado.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {archivosEstado.map((archivo, i) => {
                  const estadoArchivo = progresoArchivos[i];
                  const porcentaje = estadoArchivo === "listo" ? 100 : estadoArchivo === "subiendo" ? 60 : 0;
                  return (
                    <li
                      key={`${archivo.name}-${i}`}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {archivo.name}{" "}
                          <span className="text-slate-400">
                            ({formatTamano(archivo.size)})
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => quitarArchivoEstado(i)}
                          disabled={envioEstado === "guardando"}
                          className="shrink-0 text-slate-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Quitar ${archivo.name}`}
                        >
                          {ICONOS.perdida}
                        </button>
                      </div>
                      {estadoArchivo && (
                        <div className="mt-1.5">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                estadoArchivo === "error"
                                  ? "bg-red-500"
                                  : estadoArchivo === "listo"
                                    ? "bg-emerald-500"
                                    : "animate-pulse bg-indigo-400"
                              }`}
                              style={{ width: `${porcentaje}%` }}
                            />
                          </div>
                          <span
                            className={`mt-0.5 block text-[11px] font-medium ${
                              estadoArchivo === "error"
                                ? "text-red-600"
                                : estadoArchivo === "listo"
                                  ? "text-emerald-600"
                                  : "text-indigo-500"
                            }`}
                          >
                            {estadoArchivo === "error"
                              ? "Error al subir"
                              : estadoArchivo === "listo"
                                ? "Subido (100%)"
                                : "Subiendo…"}
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {envioEstado === "guardado" && (
              <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Guardado y anotado en la ficha de la empresa en Clientify.
              </div>
            )}
            {envioEstado === "guardado_sin_clientify" && (
              <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Se guardó el estado, pero esta cotización no está vinculada a
                una empresa de Clientify: no se pudo anotar en su ficha.
              </div>
            )}
            {envioEstado === "error" && (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                {errorEstado}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cerrarMarcarEstado}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
              >
                {envioEstado === "guardado" ||
                envioEstado === "guardado_sin_clientify"
                  ? "Cerrar"
                  : "Cancelar"}
              </button>
              {envioEstado !== "guardado" &&
                envioEstado !== "guardado_sin_clientify" && (
                  <button
                    type="button"
                    onClick={confirmarMarcarEstado}
                    disabled={
                      envioEstado === "guardando" || razonEstado.trim() === ""
                    }
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {envioEstado === "guardando"
                      ? "Enviando…"
                      : "Guardar y enviar a Clientify"}
                  </button>
                )}
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
