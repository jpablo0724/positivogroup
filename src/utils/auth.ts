import { pedir } from "./api";

export interface UsuarioPublico {
  email: string;
  nombre: string;
  admin: boolean;
  creadoEn?: string;
}

export const MINIMO_CONTRASENA = 8;

/** Quién está dentro, o null si no hay sesión abierta. */
export async function sesionActual(): Promise<UsuarioPublico | null> {
  try {
    const { usuario } = await pedir<{ usuario: UsuarioPublico }>(
      "/api/auth/sesion",
    );
    return usuario;
  } catch {
    // Sin sesión, o backend caído: en ambos casos toca iniciar sesión.
    return null;
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
