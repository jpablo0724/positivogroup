import { useEffect, useRef, useState } from "react";
import {
  actualizarUsuario,
  crearUsuario,
  eliminarUsuario,
  generarContrasena,
  listarUsuarios,
  restablecerContrasena,
  restaurarRespaldo,
  type ResumenImportacion,
} from "../utils/admin";
import {
  MINIMO_CONTRASENA,
  nombreCompleto,
  type Permisos,
  type Rol,
  type UsuarioPublico,
} from "../utils/auth";
import { selectTriggerClass } from "./SearchableSelect";

interface AdminUsuariosProps {
  yo: UsuarioPublico;
  onError: (err: unknown) => void;
}

/** Las secciones que se pueden habilitar por cuenta, en el orden de la tabla. */
const SECCIONES: { clave: keyof Permisos; etiqueta: string }[] = [
  { clave: "cotizaciones", etiqueta: "Cotizaciones" },
  { clave: "catalogo", etiqueta: "Catálogo" },
  { clave: "usuarios", etiqueta: "Usuarios" },
];

const PERMISOS_NUEVOS: Permisos = {
  cotizaciones: true,
  catalogo: false,
  usuarios: false,
};

interface Formulario {
  /** El correo de la cuenta que se edita, o null si se está creando. */
  editando: string | null;
  nombre: string;
  apellidos: string;
  email: string;
  rol: Rol;
  permisos: Permisos;
}

const VACIO: Formulario = {
  editando: null,
  nombre: "",
  apellidos: "",
  email: "",
  rol: "basico",
  permisos: { ...PERMISOS_NUEVOS },
};

/**
 * Cuentas del equipo: quién entra, con qué rol y a qué secciones llega.
 *
 * Un administrador lo ve todo, incluidas las cotizaciones de los demás. Una
 * cuenta básica solo ve las suyas, y sus secciones se habilitan una a una con
 * las casillas de la tabla. Todo esto lo comprueba también el backend: aquí se
 * decide qué se enseña, no qué se permite.
 */
