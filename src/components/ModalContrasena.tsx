import { useState } from "react";
import { ErrorApi } from "../utils/api";
import { MINIMO_CONTRASENA, cambiarContrasena } from "../utils/auth";
import { selectTriggerClass } from "./SearchableSelect";

interface ModalContrasenaProps {
  onCerrar: () => void;
}

const labelClass = "mb-1 block text-xs font-medium text-slate-600";

function mensajeDeError(err: unknown): string {
  if (err instanceof ErrorApi) {
    if (err.codigo === "contrasena_actual_incorrecta") {
      return "La contraseña actual no es correcta.";
    }
    if (err.codigo === "contrasena_corta") {
      return `La contraseña nueva debe tener al menos ${MINIMO_CONTRASENA} caracteres.`;
    }
    return err.message;
  }
  return "No se pudo cambiar la contraseña.";
}

/**
 * Cambio de contraseña propia. Al cambiarla se cierran las sesiones abiertas
 * en otros equipos, que es lo que hace falta cuando la contraseña la puso un
 * administrador o cuando se sospecha que alguien más la conoce.
 */
export default function ModalContrasena({ onCerrar }: ModalContrasenaProps) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lista, setLista] = useState(false);

  const coinciden = nueva !== "" && nueva === repetida;
  const valido =
    actual !== "" && nueva.length >= MINIMO_CONTRASENA && coinciden;

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!valido || ocupado) return;

    setOcupado(true);
    setError(null);
    try {
      await cambiarContrasena(actual, nueva);
      setLista(true);
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
        aria-label="Cambiar contraseña"
        className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-base font-semibold text-slate-900">
          Cambiar contraseña
        </h2>

        {lista ? (
          <>
            <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Contraseña cambiada. Las sesiones que tuvieras abiertas en otros
              equipos se cerraron.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onCerrar}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                Listo
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              <div>
                <label className={labelClass}>Contraseña actual</label>
                <input
                  type="password"
                  autoFocus
                  autoComplete="current-password"
                  className={selectTriggerClass}
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Contraseña nueva</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={selectTriggerClass}
                  value={nueva}
                  onChange={(e) => setNueva(e.target.value)}
                  placeholder={`Mínimo ${MINIMO_CONTRASENA} caracteres`}
                />
              </div>
              <div>
                <label className={labelClass}>Repite la nueva</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={selectTriggerClass}
                  value={repetida}
                  onChange={(e) => setRepetida(e.target.value)}
                />
                {repetida !== "" && !coinciden && (
                  <p className="mt-1 text-xs text-red-600">
                    Las dos contraseñas no coinciden.
                  </p>
                )}
              </div>
            </div>

            {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
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
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:bg-slate-300"
              >
                {ocupado ? "Guardando…" : "Cambiar"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
