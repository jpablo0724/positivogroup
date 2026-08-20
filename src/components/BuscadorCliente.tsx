import { useEffect, useRef, useState } from "react";
import {
  buscarEmpresas,
  contactosDeEmpresa,
  ClientifyNoDisponible,
  type ContactoClientify,
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
  // Cuando la empresa elegida tiene varios contactos, se listan para que el
  // usuario decida cuál va en la cotización.
  const [contactosParaElegir, setContactosParaElegir] = useState<
    ContactoClientify[]
  >([]);

  const contenedorRef = useRef<HTMLDivElement>(null);
  // Último valor puesto por el propio componente al elegir una empresa. Sirve
  // para no volver a buscar ese texto; se compara el valor en vez de usar una
  // bandera, porque una bandera se comería la búsqueda siguiente que escriba
  // el usuario.
  const valorAutocompletado = useRef<string | null>(null);

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
    if (valorAutocompletado.current === value) return;

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
    valorAutocompletado.current = empresa.razonSocial;
    setAbierto(false);
    setSugerencias([]);
    setContactosParaElegir([]);

    // Razón social y NIT se completan siempre al elegir la empresa.
    onSeleccionar({ razonSocial: empresa.razonSocial, nit: empresa.nit });

    try {
      const contactos = await contactosDeEmpresa(empresa.id, empresa.nombre);

      if (contactos.length === 1) {
        // Con un solo contacto no hay nada que decidir: se completa directo.
        onSeleccionar({
          razonSocial: empresa.razonSocial,
          nit: empresa.nit,
          contacto: contactos[0].nombre,
          email: contactos[0].email,
        });
      } else if (contactos.length > 1) {
        setContactosParaElegir(contactos);
      }
    } catch {
      // Sin contactos disponibles se deja lo que ya se completó.
    }
  }

  function elegirContacto(contacto: ContactoClientify) {
    valorAutocompletado.current = value;
    setContactosParaElegir([]);
    onSeleccionar({
      razonSocial: value,
      contacto: contacto.nombre,
      email: contacto.email,
    });
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

      {contactosParaElegir.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-emerald-300 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5">
            <span className="text-xs font-medium text-slate-600">
              Elige el contacto ({contactosParaElegir.length})
            </span>
            <button
              type="button"
              onClick={() => setContactosParaElegir([])}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Omitir
            </button>
          </div>
          <ul className="max-h-56 overflow-auto py-1 text-sm">
            {contactosParaElegir.map((contacto, i) => (
              <li key={`${contacto.nombre}-${contacto.email}-${i}`}>
                <button
                  type="button"
                  onClick={() => elegirContacto(contacto)}
                  className="block w-full px-3 py-1.5 text-left hover:bg-emerald-50"
                >
                  <span className="block truncate text-slate-700">
                    {contacto.nombre || "(sin nombre)"}
                  </span>
                  {contacto.email && (
                    <span className="block truncate text-xs text-slate-400">
                      {contacto.email}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
