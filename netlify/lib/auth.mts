import { getStore } from "./store.mts";
import {
  createHash,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

/**
 * Cuentas de usuario y sesiones.
 *
 * Reglas que sostienen esto:
 *
 * - La contraseña NUNCA se guarda. Se guarda su derivación con scrypt y una
 *   sal distinta por usuario, así que ni con la base de datos en la mano se
 *   pueden leer las contraseñas.
 * - El testigo de sesión tampoco se guarda tal cual: se guarda su SHA-256. Si
 *   alguien leyera la base de datos, no podría suplantar una sesión activa.
 * - El testigo viaja en una cookie HttpOnly, que el JavaScript de la página no
 *   puede leer; así un script inyectado no puede robarla.
 */

const scrypt = promisify(scryptCb) as (
  contrasena: string,
  sal: Buffer,
  bytes: number,
) => Promise<Buffer>;

const BYTES_CLAVE = 64;
const VIGENCIA_SESION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
export const NOMBRE_COOKIE = "pg_sesion";
export const MINIMO_CONTRASENA = 8;

export type Rol = "admin" | "basico";

/**
 * Qué secciones puede ver una cuenta básica.
 *
 * Crear cotizaciones lo puede todo el mundo: es el trabajo de cualquiera que
 * entre al sistema, así que no lleva permiso. Lo demás sí.
 */
export interface Permisos {
  /** Ver el listado de cotizaciones (solo las suyas). */
  cotizaciones: boolean;
  /** Ver y editar el catálogo de productos. */
  catalogo: boolean;
  /** Ver la sección de usuarios. */
  usuarios: boolean;
}

export const PERMISOS_BASICO: Permisos = {
  cotizaciones: true,
  catalogo: false,
  usuarios: false,
};

const PERMISOS_TODOS: Permisos = {
  cotizaciones: true,
  catalogo: true,
  usuarios: true,
};

export interface Usuario {
  email: string;
  nombre: string;
  apellidos?: string;
  rol?: Rol;
  /** Ajustes por cuenta sobre los permisos por defecto de su rol. */
  permisos?: Partial<Permisos>;
  /** Marca de administrador anterior a los roles. Se sigue respetando. */
  admin?: boolean;
  /** Derivación scrypt de la contraseña, en hexadecimal. */
  clave: string;
  /** Sal usada para derivarla, en hexadecimal. */
  sal: string;
  creadoEn: string;
}

/** Lo que se le puede contar al navegador sobre el usuario. */
export interface UsuarioPublico {
  email: string;
  nombre: string;
  apellidos: string;
  rol: Rol;
  permisos: Permisos;
  /** Se mantiene por comodidad: equivale a rol === "admin". */
  admin: boolean;
  creadoEn?: string;
}

interface Sesion {
  email: string;
  creadaEn: string;
  expiraEn: string;
}

function almacenUsuarios() {
  return getStore({ name: "usuarios", consistency: "strong" });
}

function almacenSesiones() {
  return getStore({ name: "sesiones", consistency: "strong" });
}

/** Los correos no distinguen mayúsculas: se normalizan antes de usarlos. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

function claveUsuario(email: string): string {
  return Buffer.from(normalizarEmail(email), "utf8").toString("base64url");
}

function huella(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

// --- Contraseñas ---

export async function derivarContrasena(
  contrasena: string,
  salHex?: string,
): Promise<{ clave: string; sal: string }> {
  const sal = salHex ? Buffer.from(salHex, "hex") : randomBytes(16);
  const clave = await scrypt(contrasena, sal, BYTES_CLAVE);
  return { clave: clave.toString("hex"), sal: sal.toString("hex") };
}

export async function contrasenaCoincide(
  contrasena: string,
  usuario: Usuario,
): Promise<boolean> {
  const { clave } = await derivarContrasena(contrasena, usuario.sal);
  const a = Buffer.from(clave, "hex");
  const b = Buffer.from(usuario.clave, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// --- Usuarios ---

export async function buscarUsuario(email: string): Promise<Usuario | null> {
  return (await almacenUsuarios().get(claveUsuario(email), {
    type: "json",
  })) as Usuario | null;
}

/**
 * Crea el usuario solo si el correo está libre. Devuelve null si ya existe:
 * `onlyIfNew` lo resuelve del lado del servidor, así que dos registros
 * simultáneos con el mismo correo no se pisan.
 */
export async function crearUsuario(usuario: Usuario): Promise<Usuario | null> {
  const { modified } = await almacenUsuarios().setJSON(
    claveUsuario(usuario.email),
    usuario,
    { onlyIfNew: true },
  );
  return modified ? usuario : null;
}

export function comoPublico(usuario: Usuario): UsuarioPublico {
  return {
    email: usuario.email,
    nombre: usuario.nombre,
    apellidos: usuario.apellidos ?? "",
    rol: rolDe(usuario),
    permisos: permisosDe(usuario),
    admin: esAdmin(usuario),
    creadoEn: usuario.creadoEn,
  };
}

/**
 * El rol de una cuenta.
 *
 * Las cuentas creadas antes de que existieran los roles no traen el campo: en
 * ellas manda la marca `admin`, que es lo que se usaba entonces. Así nadie
 * pierde ni gana permisos al desplegar esta versión.
 */
export function rolDe(usuario: Usuario): Rol {
  if (usuario.rol === "admin" || usuario.rol === "basico") return usuario.rol;
  return usuario.admin === true || estaDeclaradoAdmin(usuario.email)
    ? "admin"
    : "basico";
}

/**
 * Es administrador quien lo tenga en su rol, o quien esté en la variable de
 * entorno ADMIN_EMAILS (separada por comas).
 *
 * Las dos vías suman, no se excluyen: si por error nadie quedara como
 * administrador, basta con agregar el correo correcto a la variable, sin tocar
 * los datos.
 */
export function esAdmin(usuario: Usuario): boolean {
  return rolDe(usuario) === "admin" || estaDeclaradoAdmin(usuario.email);
}

function estaDeclaradoAdmin(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((correo) => normalizarEmail(correo))
    .filter(Boolean)
    .includes(normalizarEmail(email));
}

/**
 * Los permisos efectivos de una cuenta. Un administrador lo puede todo; a una
 * cuenta básica se le aplican sus ajustes sobre los permisos por defecto.
 */
export function permisosDe(usuario: Usuario): Permisos {
  if (esAdmin(usuario)) return { ...PERMISOS_TODOS };
  return { ...PERMISOS_BASICO, ...(usuario.permisos ?? {}) };
}

export function puede(usuario: Usuario, seccion: keyof Permisos): boolean {
  return permisosDe(usuario)[seccion];
}

const CLAVE_PRIMER_USUARIO = "primer_usuario_registrado";

/**
 * Reclama el puesto de primera cuenta. `onlyIfNew` hace que solo una lo
 * consiga, aunque dos personas se registren en el mismo instante.
 */
export async function reclamarPrimerUsuario(email: string): Promise<boolean> {
  const { modified } = await getStore({
    name: "contadores",
    consistency: "strong",
  }).setJSON(
    CLAVE_PRIMER_USUARIO,
    { email: normalizarEmail(email), fecha: new Date().toISOString() },
    { onlyIfNew: true },
  );
  return modified;
}

/**
 * Deja administrador a la cuenta más antigua si el sistema no tiene ninguno.
 *
 * La marca de administrador se asigna al registrarse, pero las cuentas creadas
 * antes de que esa función existiera quedaron sin ella y no había forma de
 * obtenerla. Esto lo repara solo: si nadie es administrador, lo es quien
 * abrió la primera cuenta.
 *
 * Corre una sola vez: después de reparar queda la misma marca que pone el
 * registro, así que las siguientes llamadas salen con una sola lectura.
 */
export async function asegurarPrimerAdmin(): Promise<void> {
  const estado = getStore({ name: "contadores", consistency: "strong" });

  const marca = await estado.get(CLAVE_PRIMER_USUARIO, { type: "json" });
  if (marca) return;

  const cuentas = await listarUsuarios();
  // Sin cuentas todavía no hay nada que reparar: el primer registro se
  // encarga.
  if (cuentas.length === 0) return;

  const masAntigua = cuentas[0];
  if (!cuentas.some((cuenta) => rolDe(cuenta) === "admin")) {
    await guardarUsuario({ ...masAntigua, rol: "admin", admin: true });
  }

  await estado.setJSON(CLAVE_PRIMER_USUARIO, {
    email: masAntigua.email,
    fecha: new Date().toISOString(),
    reparado: true,
  });
}

/** Todas las cuentas, para la pantalla de administración. */
export async function listarUsuarios(): Promise<Usuario[]> {
  const almacen = almacenUsuarios();
  const { blobs } = await almacen.list();
  const cuentas = await Promise.all(
    blobs.map((blob) => almacen.get(blob.key, { type: "json" })),
  );
  return (cuentas.filter(Boolean) as Usuario[]).sort((a, b) =>
    (a.creadoEn ?? "").localeCompare(b.creadoEn ?? ""),
  );
}

/** Reemplaza la contraseña de una cuenta que ya existe. */
export async function guardarUsuario(usuario: Usuario): Promise<void> {
  await almacenUsuarios().setJSON(claveUsuario(usuario.email), usuario);
}

export async function eliminarUsuario(email: string): Promise<void> {
  await almacenUsuarios().delete(claveUsuario(email));
}

/**
 * Cierra todas las sesiones abiertas de una cuenta. Es lo que le da sentido a
 * restablecer una contraseña: si las sesiones siguieran vivas, cambiarla no
 * sacaría a nadie.
 */
export async function cerrarSesionesDe(email: string): Promise<void> {
  const almacen = almacenSesiones();
  const correo = normalizarEmail(email);
  const { blobs } = await almacen.list();

  const suyas = await Promise.all(
    blobs.map(async (blob) => {
      const sesion = (await almacen.get(blob.key, {
        type: "json",
      })) as Sesion | null;
      return sesion?.email === correo ? blob.key : null;
    }),
  );

  await Promise.all(
    suyas.filter(Boolean).map((clave) => almacen.delete(clave as string)),
  );
}

// --- Sesiones ---

/** Crea una sesión y devuelve el testigo en claro, que solo se ve aquí. */
export async function abrirSesion(email: string): Promise<string> {
  const testigo = randomBytes(32).toString("base64url");
  const ahora = Date.now();

  const sesion: Sesion = {
    email: normalizarEmail(email),
    creadaEn: new Date(ahora).toISOString(),
    expiraEn: new Date(ahora + VIGENCIA_SESION_MS).toISOString(),
  };

  await almacenSesiones().setJSON(huella(testigo), sesion);
  return testigo;
}

export async function cerrarSesion(testigo: string): Promise<void> {
  await almacenSesiones().delete(huella(testigo));
}

/** Usuario dueño del testigo, o null si no vale o ya venció. */
export async function usuarioDeSesion(
  testigo: string,
): Promise<Usuario | null> {
  if (!testigo) return null;

  const almacen = almacenSesiones();
  const sesion = (await almacen.get(huella(testigo), {
    type: "json",
  })) as Sesion | null;

  if (!sesion) return null;

  if (Date.parse(sesion.expiraEn) < Date.now()) {
    await almacen.delete(huella(testigo));
    return null;
  }

  return buscarUsuario(sesion.email);
}

// --- Cookies ---

export function leerCookie(req: Request, nombre: string): string {
  const cabecera = req.headers.get("cookie") ?? "";
  for (const parte of cabecera.split(";")) {
    const [clave, ...resto] = parte.trim().split("=");
    if (clave === nombre) return decodeURIComponent(resto.join("="));
  }
  return "";
}

/**
 * SameSite=Strict porque la aplicación nunca se usa desde otro sitio; HttpOnly
 * para que el JavaScript de la página no pueda leer el testigo.
 */
export function cookieSesion(testigo: string): string {
  const segundos = Math.floor(VIGENCIA_SESION_MS / 1000);
  return `${NOMBRE_COOKIE}=${encodeURIComponent(testigo)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${segundos}`;
}

export function cookieBorrada(): string {
  return `${NOMBRE_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
