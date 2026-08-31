import { useEffect, useState } from "react";
import {
  eliminarUsuario,
  generarContrasena,
  listarUsuarios,
  restablecerContrasena,
} from "../utils/admin";
import { MINIMO_CONTRASENA, type UsuarioPublico } from "../utils/auth";
import { selectTriggerClass } from "./SearchableSelect";

interface AdminUsuariosProps {
  yo: UsuarioPublico;
  onError: (err: unknown) => void;
}

/**
 * Cuentas del equipo: quién tiene acceso, restablecer contraseñas y quitar a
 * quien ya no debe entrar.
 */
export default function AdminUsuarios({ yo, onError }: AdminUsuariosProps) {
  const [usuarios, setUsuarios] = useState<UsuarioPublico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  const [restableciendo, setRestableciendo] = useState<UsuarioPublico | null>(
    null,
  );
  const [nueva, setNueva] = useState("");
  const [lista, setLista] = useState<{ email: string; clave: string } | null>(
    null,
  );
  const [porEliminar, setPorEliminar] = useState<UsuarioPublico | null>(null);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    listarUsuarios()
      .then(setUsuarios)
      .catch(onError)
      .finally(() => setCargando(false));
  }, [onError]);

  function abrirRestablecer(usuario: UsuarioPublico) {
    setRestableciendo(usuario);
    setNueva(generarContrasena());
    setLista(null);
  }

  async function confirmarRestablecer() {
    if (!restableciendo || nueva.length < MINIMO_CONTRASENA) return;
    const email = restableciendo.email;

    setOcupado(true);
    try {
      await restablecerContrasena(email, nueva);
      setRestableciendo(null);
      // Se muestra una sola vez, para poder dictársela a la persona.
      setLista({ email, clave: nueva });
    } catch (err) {
      onError(err);
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Descarga el respaldo desde dentro del sistema.
   *
   * Se hace así y no abriendo /api/admin/exportar en el navegador porque la
   * cookie de sesión es SameSite=Strict: escribir la dirección a mano no
   * siempre la envía y la respuesta sería "sin sesión". Desde aquí la petición
   * sale de la propia página, con la sesión puesta.
   */
  async function descargarRespaldo() {
    setDescargando(true);
    try {
      const respuesta = await fetch("/api/admin/exportar", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });

      if (!respuesta.ok) {
        const detalle = await respuesta.json().catch(() => null);
        throw new Error(
          detalle?.error === "sin_sesion"
            ? "Tu sesión venció. Vuelve a entrar e inténtalo de nuevo."
            : (detalle?.mensaje ?? "No se pudo generar el respaldo."),
        );
      }

      const contenido = await respuesta.blob();
      const enlace = document.createElement("a");
      enlace.href = URL.createObjectURL(contenido);
      enlace.download = `positivogroup-respaldo-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(enlace.href);
    } catch (err) {
      onError(err);
    } finally {
      setDescargando(false);
    }
  }

  async function confirmarEliminar() {
    if (!porEliminar) return;
    const email = porEliminar.email;
    setPorEliminar(null);
    setOcupado(true);
    try {
      await eliminarUsuario(email);
      setUsuarios(await listarUsuarios());
    } catch (err) {
      onError(err);
    } finally {
      setOcupado(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-slate-500">Cargando cuentas…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      {lista && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">
            Contraseña nueva para {lista.email}
          </p>
          <p className="mt-2 font-mono text-lg tracking-wide text-emerald-900">
            {lista.clave}
          </p>
          <p className="mt-2 text-xs text-emerald-700">
            Anótala ahora: no se vuelve a mostrar. Pásasela por un medio seguro
            y dile que la cambie al entrar, desde "Cambiar contraseña" en el
            menú. Sus sesiones abiertas ya se cerraron.
          </p>
          <button
            type="button"
            onClick={() => setLista(null)}
            className="mt-3 text-xs font-medium text-emerald-700 underline"
          >
            Ya la anoté
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">
            Respaldo de la base de datos
          </p>
          <p className="text-xs text-slate-500">
            Cotizaciones, catálogo, cuentas y enlaces en un archivo. Guárdalo en
            un lugar seguro: incluye los datos de tus clientes.
          </p>
        </div>
        <button
          type="button"
          onClick={descargarRespaldo}
          disabled={descargando}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          {descargando ? "Preparando…" : "Descargar respaldo"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Desde</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => {
              const soyYo = usuario.email === yo.email;
              return (
                <tr
                  key={usuario.email}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {usuario.nombre}
                    {usuario.admin && (
                      <span className="ml-2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                        Admin
                      </span>
                    )}
                    {soyYo && (
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        (tú)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{usuario.email}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {usuario.creadoEn
                      ? new Date(usuario.creadoEn).toLocaleDateString("es-CO")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => abrirRestablecer(usuario)}
                        disabled={ocupado}
                        className="text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:text-slate-300"
                      >
                        Restablecer contraseña
                      </button>
                      {!soyYo && (
                        <button
                          type="button"
                          onClick={() => setPorEliminar(usuario)}
                          disabled={ocupado}
                          className="text-xs font-medium text-red-500 hover:text-red-600 disabled:text-slate-300"
                        >
                          Quitar acceso
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {restableciendo && (
        <Ventana onCerrar={() => setRestableciendo(null)}>
          <h2 className="text-base font-semibold text-slate-900">
            Restablecer contraseña
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Se le pondrá una contraseña nueva a{" "}
            <strong>{restableciendo.nombre}</strong> y se cerrarán sus sesiones
            abiertas.
          </p>

          <label className="mt-4 mb-1 block text-xs font-medium text-slate-600">
            Contraseña temporal
          </label>
          <input
            className={`${selectTriggerClass} font-mono`}
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setNueva(generarContrasena())}
            className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700"
          >
            Generar otra
          </button>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRestableciendo(null)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarRestablecer}
              disabled={nueva.length < MINIMO_CONTRASENA || ocupado}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:bg-slate-300"
            >
              Restablecer
            </button>
          </div>
        </Ventana>
      )}

      {porEliminar && (
        <Ventana onCerrar={() => setPorEliminar(null)}>
          <h2 className="text-base font-semibold text-slate-900">
            Quitar acceso
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            <strong>{porEliminar.nombre}</strong> no podrá volver a entrar y sus
            sesiones abiertas se cerrarán.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Las cotizaciones que haya creado no se borran.
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
              onClick={confirmarEliminar}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
            >
              Quitar acceso
            </button>
          </div>
        </Ventana>
      )}
    </div>
  );
}

function Ventana({
  children,
  onCerrar,
}: {
  children: React.ReactNode;
  onCerrar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={onCerrar}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        {children}
      </div>
    </div>
  );
}
