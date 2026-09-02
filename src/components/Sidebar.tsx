import type { ReactNode } from "react";
import LogoEmpresa from "./LogoEmpresa";
import { nombreCompleto, type Permisos } from "../utils/auth";

export type View =
  | "crear-factura"
  | "listado-cotizaciones"
  | "catalogo-productos"
  | "admin-usuarios";

interface NavItem {
  id: View;
  label: string;
  icon: ReactNode;
  /** Permiso que hace falta para verla. Sin él, la sección es de todos. */
  permiso?: keyof Permisos;
}

const navItems: NavItem[] = [
  {
    id: "crear-factura",
    label: "Crear Cotización",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M9 2h6l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
        <path d="M14 2v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
        <path d="M9 9h1" />
      </svg>
    ),
  },
  {
    id: "listado-cotizaciones",
    label: "Listado de Cotizaciones",
    permiso: "cotizaciones",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </svg>
    ),
  },
  {
    id: "catalogo-productos",
    label: "Catálogo de Productos",
    permiso: "catalogo",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M20 7 12 3 4 7l8 4 8-4Z" />
        <path d="M4 7v10l8 4 8-4V7" />
        <path d="M12 11v10" />
      </svg>
    ),
  },
];

const itemUsuarios: NavItem = {
  id: "admin-usuarios",
  label: "Usuarios",
  permiso: "usuarios",
  icon: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
  usuario: {
    nombre: string;
    apellidos?: string;
    email: string;
    permisos: Permisos;
  };
  onSalir: () => void;
  onCambiarContrasena: () => void;
}

export default function Sidebar({
  activeView,
  onNavigate,
  usuario,
  onSalir,
  onCambiarContrasena,
}: SidebarProps) {
  // El menú muestra solo lo que la cuenta puede ver. Es comodidad, no
  // seguridad: quien escriba la dirección a mano se topa igualmente con el
  // backend, que es quien de verdad decide.
  const items = [...navItems, itemUsuarios].filter(
    (item) => !item.permiso || usuario.permisos[item.permiso],
  );
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-marca text-slate-200">
      <div className="border-b border-marca-linea px-5 py-5">
        <LogoEmpresa fondo="oscuro" />
        <p className="mt-1 text-xs text-slate-400">Sistema de cotizaciones</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          const isActive = item.id === activeView;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-marca-linea px-5 py-4">
        <p className="truncate text-sm font-medium text-slate-200">
          {nombreCompleto(usuario)}
        </p>
        <p className="truncate text-xs text-slate-500">{usuario.email}</p>
        <button
          type="button"
          onClick={onCambiarContrasena}
          className="mt-2 block text-xs font-medium text-slate-400 transition-colors hover:text-slate-100"
        >
          Cambiar contraseña
        </button>
        <button
          type="button"
          onClick={onSalir}
          className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-400 transition-colors hover:text-slate-100"
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
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="m16 17 5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
