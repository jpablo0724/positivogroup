import { useEffect, useState } from "react";
import type { InvoiceData } from "../types";
import { ErrorApi } from "../utils/api";
import {
  empresaDeLaCotizacion,
  enviarNota,
  textoDeNota,
} from "../utils/notaClientify";

interface ModalEnviarClientifyProps {
  data: InvoiceData;
  onCerrar: () => void;
}

type Estado =
  | { paso: "buscando" }
  | { paso: "sin-empresa" }
  | { paso: "listo"; empresaId: number }
  | { paso: "enviando"; empresaId: number }
  | { paso: "enviada" }
  | { paso: "error"; detalle: string };

/**
 * Anota la cotización en la ficha de la empresa en Clientify.
 *
 * Muestra antes el texto exacto que se va a guardar: escribe en el CRM de
 * producción, así que conviene ver qué se manda antes de mandarlo.
 */
export default function ModalEnviarClientify({
  data,
  onCerrar,
}: ModalEnviarClientifyProps) {
  const [estado, setEstado] = useState<Estado>({ paso: "buscando" });
  const nota = textoDeNota(data);

  useEffect(() => {
    let cancelado = false;
    empresaDeLaCotizacion(data)
      .then((empresaId) => {
        if (cancelado) return;
        setEstado(
          empresaId === null
            ? { paso: "sin-empresa" }
            : { paso: "listo", empresaId },
        );
      })
      .catch((err) => {
        if (!cancelado) {
          setEstado({
            paso: "error",
            detalle:
              err instanceof Error ? err.message : "No se pudo consultar Clientify",
          });
        }
      });
    return () => {
      cancelado = true;
    };
  }, [data]);

  async function enviar() {
    if (estado.paso !== "listo") return;
    const { empresaId } = estado;
    setEstado({ paso: "enviando", empresaId });

    try {
      await enviarNota(empresaId, data);
      setEstado({ paso: "enviada" });
    } catch (err) {
      // El backend devuelve lo que respondió Clientify, que es lo que hace
      // falta para saber qué corregir.
      const detalle =
        err instanceof ErrorApi
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo enviar la nota";
      setEstado({ paso: "error", detalle });
    }
  }

  const enviando = estado.paso === "enviando";

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
        aria-label="Enviar a Clientify"
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Enviar a Clientify
          </h2>
          <p className="text-xs text-slate-500">
            Se guarda como anotación en la ficha de la empresa.
          </p>
        </div>

        <div className="overflow-auto px-5 py-4">
          {estado.paso === "buscando" && (
            <p className="text-sm text-slate-500">Buscando la empresa…</p>
          )}

          {estado.paso === "sin-empresa" && (
            <div className="rounded-md bg-amber-50 px-3 py-3 text-sm text-amber-800">
              <p className="font-medium">
                Esta cotización no está asociada a una empresa de Clientify.
              </p>
              <p className="mt-1 text-xs">
                Abre la cotización con "Ver", borra la razón social y vuelve a
                elegir la empresa desde el buscador de Clientify. Así queda
                vinculada y se puede anotar sin riesgo de mandársela a otra
                empresa.
              </p>
            </div>
          )}

          {estado.paso === "enviada" && (
            <div className="rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
              La cotización quedó anotada en la ficha de la empresa en
              Clientify.
            </div>
          )}

          {estado.paso === "error" && (
            <div className="rounded-md bg-red-50 px-3 py-3 text-sm text-red-800">
              <p className="font-medium">No se pudo enviar.</p>
              <p className="mt-1 break-words text-xs">{estado.detalle}</p>
            </div>
          )}

          {(estado.paso === "listo" ||
            estado.paso === "enviando" ||
            estado.paso === "error") && (
            <>
              <p className="mt-3 mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                Esto es lo que se va a guardar
              </p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                {nota}
              </pre>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
          >
            {estado.paso === "enviada" ? "Cerrar" : "Cancelar"}
          </button>
          {estado.paso !== "enviada" && estado.paso !== "sin-empresa" && (
            <button
              type="button"
              onClick={enviar}
              disabled={estado.paso !== "listo" || enviando}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {enviando ? "Enviando…" : "Enviar a Clientify"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
