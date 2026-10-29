import { useEffect, useMemo, useState } from "react";
import {
  aplicarFiltros,
  contarPor,
  formatoDias,
  obtenerConversiones,
  obtenerInformeContactos,
  ORIGEN_IDENTIFICADO,
  ORIGEN_NINGUNO,
  ORIGEN_TODOS,
  PERIODOS,
  porcentaje,
  rangoDePeriodo,
  resumir,
  resumirConversion,
  type CatalogosInforme,
  type ContactoInforme,
  type Conversion,
  type FilaDesglose,
  type Periodo,
} from "../utils/informes";
import { selectTriggerClass } from "./SearchableSelect";

interface InformesProps {
  onError: (err: unknown) => void;
}

// Slot 1 de la paleta categórica validada (azul). Cada gráfica del embudo es
// de una sola serie, así que basta un color; la fila elegida se marca con el
// fondo y el borde, no con otro tono.
const COLOR_BARRA = "#2a78d6";

/** Qué grupo del embudo está abierto en el nivel 4. */
type Seleccion = { nivel: 2 | 3; clave: string };

interface Barra {
  clave: string;
  nombre: string;
  valor: number;
}

export default function Informes({ onError }: InformesProps) {
  const [contactos, setContactos] = useState<ContactoInforme[]>([]);
  const [catalogos, setCatalogos] = useState<CatalogosInforme | null>(null);
  const [actualizadoEn, setActualizadoEn] = useState("");
  const [cargando, setCargando] = useState(true);

  const [conversiones, setConversiones] = useState<Map<number, Conversion> | null>(null);
  const [conversionFallo, setConversionFallo] = useState(false);

  const [periodo, setPeriodo] = useState<Periodo>("este-mes");
  const [desdeManual, setDesdeManual] = useState("");
  const [hastaManual, setHastaManual] = useState("");
  const [comercial, setComercial] = useState("");
  const [origen, setOrigen] = useState(ORIGEN_IDENTIFICADO);
  const [seleccion, setSeleccion] = useState<Seleccion>({ nivel: 3, clave: "gestion" });

  useEffect(() => {
    obtenerInformeContactos()
      .then((datos) => {
        setContactos(datos.contactos);
        setCatalogos(datos.catalogos);
        setActualizadoEn(datos.actualizadoEn);
      })
      .catch(onError)
      .finally(() => setCargando(false));

    // El tiempo de conversión lee el historial de cada cliente en Clientify,
    // que tarda más: se pide aparte para no frenar el resto del panel.
    obtenerConversiones()
      .then((lista) => setConversiones(new Map(lista.map((c) => [c.id, c]))))
      .catch(() => setConversionFallo(true));
  }, [onError]);

  const { desde, hasta } =
    periodo === "personalizado"
      ? { desde: desdeManual, hasta: hastaManual }
      : rangoDePeriodo(periodo);

  const nombreDe = useMemo(() => {
    const mapa = new Map<string, string>();
    catalogos?.calificaciones.forEach((c) => mapa.set(`cal:${c.clave}`, c.nombre));
    catalogos?.estadosGenerales.forEach((e) => mapa.set(`est:${e.clave}`, e.nombre));
    catalogos?.origenes.forEach((o) => mapa.set(`ori:${o.clave}`, o.nombre));
    catalogos?.subestados.forEach((s) => mapa.set(`sub:${s.valor.toLowerCase()}`, s.nombre));
    return (tipo: "cal" | "est" | "ori" | "sub", clave: string) =>
      mapa.get(`${tipo}:${tipo === "sub" ? clave.toLowerCase() : clave}`) ?? clave;
  }, [catalogos]);

  // Período y comercial primero; el filtro de origen se aplica aparte.
  const enPeriodo = useMemo(
    () =>
      catalogos
        ? aplicarFiltros(contactos, { desde, hasta, comercial, origen: ORIGEN_TODOS }, catalogos)
        : [],
    [contactos, catalogos, desde, hasta, comercial],
  );

  const filtrados = useMemo(
    () =>
      catalogos
        ? aplicarFiltros(enPeriodo, { desde: "", hasta: "", comercial: "", origen }, catalogos)
        : [],
    [enPeriodo, catalogos, origen],
  );

  const aplican = useMemo(() => filtrados.filter((c) => c.calificacion === "aplica"), [filtrados]);
  const clientes = useMemo(() => aplican.filter((c) => c.estadoGeneral === "cliente"), [aplican]);
  const enGestion = aplican.filter((c) => c.estadoGeneral === "gestion").length;

  const conversion = useMemo(
    () => (conversiones ? resumirConversion(clientes, conversiones) : null),
    [clientes, conversiones],
  );

  // --- Niveles del embudo ---

  const nivel2 = useMemo<Barra[]>(() => {
    if (!catalogos) return [];
    const conteo = contarPor(filtrados, (c) => c.calificacion);
    return catalogos.calificaciones
      .map((c) => ({ clave: c.clave, nombre: c.nombre, valor: conteo.get(c.clave) ?? 0 }))
      .filter((b) => b.valor > 0 || ["aplica", "no-aplica", "duplicado", "agencia"].includes(b.clave));
  }, [catalogos, filtrados]);

  const nivel3 = useMemo<Barra[]>(() => {
    if (!catalogos) return [];
    const conteo = contarPor(aplican, (c) => c.estadoGeneral);
    return catalogos.estadosGenerales
      .map((e) => ({ clave: e.clave, nombre: e.nombre, valor: conteo.get(e.clave) ?? 0 }))
      .filter((b) => b.valor > 0 || ["oportunidad", "gestion", "off", "cliente"].includes(b.clave));
  }, [catalogos, aplican]);

  const grupoSeleccionado = useMemo(
    () =>
      seleccion.nivel === 2
        ? filtrados.filter((c) => c.calificacion === seleccion.clave)
        : aplican.filter((c) => c.estadoGeneral === seleccion.clave),
    [seleccion, filtrados, aplican],
  );

  const nombreSeleccion =
    seleccion.nivel === 2 ? nombreDe("cal", seleccion.clave) : nombreDe("est", seleccion.clave);

  const nivel4 = useMemo<Barra[]>(() => {
    if (!catalogos) return [];
    const conteo = contarPor(grupoSeleccionado, (c) => c.estadoGestion);
    // Las opciones esperadas para este estado se muestran aunque estén en 0:
    // un "0 en estudio de crédito" también es información.
    const esperadas =
      seleccion.nivel === 3
        ? catalogos.subestados.filter((s) => s.estado === seleccion.clave && s.valor !== "Cliente")
        : seleccion.clave === "no-aplica"
          ? catalogos.subestados.filter((s) => s.estado === "no-aplica")
          : [];
    const barras = new Map<string, Barra>();
    for (const s of esperadas) {
      barras.set(s.valor.toLowerCase(), { clave: s.valor, nombre: s.nombre, valor: 0 });
    }
    for (const [valor, n] of conteo) {
      const llave = (valor || "").toLowerCase();
      const nombre = valor ? nombreDe("sub", valor) : "Sin estado de gestión";
      // "Cliente" (valor viejo) y "C - Cliente" se suman en una sola fila.
      const existente = [...barras.values()].find((b) => b.nombre === nombre) ?? barras.get(llave);
      if (existente) existente.valor += n;
      else barras.set(llave, { clave: valor || "__vacio__", nombre, valor: n });
    }
    return [...barras.values()].sort((a, b) => b.valor - a.valor);
  }, [catalogos, grupoSeleccionado, seleccion, nombreDe]);

  // --- Desgloses ---

  const filasComercial = useMemo<FilaDesglose[]>(() => {
    const porComercial = new Map<string, ContactoInforme[]>();
    for (const c of filtrados) {
      const k = c.comercial || "Sin asignar";
      porComercial.set(k, [...(porComercial.get(k) ?? []), c]);
    }
    return [...porComercial.entries()]
      .map(([nombre, lista]) => resumir(nombre, nombre, lista))
      .sort((a, b) => b.leads - a.leads);
  }, [filtrados]);

  if (cargando) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-slate-500">Cargando informe desde Clientify…</p>
          <p className="mt-1 text-xs text-slate-400">
            Justo después de una actualización del sistema puede tardar unos segundos; luego es inmediato.
          </p>
        </div>
      </div>
    );
  }

  if (!catalogos) return null;

  const grupos = [...new Set(catalogos.origenes.map((o) => o.grupo))];
  const hayFiltros =
    periodo !== "este-mes" || comercial !== "" || origen !== ORIGEN_IDENTIFICADO;

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* --- Filtros globales: una fila, arriba de todo --- */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <Filtro etiqueta="Período (fecha de ingreso)">
          <select
            className={selectTriggerClass}
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
          >
            {PERIODOS.map((p) => (
              <option key={p.clave} value={p.clave}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Filtro>

        {periodo === "personalizado" && (
          <>
            <Filtro etiqueta="Desde" angosto>
              <input
                type="date"
                className={selectTriggerClass}
                value={desdeManual}
                onChange={(e) => setDesdeManual(e.target.value)}
              />
            </Filtro>
            <Filtro etiqueta="Hasta" angosto>
              <input
                type="date"
                className={selectTriggerClass}
                value={hastaManual}
                onChange={(e) => setHastaManual(e.target.value)}
              />
            </Filtro>
          </>
        )}

        <Filtro etiqueta="Comercial asignado">
          <select
            className={selectTriggerClass}
            value={comercial}
            onChange={(e) => setComercial(e.target.value)}
          >
            <option value="">Todos</option>
            {catalogos.comerciales.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Filtro>

        <Filtro etiqueta="Origen del lead">
          <select
            className={selectTriggerClass}
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
          >
            <option value={ORIGEN_IDENTIFICADO}>Todos los orígenes identificados</option>
            {grupos.map((g) => (
              <optgroup key={g} label={g}>
                <option value={`grupo:${g}`}>{g} (todo el grupo)</option>
                {catalogos.origenes
                  .filter((o) => o.grupo === g)
                  .map((o) => (
                    <option key={o.clave} value={o.clave}>
                      {o.nombre}
                    </option>
                  ))}
              </optgroup>
            ))}
            <optgroup label="¿Cómo nos conoció?">
              {catalogos.comoConocio.map((o) => (
                <option key={o.valor} value={`conocio:${o.valor}`}>
                  {o.nombre}
                </option>
              ))}
            </optgroup>
            <optgroup label="Otros">
              <option value={ORIGEN_NINGUNO}>Sin origen identificado</option>
              <option value={ORIGEN_TODOS}>Todos los contactos del CRM</option>
            </optgroup>
          </select>
        </Filtro>

        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setPeriodo("este-mes");
              setComercial("");
              setOrigen(ORIGEN_IDENTIFICADO);
            }}
            className="mb-2 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            Quitar filtros
          </button>
        )}

        {actualizadoEn && (
          <p className="mb-2 ml-auto text-[11px] text-slate-400">
            Datos de Clientify de las{" "}
            {new Date(actualizadoEn).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}{" "}
            (se refrescan cada 20 min)
          </p>
        )}
      </div>

      {/* --- Indicadores principales --- */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Indicador titulo="Leads entrantes" valor={filtrados.length} detalle={textoRango(desde, hasta)} />
        <Indicador
          titulo="Aplican"
          valor={aplican.length}
          detalle={`${porcentaje(aplican.length, filtrados.length)} de los leads`}
        />
        <Indicador
          titulo="En gestión"
          valor={enGestion}
          detalle={`${porcentaje(enGestion, aplican.length)} de los que aplican`}
        />
        <Indicador
          titulo="Clientes"
          valor={clientes.length}
          detalle={`Conversión ${porcentaje(clientes.length, aplican.length)} sobre los que aplican`}
        />
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Tiempo promedio a cliente</p>
          {conversion === null ? (
            <p className="mt-2 text-sm text-slate-400">
              {conversionFallo ? "No se pudo leer el historial" : "Calculando…"}
            </p>
          ) : conversion.medidos === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Sin clientes medibles en este filtro</p>
          ) : (
            <>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {formatoDias(conversion.promedioDias)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Mediana {formatoDias(conversion.medianaDias)} · {conversion.medidos}{" "}
                {conversion.medidos === 1 ? "cliente" : "clientes"}
                {conversion.sinRegistro > 0 && ` · ${conversion.sinRegistro} sin historial`}
              </p>
            </>
          )}
        </div>
      </div>

      {/* --- Desglose por comercial: justo bajo los indicadores, que es lo
          primero que se revisa en el seguimiento del equipo --- */}
      <section className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="px-5 pt-5">
          <h2 className="text-sm font-semibold text-slate-800">Resultados por comercial</h2>
          <p className="mt-1 text-xs text-slate-500">Con todos los filtros aplicados.</p>
        </div>
        <TablaDesglose
          filas={filasComercial}
          elegida={comercial}
          onElegir={(clave) =>
            clave !== "Sin asignar" && setComercial(clave === comercial ? "" : clave)
          }
        />
      </section>

      {/* --- Embudo jerárquico --- */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-800">Recorrido del lead</h2>
          <p className="mt-1 text-xs text-slate-500">
            <strong className="text-slate-700">{filtrados.length.toLocaleString("es-CO")}</strong> leads
            {" → "}
            <strong className="text-slate-700">{aplican.length.toLocaleString("es-CO")}</strong> aplican
            {seleccion.nivel === 3 && (
              <>
                {" → "}
                <strong className="text-slate-700">{grupoSeleccionado.length.toLocaleString("es-CO")}</strong>{" "}
                {nombreSeleccion.toLowerCase()}
              </>
            )}
            . Haz clic en un estado para ver su detalle y sus contactos.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Nivel
            numero={2}
            titulo="Calificación del contacto"
            subtitulo={`de ${filtrados.length.toLocaleString("es-CO")} leads · campo "Tipo"`}
            barras={nivel2}
            total={filtrados.length}
            elegida={seleccion.nivel === 2 ? seleccion.clave : seleccion.nivel === 3 ? "aplica" : null}
            onElegir={(clave) =>
              setSeleccion(clave === "aplica" ? { nivel: 3, clave: "gestion" } : { nivel: 2, clave })
            }
          />
          <Nivel
            numero={3}
            titulo="Estado general"
            subtitulo={`solo los ${aplican.length.toLocaleString("es-CO")} que aplican`}
            barras={nivel3}
            total={aplican.length}
            elegida={seleccion.nivel === 3 ? seleccion.clave : null}
            onElegir={(clave) => setSeleccion({ nivel: 3, clave })}
          />
          <Nivel
            numero={4}
            titulo={`Detalle: ${nombreSeleccion}`}
            subtitulo={`${grupoSeleccionado.length.toLocaleString("es-CO")} contactos · campo "Estado de gestión"`}
            barras={nivel4}
            total={grupoSeleccionado.length}
            elegida={null}
          />
        </div>
      </section>
    </div>
  );
}

