import { pedir } from "./api";
import type { UsuarioPublico } from "./auth";

/** Administración de cuentas. Solo responde si quien pide es administrador. */

export async function listarUsuarios(): Promise<UsuarioPublico[]> {
  const { usuarios } = await pedir<{ usuarios: UsuarioPublico[] }>(
    "/api/admin/usuarios",
  );
  return usuarios;
}

export async function restablecerContrasena(
  email: string,
  contrasena: string,
): Promise<void> {
  await pedir("/api/admin/restablecer", {
    metodo: "POST",
    cuerpo: { email, contrasena },
  });
}

export async function eliminarUsuario(email: string): Promise<void> {
  await pedir(`/api/admin/usuarios/${encodeURIComponent(email)}`, {
    metodo: "DELETE",
  });
}

export interface ResumenImportacion {
  escritos: number;
  omitidos: number;
  detalle: Record<string, { escritos: number; omitidos: number }>;
  ignorados: string[];
}

/**
 * Carga en la base de datos los almacenes de un respaldo descargado antes.
 *
 * No pisa lo que ya exista: al mudar de servidor eso es lo que se quiere, y
 * hace que repetir la carga sea inofensivo.
 */
export async function restaurarRespaldo(
  almacenes: Record<string, Record<string, unknown>>,
): Promise<ResumenImportacion> {
  return pedir<ResumenImportacion>("/api/admin/importar", {
    metodo: "POST",
    cuerpo: { almacenes },
  });
}

/** Contraseña temporal legible, para dictarla sin equivocarse. */
export function generarContrasena(): string {
  const alfabeto = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const azar = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(azar, (n) => alfabeto[n % alfabeto.length]).join("");
}
