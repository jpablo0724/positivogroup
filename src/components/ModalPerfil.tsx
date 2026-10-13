import { useState } from "react";
import { ErrorApi } from "../utils/api";
import {
  actualizarPerfil,
  MINIMO_CONTRASENA,
  type UsuarioPublico,
} from "../utils/auth";
import { selectTriggerClass } from "./SearchableSelect";

interface ModalPerfilProps {
  usuario: UsuarioPublico;
  onCerrar: () => void;
  /** Recibe también el correo que tenía antes, por si cambió. */
  onGuardado: (usuario: UsuarioPublico, emailAnterior: string) => void;
  onCambiarContrasena: () => void;
}

const labelClass = "mb-1 block text-xs font-medium text-slate-600";
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mensajeDeError(err: unknown): string {
  if (err instanceof ErrorApi) return err.message;
  return "No se pudo guardar el perfil.";
}

/**
 * Datos propios: nombre, apellidos, correo, teléfono y cargo. El nombre y el
 * correo son los que salen en la firma de cada cotización que la persona
 * haya creado. Cambiar el correo cambia también con qué se inicia sesión, por
 * eso en ese caso se pide la contraseña actual.
 */
export default function ModalPerfil({
  usuario,
  onCerrar,
  onGuardado,
  onCambiarContrasena,
}: ModalPerfilProps) {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [apellidos, setApellidos] = useState(usuario.apellidos);
  const [email, setEmail] = useState(usuario.email);
  const [contrasena, setContrasena] = useState("");
  const [telefono, setTelefono] = useState(usuario.telefono);
  const [cargo, setCargo] = useState(usuario.cargo);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiaEmail =
    email.trim().toLowerCase() !== usuario.email.trim().toLowerCase();
  const emailValido = EMAIL_VALIDO.test(email.trim());
  const valido =
    nombre.trim() !== "" &&
    emailValido &&
    (!cambiaEmail || contrasena.length >= MINIMO_CONTRASENA);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!valido || ocupado) return;

    setOcupado(true);
    setError(null);
    try {
      const actualizado = await actualizarPerfil({
        nombre,
        apellidos,
        email: email.trim(),
        telefono,
        cargo,
        ...(cambiaEmail ? { contrasena } : {}),
      });
      onGuardado(actualizado, usuario.email);
      onCerrar();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={onCerrar}
        aria-hidden
      />
      <form
        onSubmit={guardar}
        role="dialog"
        aria-modal="true"
        aria-label="Perfil"
        className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-base font-semibold text-slate-900">Perfil</h2>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Nombre</label>
              <input
                autoFocus
                className={selectTriggerClass}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Apellidos</label>
              <input
                className={selectTriggerClass}
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Cargo</label>
            <input
              className={selectTriggerClass}
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Correo</label>
            <input
              type="email"
              className={selectTriggerClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {cambiaEmail && (
              <p className="mt-1 text-xs text-slate-500">
                Con este correo iniciarás sesión de ahora en adelante, y
                saldrá en tus cotizaciones.
              </p>
            )}
          </div>
          {cambiaEmail && (
            <div>
              <label className={labelClass}>
                Contraseña actual{" "}
                <span className="text-slate-400">(para cambiar el correo)</span>
              </label>
              <input
                type="password"
                autoComplete="current-password"
                className={selectTriggerClass}
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className={labelClass}>Teléfono</label>
            <input
              type="tel"
              className={selectTriggerClass}
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onCambiarContrasena}
            className="text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            Cambiar contraseña
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!valido || ocupado}
              className="rounded-md boton-accion px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              {ocupado ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
