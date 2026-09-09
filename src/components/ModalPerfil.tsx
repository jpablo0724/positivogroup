import { useState } from "react";
import { ErrorApi } from "../utils/api";
import { actualizarPerfil, type UsuarioPublico } from "../utils/auth";
import { selectTriggerClass } from "./SearchableSelect";

interface ModalPerfilProps {
  usuario: UsuarioPublico;
  onCerrar: () => void;
  onGuardado: (usuario: UsuarioPublico) => void;
  onCambiarContrasena: () => void;
}

const labelClass = "mb-1 block text-xs font-medium text-slate-600";

function mensajeDeError(err: unknown): string {
  if (err instanceof ErrorApi) return err.message;
  return "No se pudo guardar el perfil.";
}

/**
 * Datos propios: nombre y teléfono se pueden cambiar aquí mismo; el correo
 * solo se muestra, porque es la clave con la que el sistema identifica la
 * cuenta y cambiarlo es una operación que hoy no existe.
 */
export default function ModalPerfil({
  usuario,
  onCerrar,
  onGuardado,
  onCambiarContrasena,
}: ModalPerfilProps) {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [telefono, setTelefono] = useState(usuario.telefono);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valido = nombre.trim() !== "";

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!valido || ocupado) return;

    setOcupado(true);
    setError(null);
    try {
      const actualizado = await actualizarPerfil({
        nombre,
        apellidos: usuario.apellidos,
        telefono,
      });
      onGuardado(actualizado);
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
            <label className={labelClass}>Correo</label>
            <input
              type="email"
              disabled
              className={`${selectTriggerClass} disabled:bg-slate-50`}
              value={usuario.email}
            />
          </div>
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
