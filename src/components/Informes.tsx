import { useEffect, useMemo, useState } from "react";
import {
  obtenerInformeContactos,
  type CatalogosInforme,
  type ContactoInforme,
} from "../utils/informes";
import { selectTriggerClass } from "./SearchableSelect";

interface InformesProps {
  onError: (err: unknown) => void;
}

type Dimension = "etiqueta" | "tipoContacto" | "estado" | "estadoGestion";

const DIMENSIONES: { clave: Dimension; etiqueta: string }[] = [
  { clave: "etiqueta", etiqueta: "Etiqueta (campaña)" },
  { clave: "tipoContacto", etiqueta: "Tipo de contacto" },
  { clave: "estado", etiqueta: "Estado del contacto" },
  { clave: "estadoGestion", etiqueta: "Estado de gestión" },
];

// Slot 1 de la paleta categórica validada (azul): un solo color porque el
// gráfico es de una sola serie, la que elige "Agrupar por".
const COLOR_BARRA = "#2a78d6";
const SIN_DATO = "Sin dato";
const TOPE_BARRAS = 12;
const TOPE_FILAS_TABLA = 500;

interface Barra {
  clave: string;
  etiqueta: string;
  valor: number;
}

/** Redondea hacia arriba a un número "bonito" para el techo de la gráfica. */
function techoBonito(maximo: number): number {
  if (maximo <= 0) return 1;
  const exponente = Math.pow(10, Math.floor(Math.log10(maximo)));
  const normalizado = maximo / exponente;
  const paso = normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 5 ? 5 : 10;
  return paso * exponente;
}