export default function AdminUsuarios({ yo, onError }: AdminUsuariosProps) {
  const [usuarios, setUsuarios] = useState<UsuarioPublico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  const [restableciendo, setRestableciendo] = useState<UsuarioPublico | null>(
    null,
  );
  const [nueva, setNueva] = useState("");
  const [lista, setLista] = useState<{
    email: string;
    clave: string;
    creada?: boolean;
  } | null>(null);
  const [porEliminar, setPorEliminar] = useState<UsuarioPublico | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [resumen, setResumen] = useState<ResumenImportacion | null>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const [formulario, setFormulario] = useState<Formulario | null>(null);

  // Ver la sección basta con el permiso; cambiar cuentas exige ser
  // administrador. Sin esto, una cuenta básica con acceso podría ascenderse.
  const puedoAdministrar = yo.rol === "admin";

  useEffect(() => {
    listarUsuarios()
      .then(setUsuarios)
      .catch(onError)
      .finally(() => setCargando(false));
  }, [onError]);

  function abrirCrear() {
    setFormulario({ ...VACIO, permisos: { ...PERMISOS_NUEVOS } });
    setLista(null);
  }

  function abrirEditar(usuario: UsuarioPublico) {
    setFormulario({
      editando: usuario.email,
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      email: usuario.email,
      rol: usuario.rol,
      permisos: { ...usuario.permisos },
    });
    setLista(null);
  }

  async function guardarFormulario() {
    if (!formulario) return;
    const { editando, nombre, apellidos, email, rol, permisos } = formulario;
    if (nombre.trim() === "" || email.trim() === "") return;

    setOcupado(true);
    try {
      if (editando) {
        await actualizarUsuario(editando, { nombre, apellidos, rol, permisos });
      } else {
        // La contraseña la genera el sistema y se muestra una sola vez, igual
        // que al restablecerla: así no viaja escrita en ningún sitio.
        const clave = generarContrasena();
        await crearUsuario({
          nombre,
          apellidos,
          email,
          rol,
          permisos,
          contrasena: clave,
        });
        setLista({ email: email.trim().toLowerCase(), clave, creada: true });
      }
      setFormulario(null);
      setUsuarios(await listarUsuarios());
    } catch (err) {
      onError(err);
    } finally {
      setOcupado(false);
    }
  }

  /** Marca o desmarca una sección desde la propia tabla. */
  async function cambiarPermiso(
    usuario: UsuarioPublico,
    seccion: keyof Permisos,
    valor: boolean,
  ) {
    setOcupado(true);
    try {
      await actualizarUsuario(usuario.email, {
        nombre: usuario.nombre,
        apellidos: usuario.apellidos,
        rol: usuario.rol,
        permisos: { ...usuario.permisos, [seccion]: valor },
      });
      setUsuarios(await listarUsuarios());
    } catch (err) {
      onError(err);
    } finally {
      setOcupado(false);
    }
  }

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

  /**
   * Carga un respaldo en la base de datos que esté detrás en este momento.
   *
   * Es lo que permite mudar el sistema de servidor sin tocar una consola: se
   * descarga el respaldo del servidor viejo y se sube aquí. No pisa lo que ya
   * exista, así que subir el mismo archivo dos veces deja lo mismo.
   */
  async function restaurar(evento: React.ChangeEvent<HTMLInputElement>) {
    const elegido = evento.target.files?.[0];
    // Se limpia enseguida para poder volver a elegir el mismo archivo.
    evento.target.value = "";
    if (!elegido) return;

    setRestaurando(true);
    setResumen(null);
    try {
      const contenido = JSON.parse(await elegido.text());
      if (!contenido?.almacenes) {
        throw new Error(
          "Ese archivo no es un respaldo del sistema: le falta la sección " +
            '"almacenes".',
        );
      }

      setResumen(await restaurarRespaldo(contenido.almacenes));
      setUsuarios(await listarUsuarios());
    } catch (err) {
      onError(err);
    } finally {
      setRestaurando(false);
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
            {lista.creada ? "Cuenta creada:" : "Contraseña nueva para"}{" "}
            {lista.email}
          </p>
          <p className="mt-2 font-mono text-lg tracking-wide text-emerald-900">
            {lista.clave}
          </p>
          <p className="mt-2 text-xs text-emerald-700">
            Anótala ahora: no se vuelve a mostrar. Pásasela por un medio seguro
            y dile que la cambie al entrar, desde "Cambiar contraseña" en el
            menú.{!lista.creada && " Sus sesiones abiertas ya se cerraron."}
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

      {resumen && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">
            Respaldo cargado: {resumen.escritos}{" "}
            {resumen.escritos === 1 ? "registro" : "registros"}.
          </p>
          <ul className="mt-2 space-y-0.5 text-xs text-emerald-800">
            {Object.entries(resumen.detalle).map(([nombre, cuenta]) => (
              <li key={nombre}>
                {nombre}: {cuenta.escritos}
                {cuenta.omitidos > 0 && ` (${cuenta.omitidos} ya estaban)`}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setResumen(null)}
            className="mt-3 text-xs font-medium text-emerald-700 underline"
          >
            Entendido
          </button>
        </div>
      )}

      <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">
              Respaldo de la base de datos
            </p>
            <p className="text-xs text-slate-500">
              Cotizaciones, catálogo, cuentas y enlaces en un archivo. Guárdalo
              en un lugar seguro: incluye los datos de tus clientes.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={descargarRespaldo}
              disabled={descargando}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              {descargando ? "Preparando…" : "Descargar respaldo"}
            </button>
            <button
              type="button"
              onClick={() => archivo.current?.click()}
              disabled={restaurando}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              {restaurando ? "Cargando…" : "Cargar respaldo"}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Cargar un respaldo agrega lo que falte sin tocar lo que ya está, así
          que es la forma de mudar el sistema a otro servidor.
        </p>
        <input
          ref={archivo}
          type="file"
          accept="application/json,.json"
          onChange={restaurar}
          className="hidden"
          aria-label="Archivo de respaldo"
        />
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            Cuentas del equipo
          </h2>
          <p className="text-xs text-slate-500">
            Un administrador ve las cotizaciones de todos; una cuenta básica,
            solo las suyas.
          </p>
        </div>
        {puedoAdministrar && (
          <button
            type="button"
            onClick={abrirCrear}
            className="shrink-0 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            + Crear usuario
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Rol</th>
              {SECCIONES.map((seccion) => (
                <th key={seccion.clave} className="px-3 py-3 text-center">
                  {seccion.etiqueta}
                </th>
              ))}
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => {
              const soyYo = usuario.email === yo.email;
              const esAdmin = usuario.rol === "admin";
              return (
                <tr
                  key={usuario.email}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {nombreCompleto(usuario)}
                    {soyYo && (
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        (tú)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{usuario.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        esAdmin
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {esAdmin ? "Admin" : "Básico"}
                    </span>
                  </td>

                  {/* Un administrador lo ve todo por su rol, así que sus
                      casillas van marcadas y bloqueadas: no hay nada que
                      ajustarle. */}
                  {SECCIONES.map((seccion) => (
                    <td key={seccion.clave} className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={usuario.permisos[seccion.clave]}
                        disabled={esAdmin || ocupado || !puedoAdministrar}
                        onChange={(e) =>
                          cambiarPermiso(usuario, seccion.clave, e.target.checked)
                        }
                        aria-label={`${seccion.etiqueta} para ${usuario.email}`}
                        className="h-4 w-4 accent-emerald-600 disabled:opacity-40"
                      />
                    </td>
                  ))}

                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      {puedoAdministrar && (
                        <>
                          <button
                            type="button"
                            onClick={() => abrirEditar(usuario)}
                            disabled={ocupado}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 disabled:text-slate-300"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirRestablecer(usuario)}
                            disabled={ocupado}
                            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:text-slate-300"
                          >
                            Contraseña
                          </button>
                          {!soyYo && (
                            <button
                              type="button"
                              onClick={() => setPorEliminar(usuario)}
                              disabled={ocupado}
                              className="text-xs font-medium text-red-500 hover:text-red-600 disabled:text-slate-300"
                            >
                              Eliminar
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {formulario && (
        <Ventana onCerrar={() => setFormulario(null)}>
          <h2 className="text-base font-semibold text-slate-900">
            {formulario.editando ? "Editar cuenta" : "Crear usuario"}
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Nombres
              </label>
              <input
                autoFocus
                className={selectTriggerClass}
                value={formulario.nombre}
                onChange={(e) =>
                  setFormulario({ ...formulario, nombre: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Apellidos
              </label>
              <input
                className={selectTriggerClass}
                value={formulario.apellidos}
                onChange={(e) =>
                  setFormulario({ ...formulario, apellidos: e.target.value })
                }
              />
            </div>
          </div>

          <label className="mt-3 mb-1 block text-xs font-medium text-slate-600">
            Correo
          </label>
          <input
            type="email"
            // El correo identifica la cuenta, así que al editar no se cambia:
            // sería crear otra distinta y perder lo que tenga asociado.
            disabled={formulario.editando !== null}
            className={`${selectTriggerClass} disabled:bg-slate-50 disabled:text-slate-400`}
            value={formulario.email}
            onChange={(e) =>
              setFormulario({ ...formulario, email: e.target.value })
            }
            placeholder="nombre@positivogroup.com"
          />

          <label className="mt-3 mb-1 block text-xs font-medium text-slate-600">
            Rol
          </label>
          <div className="flex gap-2">
            {(
              [
                ["basico", "Básico"],
                ["admin", "Administrador"],
              ] as const
            ).map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setFormulario({ ...formulario, rol: valor })}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  formulario.rol === valor
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          {formulario.rol === "admin" ? (
            <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Un administrador entra a todas las secciones y ve las cotizaciones
              de todo el equipo.
            </p>
          ) : (
            <>
              <p className="mt-4 text-xs font-medium text-slate-600">
                Qué puede ver
              </p>
              <p className="mb-2 text-[11px] text-slate-400">
                Crear cotizaciones lo puede siempre; solo verá las suyas.
              </p>
              <div className="space-y-2">
                {SECCIONES.map((seccion) => (
                  <label
                    key={seccion.clave}
                    className="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={formulario.permisos[seccion.clave]}
                      onChange={(e) =>
                        setFormulario({
                          ...formulario,
                          permisos: {
                            ...formulario.permisos,
                            [seccion.clave]: e.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 accent-emerald-600"
                    />
                    {seccion.etiqueta}
                  </label>
                ))}
              </div>
            </>
          )}

          {!formulario.editando && (
            <p className="mt-4 text-[11px] text-slate-400">
              La contraseña se genera sola y se muestra al terminar. Anótala:
              solo se ve una vez.
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormulario(null)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardarFormulario}
              disabled={
                ocupado ||
                formulario.nombre.trim() === "" ||
                formulario.email.trim() === ""
              }
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:bg-slate-300"
            >
              {formulario.editando ? "Guardar" : "Crear cuenta"}
            </button>
          </div>
        </Ventana>
      )}

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
