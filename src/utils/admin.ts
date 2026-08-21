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

/** Contraseña temporal legible, para dictarla sin equivocarse. */
export function generarContrasena(): string {
  const alfabeto = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const azar = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(azar, (n) => alfabeto[n % alfabeto.length]).join("");
}
