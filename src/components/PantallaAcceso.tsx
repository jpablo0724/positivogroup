import { useState } from "react";
import PositivoLogo from "./PositivoLogo";
import { BackendNoDisponible, SinAcceso, verificarCodigo } from "../utils/api";
import { selectTriggerClass } from "./SearchableSelect";

interface PantallaAccesoProps {
  onEntrar: (codigo: string) => void;
  /** Mensaje de por qué se volvió a pedir el código, si aplica. */
  aviso?: string | null;
}

/**
 * Entrada al sistema. El código lo define el administrador en Netlify
 * (variable APP_ACCESS_CODE) y lo comparte con el equipo.
 */
export default function PantallaAcceso({
  onEntrar,
  aviso,
}: PantallaAccesoProps) {
  const [codigo, setCodigo] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    if (codigo.trim() === "" || verificando) return;

    setVerificando(true);
    setError(null);

    try {
      await verificarCodigo(codigo);
      onEntrar(codigo);
    } catch (err) {
      if (err instanceof SinAcceso) {
        setError("Código incorrecto. Verifícalo con el administrador.");
      } else if (err instanceof BackendNoDisponible) {
        setError(err.message);
      } else {
        setError("No se pudo verificar el código.");
      }
      setVerificando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl"
      >
        <PositivoLogo />
        <h1 className="mt-6 text-lg font-semibold text-slate-900">
          Sistema de cotizaciones
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Escribe el código de acceso del equipo para entrar.
        </p>

        {aviso && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {aviso}
          </p>
        )}

        <label className="mt-6 mb-1 block text-xs font-medium text-slate-600">
          Código de acceso
        </label>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          className={selectTriggerClass}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="••••••••"
        />

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={codigo.trim() === "" || verificando}
          className="mt-5 w-full rounded-md bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {verificando ? "Verificando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