function Filtro({
  etiqueta,
  angosto,
  children,
}: {
  etiqueta: string;
  angosto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={angosto ? "min-w-[150px]" : "min-w-[210px]"}>
      <label className="mb-1 block text-xs font-medium text-slate-600">{etiqueta}</label>
      {children}
    </div>
  );
}

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: number; detalle: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor.toLocaleString("es-CO")}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{detalle}</p>
    </div>
  );
}

/** Una columna del embudo: barras horizontales con cantidad y porcentaje. */
function Nivel({
  numero,
  titulo,
  subtitulo,
  barras,
  total,
  elegida,
  onElegir,
}: {
  numero: number;
  titulo: string;
  subtitulo: string;
  barras: Barra[];
  total: number;
  elegida: string | null;
  onElegir?: (clave: string) => void;
}) {
  const maximo = Math.max(1, ...barras.map((b) => b.valor));
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Nivel {numero}</p>
      <h3 className="text-sm font-semibold text-slate-800">{titulo}</h3>
      <p className="mb-3 text-xs text-slate-500">{subtitulo}</p>
      {barras.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-400">Sin datos.</p>
      ) : (
        <ul className="space-y-1">
          {barras.map((b) => {
            const activa = elegida === b.clave;
            const contenido = (
              <>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className={`truncate ${activa ? "font-semibold text-slate-900" : "text-slate-700"}`} title={b.nombre}>
                    {b.nombre}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-500">
                    <strong className="font-semibold text-slate-800">{b.valor.toLocaleString("es-CO")}</strong>{" "}
                    · {porcentaje(b.valor, total)}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${(b.valor / maximo) * 100}%`,
                      minWidth: b.valor > 0 ? 4 : 0,
                      backgroundColor: COLOR_BARRA,
                    }}
                  />
                </div>
              </>
            );
            return (
              <li key={b.clave}>
                {onElegir ? (
                  <button
                    type="button"
                    onClick={() => onElegir(b.clave)}
                    aria-pressed={activa}
                    className={`w-full rounded-md border px-2 py-1.5 text-left transition-colors ${
                      activa ? "border-slate-300 bg-slate-50" : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    {contenido}
                  </button>
                ) : (
                  <div className="px-2 py-1.5">{contenido}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TablaDesglose({
  filas,
  elegida,
  onElegir,
}: {
  filas: FilaDesglose[];
  elegida: string;
  onElegir: (clave: string) => void;
}) {
  return (
    <table className="mt-3 w-full min-w-[760px] text-left text-sm">
      <thead>
        <tr className="border-y border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <th className="px-4 py-3">Comercial</th>
          <th className="px-4 py-3 text-right">Leads</th>
          <th className="px-4 py-3 text-right">Aplican</th>
          <th className="px-4 py-3 text-right">% aplica</th>
          <th className="px-4 py-3 text-right">En gestión</th>
          <th className="px-4 py-3 text-right">Clientes</th>
          <th className="px-4 py-3 text-right">% conversión</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => {
          const activa = elegida === f.clave;
          return (
            <tr
              key={f.clave}
              onClick={() => onElegir(f.clave)}
              className={`cursor-pointer border-b border-slate-100 last:border-0 ${
                activa ? "bg-blue-50/60" : "hover:bg-slate-50"
              } ${f.leads === 0 ? "text-slate-400" : "text-slate-700"}`}
              title="Clic para filtrar el panel por esta fila"
            >
              <td className="px-4 py-2.5">
                <span className={activa ? "font-semibold text-slate-900" : "font-medium"}>{f.nombre}</span>
                {f.nota && <span className="ml-2 text-[11px] text-slate-400">{f.nota}</span>}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{f.leads.toLocaleString("es-CO")}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{f.aplica.toLocaleString("es-CO")}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{porcentaje(f.aplica, f.leads)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{f.gestion.toLocaleString("es-CO")}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{f.clientes.toLocaleString("es-CO")}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{porcentaje(f.clientes, f.aplica)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function fechaCorta(fecha: string): string {
  if (!fecha) return "—";
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

function textoRango(desde: string, hasta: string): string {
  if (!desde && !hasta) return "Todo el histórico";
  if (desde && hasta) return `${fechaCorta(desde)} – ${fechaCorta(hasta)}`;
  return desde ? `Desde ${fechaCorta(desde)}` : `Hasta ${fechaCorta(hasta)}`;
}
