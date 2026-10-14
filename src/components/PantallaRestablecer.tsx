import { useEffect, useState } from "react";
import LogoEmpresa from "./LogoEmpresa";
import { BackendNoDisponible, ErrorApi } from "../utils/api";
import {
  MINIMO_CONTRASENA,
  enlaceRestablecimientoValido,
  restablecerConEnlace,
} from "../utils/auth";
import { selectTriggerClass } from "./SearchableSelect";

/**
 * La página del enlace que llega por correo: /restablecer?token=...
 *
 * No pasa por el login, igual que la cotización pública: quien llega aquí es
 * justamente quien no puede entrar. Al terminar, el servidor ya dejó la
 * sesión abierta, así que basta con ir al inicio para estar dentro.
 */

const labelClass = "mb-1 block text-xs font-medium text-slate-600";

type Estado = "validando" | "invalido" | "formulario" | "listo";

/** Vuelve al inicio sin dejar el enlace en el historial del navegador. */
function irAlInicio() {
  window.location.replace("/");
}

export default function PantallaRestablecer({ testigo }: { testigo: string }) {
  const [estado, setEstado] = useState<Estado>(testigo ? "validando" : "invalido");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!testigo) return;
    let vigente = true;

    enlaceRestablecimientoValido(testigo)
      .then((valido) => {
        if (vigente) setEstado(valido ? "formulario" : "invalido");
      })
      .catch(() => {
        // Si no se pudo preguntar, se deja intentar: el servidor vuelve a
        // comprobar el enlace al guardar.
        if (vigente) setEstado("formulario");
      });

    return () => {
      vigente = false;
    };
  }, [testigo]);

  const corta = nueva.length > 0 && nueva.length < MINIMO_CONTRASENA;
  const distintas = repetida.length > 0 && nueva !== repetida;
  const completo =
    nueva.length >= MINIMO_CONTRASENA && nueva === repetida;

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!completo || ocupado) return;

    setOcupado(true);
    setError(null);

    try {
      await restablecerConEnlace(testigo, nueva);
      setEstado("listo");
      setTimeout(irAlInicio, 1500);
    } catch (err) {
      setOcupado(false);
      if (err instanceof ErrorApi && err.codigo === "token_invalido") {
        setEstado("invalido");
      } else if (err instanceof ErrorApi && err.codigo === "contrasena_corta") {
        setError(`La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres.`);
      } else if (err instanceof BackendNoDisponible || err instanceof ErrorApi) {
        setError(err.message);
      } else {
        setError("No se pudo guardar la contraseña. Inténtalo de nuevo.");
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-marca p-4">
      <form
        onSubmit={guardar}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl"
      >
        <LogoEmpresa />
        <h1 className="mt-6 text-lg font-semibold text-slate-900">
          Crear contraseña nueva
        </h1>

        {estado === "validando" && (
          <p className="mt-4 text-sm text-slate-500">Comprobando el enlace…</p>
        )}

        {estado === "invalido" && (
          <>
            <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Este enlace ya no sirve: venció (dura una hora) o ya se usó.
              Pide uno nuevo desde la pantalla de inicio con "¿Olvidaste tu
              contraseña?".
            </p>
            <button
              type="button"
              onClick={irAlInicio}
              className="mt-5 w-full rounded-md boton-accion py-2.5 text-sm font-semibold text-white shadow-sm"
            >
              Ir al inicio de sesión
            </button>
          </>
        )}

        {estado === "listo" && (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            Listo, tu contraseña quedó cambiada. Entrando…
          </p>
        )}

        {estado === "formulario" && (
          <>
            <div className="mt-5 space-y-3">
              <div>
                <label className={labelClass}>Contraseña nueva</label>
                <input
                  type="password"
                  autoFocus
                  autoComplete="new-password"
                  className={selectTriggerClass}
                  value={nueva}
                  onChange={(e) => setNueva(e.target.value)}
                  placeholder={`Mínimo ${MINIMO_CONTRASENA} caracteres`}
                />
                {corta && (
                  <p className="mt-1 text-[11px] text-amber-600">
                    Faltan {MINIMO_CONTRASENA - nueva.length} caracteres.
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass}>Repite la contraseña</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={selectTriggerClass}
                  value={repetida}
                  onChange={(e) => setRepetida(e.target.value)}
                />
                {distintas && (
                  <p className="mt-1 text-[11px] text-amber-600">
                    Las dos contraseñas no coinciden.
                  </p>
                )}
              </div>
            </div>

            {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={!completo || ocupado}
              className="mt-5 w-full rounded-md boton-accion py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed"
            >
              {ocupado ? "Guardando…" : "Guardar y entrar"}
            </button>

            <p className="mt-3 text-[11px] text-slate-400">
              Al guardar se cierran las sesiones abiertas en otros equipos.
            </p>
          </>
        )}
      </form>
    </div>
  );
}
