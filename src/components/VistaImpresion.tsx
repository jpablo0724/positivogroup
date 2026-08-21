import { useEffect } from "react";
import { createPortal } from "react-dom";
import InvoicePreview from "./InvoicePreview";
import type { InvoiceData } from "../types";

interface VistaImpresionProps {
  data: InvoiceData;
  onCerrar: () => void;
  /** Abre el diálogo de impresión apenas se muestra, sin esperar el botón. */
  imprimirAlAbrir?: boolean;
}

/**
 * Cotización a página completa, lista para guardarla en PDF.
 *
 * No genera el PDF por su cuenta: abre el diálogo de impresión del navegador,
 * donde se elige "Guardar como PDF". Sale mejor que generarlo con una
 * librería —el texto queda seleccionable y el archivo pesa unos pocos KB en
 * vez de varios MB— y no agrega dependencias.
 *
 * Se monta fuera de #root para que al imprimir se pueda esconder toda la
 * aplicación y quede solo la hoja.
 */
export default function VistaImpresion({
  data,
  onCerrar,
  imprimirAlAbrir = false,
}: VistaImpresionProps) {
  const destino = document.getElementById("impresion");

  useEffect(() => {
    document.body.classList.add("imprimiendo");
    return () => document.body.classList.remove("imprimiendo");
  }, []);

  useEffect(() => {
    if (!imprimirAlAbrir) return;
    // Un cuadro de animación de margen para que la hoja esté pintada y las
    // fuentes cargadas antes de que el navegador tome la instantánea.
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
    return () => cancelAnimationFrame(id);
  }, [imprimirAlAbrir]);

  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [onCerrar]);

  if (!destino) return null;

  return createPortal(
    <div className="capa-impresion fixed inset-0 z-50 overflow-auto bg-slate-800/70">
      <div className="solo-pantalla sticky top-0 z-10 flex items-center justify-between gap-3 bg-slate-900 px-6 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            Cotización N.º {data.numeroFactura}
          </p>
          <p className="truncate text-xs text-slate-400">
            {data.cliente.razonSocial || "Sin cliente"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold shadow-sm transition-colors hover:bg-emerald-700"
          >
            Guardar como PDF
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
          >
            Cerrar
          </button>
        </div>
      </div>

      <p className="solo-pantalla px-6 pt-3 text-center text-xs text-slate-300">
        En el diálogo que se abre, elige “Guardar como PDF” en el destino.
      </p>

      <div className="hoja mx-auto max-w-[920px] p-6">
        <InvoicePreview data={data} />
      </div>
    </div>,
    destino,
  );
}
