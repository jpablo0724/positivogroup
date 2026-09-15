import { useState } from "react";
import LogoEmpresa from "./LogoEmpresa";
import { BackendNoDisponible, ErrorApi } from "../utils/api";
import { MINIMO_CONTRASENA, restablecerContrasena } from "../utils/auth";
import { selectTriggerClass } from "./SearchableSelect";

interface PantallaRestablecerProps {
  token: string;
  /** Cuando la contraseña queda restablecida, la sesión ya abrió: falta traer quién es. */
  onRestablecida: () => void;
}

const labelClass = "mb-1 block text-xs font-medium text-slate-600";

function mensajeDeError(err: unknown): string {
  if (err instanceof ErrorApi) {
    switch (err.codigo) {
      case "token_invalido":
        return "Este enlace ya no vale: puede que haya vencido o que ya se haya usado. Pide uno nuevo.";
      case "contrasena_corta":
        return `La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres.`;
      default:
        return err.message;
    }
  }
  if (err instanceof BackendNoDisponible) return err.message;
  return "No se pudo completar la operación.";
}

export default function PantallaRestablecer({
  token,
  onRestablecida,
}: PantallaRestablecerProps) {
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completo = nueva.length >= MINIMO_CONTRASENA && nueva === confirmar;

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!completo || ocupado) return;

    setOcupado(true);
    setError(null);

    try {
      await restablecerContrasena(token, nueva);
      onRestablecida();
    } catch (err) {
      setError(mensajeDeError(err));
      setOcupado(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-marca p-4">
      <form
        onSubmit={enviar}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl"
      >
        <LogoEmpresa />
        <h1 className="mt-6 text-lg font-semibold text-slate-900">
          Pon una contraseña nueva
        </h1>

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
          </div>
          <div>
            <label className={labelClass}>Confirmar contraseña</label>
            <input
              type="password"
              autoComplete="new-password"
              className={selectTriggerClass}
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
            />
            {confirmar !== "" && confirmar !== nueva && (
              <p className="mt-1 text-[11px] text-red-500">
                Las contraseñas no coinciden.
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
          {ocupado ? "Un momento…" : "Restablecer contraseña"}
        </button>
      </form>
    </div>
  );
}
