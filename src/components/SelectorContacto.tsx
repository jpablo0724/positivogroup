import type { ContactoClientify } from "../utils/clientify";

interface SelectorContactoProps {
  contactos: ContactoClientify[];
  onElegir: (contacto: ContactoClientify) => void;
  onOmitir: () => void;
}

/**
 * Lista los empleados de la empresa elegida para que se seleccione cuál va
 * como contacto de la cotización. Aparece bajo el campo Contacto y solo
 * cuando la empresa tiene más de un empleado registrado.
 */
export default function SelectorContacto({
  contactos,
  onElegir,
  onOmitir,
}: SelectorContactoProps) {
  if (contactos.length === 0) return null;

  return (
    <div className="absolute z-20 mt-1 w-full rounded-md border border-emerald-300 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5">
        <span className="text-xs font-medium text-slate-600">
          Elige el contacto ({contactos.length})
        </span>
        <button
          type="button"
          onClick={onOmitir}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Omitir
        </button>
      </div>
      <ul className="max-h-56 overflow-auto py-1 text-sm">
        {contactos.map((contacto, i) => (
          <li key={`${contacto.nombre}-${contacto.email}-${i}`}>
            <button
              type="button"
              onClick={() => onElegir(contacto)}
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
  );
}
