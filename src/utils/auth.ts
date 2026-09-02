import { pedir } from "./api";

export type Rol = "admin" | "basico";

/** Las secciones que se pueden habilitar por cuenta. Crear cotizaciones no
 *  lleva permiso: es el trabajo de cualquiera que entre al sistema. */
export interface Permisos {
  cotizaciones: boolean;
  catalogo: boolean;
  usuarios: boolean;
}

export interface UsuarioPublico {
  email: string;
  nombre: string;
  apellidos: string;
  rol: Rol;
  permisos: Permisos;
  admin: boolean;
  creadoEn?: string;
}

export const MINIMO_CONTRASENA = 8;

/** Nombre completo para mostrar, con los apellidos si los hay. */
export function nombreCompleto(usuario: {
  nombre: string;
  apellidos?: string;
}): string {
  return [usuario.nombre, usuario.apellidos].filter(Boolean).join(" ").trim();
}

export interface EstadoSesion {
  usuario: UsuarioPublico | null;
  /** El sistema no tiene ninguna cuenta todavía: hay que crear la primera. */
  sinCuentas: boolean;
}

/** Quién está dentro, y si el sistema está recién instalado. */
export async function sesionActual(): Promise<EstadoSesion> {
  try {
    const { usuario } = await pedir<{ usuario: UsuarioPublico }>(
      "/api/auth/sesion",
    );
    return { usuario, sinCuentas: false };
  } catch (err) {
    // Sin sesión, o backend caído: en ambos casos toca iniciar sesión. El
    // backend avisa en el mismo 401 si todavía no hay ninguna cuenta.
    const datos = (err as { datos?: { sinCuentas?: boolean } }).datos;
    return { usuario: null, sinCuentas: datos?.sinCuentas === true };
  }
}

export async function entrar(
  email: string,
  contrasena: string,
): Promise<UsuarioPublico> {
  const { usuario } = await pedir<{ usuario: UsuarioPublico }>(
    "/api/auth/entrar",
    { metodo: "POST", cuerpo: { email, contrasena } },
  );
  return usuario;
}

export async function registrarse(datos: {
  nombre: string;
  email: string;
  contrasena: string;
  codigo: string;
}): Promise<UsuarioPublico> {
  const { usuario } = await pedir<{ usuario: UsuarioPublico }>(
    "/api/auth/registro",
    { metodo: "POST", cuerpo: datos },
  );
  return usuario;
}

/** Cambia la contraseña propia. Cierra las sesiones abiertas en otros equipos. */
export async function cambiarContrasena(
  actual: string,
  nueva: string,
): Promise<void> {
  await pedir("/api/auth/contrasena", {
    metodo: "POST",
    cuerpo: { actual, nueva },
  });
}

export async function salir(): Promise<void> {
  await pedir("/api/auth/salir", { metodo: "POST" });
}