export default function Informes({ onError }: InformesProps) {
  const [contactos, setContactos] = useState<ContactoInforme[]>([]);
  const [catalogos, setCatalogos] = useState<CatalogosInforme | null>(null);
  const [cargando, setCargando] = useState(true);

  const [etiqueta, setEtiqueta] = useState("");
  const [tipoContacto, setTipoContacto] = useState("");
  const [estado, setEstado] = useState("");
  const [estadoGestion, setEstadoGestion] = useState("");
  const [dimension, setDimension] = useState<Dimension>("etiqueta");
  const [resaltada, setResaltada] = useState<string | null>(null);

  useEffect(() => {
    obtenerInformeContactos()
      .then((datos) => {
        setContactos(datos.contactos);
        setCatalogos(datos.catalogos);
      })
      .catch(onError)
      .finally(() => setCargando(false));
  }, [onError]);

  const etiquetaPorClave = useMemo(() => {
    const mapa = new Map<string, string>();
    catalogos?.etiquetas.forEach((e) => mapa.set(e.etiqueta, e.nombre));
    return mapa;
  }, [catalogos]);

  const estadoPorClave = useMemo(() => {
    const mapa = new Map<string, string>();
    catalogos?.estados.forEach((e) => mapa.set(e.clave, e.etiqueta));
    return mapa;
  }, [catalogos]);

  const filtrados = useMemo(() => {
    return contactos.filter((c) => {
      if (etiqueta && !c.etiquetas.includes(etiqueta)) return false;
      if (tipoContacto && c.tipoContacto !== tipoContacto) return false;
      if (estado && c.estado !== estado) return false;
      if (estadoGestion && c.estadoGestion !== estadoGestion) return false;
      return true;
    });
  }, [contactos, etiqueta, tipoContacto, estado, estadoGestion]);

  const barras = useMemo<Barra[]>(() => {
    if (!catalogos) return [];

    // Por etiqueta se muestran siempre las 5 campañas conocidas, aunque
    // tengan 0 contactos: así se ve de un vistazo cuál se está quedando
    // atrás, no solo las que ya tienen resultados.
    if (dimension === "etiqueta") {
      const conteos = new Map(catalogos.etiquetas.map((e) => [e.etiqueta, 0]));
      for (const c of filtrados) {
        for (const t of c.etiquetas) {
          if (conteos.has(t)) conteos.set(t, (conteos.get(t) ?? 0) + 1);
        }
      }
      return catalogos.etiquetas
        .map((e) => ({ clave: e.etiqueta, etiqueta: e.nombre, valor: conteos.get(e.etiqueta) ?? 0 }))
        .sort((a, b) => b.valor - a.valor);
    }

    const conteos = new Map<string, number>();
    for (const c of filtrados) {
      const valor =
        dimension === "tipoContacto"
          ? c.tipoContacto
          : dimension === "estado"
            ? c.estado
            : c.estadoGestion;
      const clave = valor || SIN_DATO;
      conteos.set(clave, (conteos.get(clave) ?? 0) + 1);
    }

    let lista = [...conteos.entries()]
      .map(([clave, valor]) => ({
        clave,
        etiqueta: dimension === "estado" ? (estadoPorClave.get(clave) ?? clave) : clave,
        valor,
      }))
      .sort((a, b) => b.valor - a.valor);

    // Con muchos valores distintos (tipo de contacto, estado de gestión) la
    // gráfica se vuelve ilegible: se muestran los principales y el resto se
    // agrupa en "Otros".
    if (lista.length > TOPE_BARRAS) {
      const principales = lista.slice(0, TOPE_BARRAS);
      const resto = lista.slice(TOPE_BARRAS).reduce((acc, b) => acc + b.valor, 0);
      lista = [...principales, { clave: "__otros__", etiqueta: "Otros", valor: resto }];
    }

    return lista;
  }, [catalogos, filtrados, dimension, estadoPorClave]);

  const maximo = Math.max(0, ...barras.map((b) => b.valor));
  const techo = techoBonito(maximo);
  const marcasEje = [1, 0.75, 0.5, 0.25, 0].map((f) => Math.round(techo * f));

  if (cargando) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-slate-500">Cargando informe…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* --- Filtros: una sola fila, arriba de todo lo demás --- */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <Filtro etiqueta="Etiqueta (campaña)">
          <select
            className={selectTriggerClass}
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
          >
            <option value="">Todas</option>
            {catalogos?.etiquetas.map((e) => (
              <option key={e.etiqueta} value={e.etiqueta}>
                {e.nombre}
              </option>
            ))}
          </select>
        </Filtro>

        <Filtro etiqueta="Tipo de contacto">
          <select
            className={selectTriggerClass}
            value={tipoContacto}
            onChange={(e) => setTipoContacto(e.target.value)}
          >
            <option value="">Todos</option>
            {catalogos?.tiposContacto.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Filtro>

        <Filtro etiqueta="Estado del contacto">
          <select
            className={selectTriggerClass}
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            <option value="">Todos</option>
            {catalogos?.estados.map((e) => (
              <option key={e.clave} value={e.clave}>
                {e.etiqueta}
              </option>
            ))}
          </select>
        </Filtro>

        <Filtro etiqueta="Estado de gestión">
          <select
            className={selectTriggerClass}
            value={estadoGestion}
            onChange={(e) => setEstadoGestion(e.target.value)}
          >
            <option value="">Todos</option>
            {catalogos?.estadosGestion.map((eg) => (
              <option key={eg} value={eg}>
                {eg}
              </option>
            ))}
          </select>
        </Filtro>

        {(etiqueta || tipoContacto || estado || estadoGestion) && (
          <button
            type="button"
            onClick={() => {
              setEtiqueta("");
              setTipoContacto("");
              setEstado("");
              setEstadoGestion("");
            }}
            className="mb-0.5 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            Quitar filtros
          </button>
        )}
      </div>

      {/* --- Gráfica --- */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              Contactos por {DIMENSIONES.find((d) => d.clave === dimension)?.etiqueta.toLowerCase()}
            </h2>
            <p className="text-xs text-slate-500">
              {filtrados.length} {filtrados.length === 1 ? "contacto" : "contactos"} con los filtros actuales.
            </p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
            {DIMENSIONES.map((d) => (
              <button
                key={d.clave}
                type="button"
                onClick={() => setDimension(d.clave)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  dimension === d.clave
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {d.etiqueta}
              </button>
            ))}
          </div>
        </div>

        {barras.every((b) => b.valor === 0) ? (
          <p className="py-10 text-center text-sm text-slate-400">
            No hay contactos que coincidan con estos filtros.
          </p>
        ) : (
          <div className="flex gap-3">
            {/* Eje Y: valores de referencia */}
            <div className="flex h-56 flex-col justify-between pb-6 text-right text-[11px] text-slate-400">
              {marcasEje.map((m) => (
                <span key={m}>{m.toLocaleString("es-CO")}</span>
              ))}
            </div>

            <div className="min-w-0 flex-1">
              <div className="relative flex h-56 items-end gap-2 border-b border-slate-200">
                {/* Líneas de referencia horizontales */}
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                  {marcasEje.map((m) => (
                    <div key={m} className="border-t border-slate-100" />
                  ))}
                </div>

                {barras.map((b) => {
                  const alturaPct = techo > 0 ? (b.valor / techo) * 100 : 0;
                  return (
                    <div
                      key={b.clave}
                      className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                    >
                      {resaltada === b.clave && (
                        <div className="pointer-events-none absolute -top-8 z-10 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg">
                          {b.valor.toLocaleString("es-CO")} {b.valor === 1 ? "contacto" : "contactos"}
                        </div>
                      )}
                      {b.valor > 0 && (
                        <span className="mb-1 text-xs font-semibold text-slate-700">
                          {b.valor.toLocaleString("es-CO")}
                        </span>
                      )}
                      <button
                        type="button"
                        onMouseEnter={() => setResaltada(b.clave)}
                        onMouseLeave={() => setResaltada(null)}
                        onFocus={() => setResaltada(b.clave)}
                        onBlur={() => setResaltada(null)}
                        aria-label={`${b.etiqueta}: ${b.valor} ${b.valor === 1 ? "contacto" : "contactos"}`}
                        className="w-full max-w-10 rounded-t transition-opacity hover:opacity-80 focus:opacity-80 focus:outline-none"
                        style={{
                          height: `${Math.max(alturaPct, b.valor > 0 ? 2 : 0)}%`,
                          backgroundColor: COLOR_BARRA,
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex gap-2">
                {barras.map((b) => (
                  <div key={b.clave} className="min-w-0 flex-1 text-center">
                    <span
                      className="block truncate text-[11px] text-slate-500"
                      title={b.etiqueta}
                    >
                      {b.etiqueta}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- Tabla --- */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Tipo de contacto</th>
              <th className="px-4 py-3">Estado del contacto</th>
              <th className="px-4 py-3">Estado de gestión</th>
              <th className="px-4 py-3">Etiquetas</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.slice(0, TOPE_FILAS_TABLA).map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">
                  {c.nombre || <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.empresa || <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.tipoContacto || <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.estado ? (estadoPorClave.get(c.estado) ?? c.estado) : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.estadoGestion || <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.etiquetas
                    .map((t) => etiquetaPorClave.get(t))
                    .filter((n): n is string => Boolean(n))
                    .join(", ") || <span className="text-slate-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-400">
            No hay contactos que coincidan con estos filtros.
          </p>
        )}
        {filtrados.length > TOPE_FILAS_TABLA && (
          <p className="border-t border-slate-100 px-4 py-3 text-center text-xs text-slate-400">
            Mostrando {TOPE_FILAS_TABLA} de {filtrados.length} contactos. Usa los filtros para acotar la lista.
          </p>
        )}
      </div>
    </div>
  );
}

function Filtro({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[180px]">
      <label className="mb-1 block text-xs font-medium text-slate-600">{etiqueta}</label>
      {children}
    </div>
  );
}
