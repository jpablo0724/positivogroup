import { useEffect, useState } from "react";
import InvoicePreview from "./InvoicePreview";
import PositivoLogo from "./PositivoLogo";
import type { CotizacionGuardada } from "../types";

interface CotizacionPublicaProps {
  testigo: string;
}

type Estado =
  | { paso: "cargando" }
  | { paso: "lista"; cotizacion: CotizacionGuardada }
  | { paso: "error"; mensaje: string };

/**
 * Cotización tal como la ve el cliente al abrir el enlace que se le mandó.
 *
 * No pasa por el login: quien recibe el enlace no tiene cuenta. Solo muestra
 * la cotización de ese enlace, y desde aquí puede guardarla en PDF.
 */
export default function CotizacionPublica({ testigo }: CotizacionPublicaProps) {
  const [estado, setEstado] = useState<Estado>({ paso: "cargando" });

  useEffect(() => {
    let cancelado = false;

    fetch(`/api/publico/${encodeURIComponent(testigo)}`, {
      headers: { Accept: "application/json" },
    })
      .then(async (respuesta) => {
        const datos = await respuesta.json().catch(() => null);
        if (cancelado) return;

        if (!respuesta.ok || !datos?.cotizacion) {
          setEstado({
            paso: "error",
            mensaje:
              respuesta.status === 404
                ? "Este enlace no es válido o la cotización ya no está disponible."
                : "No se pudo cargar la cotización.",
          });
          return;
        }
        setEstado({ paso: "lista", cotizacion: datos.cotizacion });
      })
      .catch(() => {
        if (!cancelado) {
          setEstado({ paso: "error", mensaje: "No se pudo cargar la cotización." });
        }
      });

    return () => {
      cancelado = true;
    };
  }, [testigo]);

  if (estado.paso === "cargando") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Cargando cotización…</p>
      </div>
    );
  }

  if (estado.paso === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-sm rounded-xl bg-white p-8 text-center shadow-sm">
          <PositivoLogo />
          <p className="mt-6 text-sm text-slate-700">{estado.mensaje}</p>
          <p className="mt-2 text-xs text-slate-500">
            Escríbele a quien te lo envió para que te comparta uno nuevo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="solo-pantalla border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[920px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="min-w-0">
            <PositivoLogo />
            <p className="mt-1 truncate text-xs text-slate-500">
              Cotización N.º {estado.cotizacion.data.numeroFactura}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex shrink-0 items-center gap-2 rounded-md boton-accion px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            Descargar PDF
          </button>
        </div>
      </div>

      <div className="hoja mx-auto max-w-[920px] p-6">
        <InvoicePreview data={estado.cotizacion.data} />
      </div>
    </div>
  );
}
