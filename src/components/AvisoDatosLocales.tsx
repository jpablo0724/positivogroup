import { useState } from "react";
import {
  omitirDatosLocales,
  subirDatosLocales,
  type DatosLocales,
} from "../utils/migracion";

interface AvisoDatosLocalesProps {
  datos: DatosLocales;
  onListo: () => void;
  onError: (err: unknown) => void;
}

/**
 * Ofrece subir al servidor lo que quedó guardado en este navegador de cuando
 * el sistema no tenía backend. Aparece una sola vez por navegador.
 */
export default function AvisoDatosLocales({
  datos,
  onListo,
  onError,
}: AvisoDatosLocalesProps) {
  const [subiendo, setSubiendo] = useState(false);

  const partes = [
    datos.cotizaciones.length > 0 &&
      `${datos.cotizaciones.length} cotización(es)`,
    datos.productos.length > 0 && `${datos.productos.length} producto(s)`,
  ].filter(Boolean);

  async function subir() {
    setSubiendo(true);
    try {
      await subirDatosLocales(datos);
      onListo();
    } catch (err) {
      onError(err);
      setSubiendo(false);
    }
  }

  function omitir() {
    omitirDatosLocales();
    onListo();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-8 py-3 print:hidden">
      <p className="text-sm text-amber-800">
        Este navegador tiene {partes.join(" y ")} guardadas antes de conectar el
        servidor. ¿Las subes para que las vea todo el equipo?
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={omitir}
          disabled={subiendo}
          className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
        >
          Omitir
        </button>
        <button
          type="button"
          onClick={subir}
          disabled={subiendo}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
        >
          {subiendo ? "Subiendo…" : "Subir al servidor"}
        </button>
      </div>
    </div>
  );
}
