import { useCallback, useEffect, useRef, useState } from "react";
import {
  buscarEmpresas,
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
  clientifyId?: number;
}

interface BuscadorClienteProps {
  value: string;
  onChange: (valor: string) => void;
  onSeleccionar: (cliente: ClienteSeleccionado) => void;
  /**
   * Empleados de la empresa elegida cuando hay más de uno, para que el
   * formulario los ofrezca en el campo Contacto. Llega vacío cuando la
   * empresa tiene uno solo (ya se autocompletó) o ninguno.
   */
  onContactosDisponibles: (contactos: ContactoClientify[]) => void;
  /**
   * Qué campo es: la razón social busca por nombre, razón social o NIT; el
   * NIT busca solo por NIT (comparando dígitos).
   */
  campo?: "razonSocial" | "nit";
  placeholder?: string;
}

/**
 * Campo de razón social (o de NIT) con búsqueda en Clientify. Se puede
 * escribir libremente; si hay coincidencias en el CRM se ofrecen como
 * sugerencias y al elegir una se completan también los demás datos del
 * cliente.
 */
export default function BuscadorCliente({
  value,
  onChange,
  onSeleccionar,
  onContactosDisponibles,
  campo = "razonSocial",
  placeholder = "Escribe para buscar en Clientify",
}: BuscadorClienteProps) {
  const porNit = campo === "nit";
  const minimoCaracteres = porNit ? 3 : 2;

  const [sugerencias, setSugerencias] = useState<EmpresaClientify[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const contenedorRef = useRef<HTMLDivElement>(null);
  // Último texto que el usuario escribió en ESTE campo. Solo se busca cuando
  // el valor coincide con él: si el valor cambió desde fuera (al elegir una
  // empresa aquí o en el otro buscador, o al abrir una cotización guardada)
  // no se debe desplegar una búsqueda que nadie pidió.
  const tecleado = useRef<string | null>(null);

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

  // Lo que realmente se busca: en el NIT solo los dígitos.
  const consultaDe = useCallback(
    (texto: string) => (porNit ? texto.replace(/\D/g, "") : texto.trim()),
    [porNit],
  );

  useEffect(() => {
    if (tecleado.current !== value) return;

    const consulta = consultaDe(value);
    if (consulta.length < minimoCaracteres) return;

    let cancelado = false;
    // Espera a que el usuario deje de escribir antes de consultar el CRM.
    const temporizador = setTimeout(async () => {
      setBuscando(true);
      try {
        const encontradas = await buscarEmpresas(
          consulta,
          porNit ? "nit" : "texto",
        );
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
    }, 250);

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
      setBuscando(false);
    };
  }, [value, porNit, minimoCaracteres, consultaDe]);

  function elegir(empresa: EmpresaClientify) {
    tecleado.current = null;
    setAbierto(false);
    setSugerencias([]);

    // Los empleados vienen dentro de la empresa, así que no hay que esperar
    // otra consulta: con un solo contacto se completa directo y con varios se
    // muestran para elegir.
    const contactos = empresa.contactos;
    const unico = contactos.length === 1 ? contactos[0] : null;

    onSeleccionar({
      razonSocial: empresa.razonSocial,
      nit: empresa.nit,
      clientifyId: empresa.id,
      ...(unico ? { contacto: unico.nombre, email: unico.email } : {}),
    });

    // La lista de dónde elegir se muestra junto al campo Contacto, así que la
    // maneja el formulario.
    onContactosDisponibles(contactos.length > 1 ? contactos : []);
  }

  return (
    <div ref={contenedorRef} className="relative">
      <input
        className={selectTriggerClass}
        value={value}
        onChange={(e) => {
          tecleado.current = e.target.value;
          // Muy corto para buscar: se quitan las sugerencias de lo anterior.
          if (consultaDe(e.target.value).length < minimoCaracteres) {
            setSugerencias([]);
            setAviso(null);
            setAbierto(false);
          }
          onChange(e.target.value);
        }}
        onFocus={() => sugerencias.length > 0 && setAbierto(true)}
        placeholder={placeholder}
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
                    {porNit ? (
                      <>
                        <span className="block truncate">{empresa.nit}</span>
                        <span className="block truncate text-xs text-slate-400">
                          {empresa.razonSocial}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="block truncate">{empresa.razonSocial}</span>
                        {empresa.nombre !== empresa.razonSocial && (
                          <span className="block truncate text-xs text-slate-400">
                            {empresa.nombre}
                          </span>
                        )}
                      </>
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
