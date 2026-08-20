import { useEffect, useRef, useState } from "react";
import {
  buscarEmpresas,
  contactoDeEmpresa,
  ClientifyNoDisponible,
  type EmpresaClientify,
} from "../utils/clientify";
import { selectTriggerClass } from "./SearchableSelect";

interface ClienteSeleccionado {
  razonSocial: string;
  nit?: string;
  contacto?: string;
  email?: string;
}

interface BuscadorClienteProps {
  value: string;
  onChange: (razonSocial: string) => void;
  onSeleccionar: (cliente: ClienteSeleccionado) => void;
}

const MINIMO_CARACTERES = 3;

/**
 * Campo de razón social con búsqueda en Clientify. Se puede escribir
 * libremente; si hay coincidencias en el CRM se ofrecen como sugerencias y al
 * elegir una se completan también contacto y email.
 */
export default function BuscadorCliente({
  value,
  onChange,
  onSeleccionar,
}: BuscadorClienteProps) {
  const [sugerencias, setSugerencias] = useState<EmpresaClientify[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const contenedorRef = useRef<HTMLDivElement>(null);
  // Evita buscar de nuevo el texto que acabamos de rellenar al elegir.
  const recienSeleccionado = useRef(false);

  useEffect(() => {
    function fueraDelCampo(evento: MouseEvent) {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(evento.target as Node)
      ) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", fueraDelCampo);
    return () => document.removeEventListener("mousedown", fueraDelCampo);
  }, []);

  useEffect(() => {
    if (recienSeleccionado.current) {
      recienSeleccionado.current = false;
      return;
    }

    const consulta = value.trim();
    if (consulta.length < MINIMO_CARACTERES) {
      setSugerencias([]);
      setAviso(null);
      return;
    }

    let cancelado = false;
    // Espera a que el usuario deje de escribir antes de consultar el CRM.
    const temporizador = setTimeout(async () => {
      setBuscando(true);
      try {
        const encontradas = await buscarEmpresas(consulta);
        if (cancelado) return;
        setSugerencias(encontradas);
        setAviso(encontradas.length === 0 ? "Sin coincidencias en Clientify" : null);
        setAbierto(true);
      } catch (error) {
        if (cancelado) return;
        setSugerencias([]);
        setAviso(
          error instanceof ClientifyNoDisponible
            ? "Clientify no disponible; escribe los datos a mano"
            : "No se pudo consultar Clientify",
        );
        setAbierto(true);
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 400);

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [value]);

  async function elegir(empresa: EmpresaClientify) {
    recienSeleccionado.current = true;
    setAbierto(false);
    setSugerencias([]);

    // Razón social y NIT se aplican de inmediato; el contacto llega después.
    onSeleccionar({ razonSocial: empresa.razonSocial, nit: empresa.nit });

    try {
      // En la v2 el contacto guarda el nombre de la empresa, no su id.
      const contacto = await contactoDeEmpresa(empresa.nombre);
      if (contacto) {
        recienSeleccionado.current = true;
        onSeleccionar({
          razonSocial: empresa.razonSocial,
          nit: empresa.nit,
          contacto: contacto.nombre,
          email: contacto.email,
        });
      }
    } catch {
      // Sin contacto disponible se deja lo que ya se completó.
    }
  }

  return (
    <div ref={contenedorRef} className="relative">
      <input
        className={selectTriggerClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => sugerencias.length > 0 && setAbierto(true)}
        placeholder="Escribe para buscar en Clientify"
        autoComplete="off"
      />

      {buscando && (
        <span className="absolute right-3 top-2.5 text-xs text-slate-400">
          Buscando…
        </span>
      )}

      {abierto && (sugerencias.length > 0 || aviso) && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          {sugerencias.length > 0 ? (
            <ul className="max-h-56 overflow-auto py-1 text-sm">
              {sugerencias.map((empresa) => (
                <li key={empresa.id}>
                  <button
                    type="button"
                    onClick={() => elegir(empresa)}
                    className="block w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100"
                  >
                    <span className="block truncate">{empresa.razonSocial}</span>
                    {empresa.nombre !== empresa.razonSocial && (
                      <span className="block truncate text-xs text-slate-400">
                        {empresa.nombre}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-xs text-slate-400">{aviso}</p>
          )}
        </div>
      )}
    </div>
  );
}
