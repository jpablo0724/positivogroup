import nodemailer from "nodemailer";

/**
 * Envío de correo por SMTP.
 *
 * Variables de entorno que necesita:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS   credenciales del servidor SMTP
 *   SMTP_FROM                                     (opcional) remitente, por defecto SMTP_USER
 *   SMTP_SECURE                                   (opcional) "true" para conexión TLS directa (puerto 465)
 *
 * Sin SMTP_HOST configurado no se puede enviar correo: se avisa con un error
 * claro en vez de fallar en silencio, para que quede claro en producción que
 * falta configurar el servidor de correo.
 */

let transportador: ReturnType<typeof nodemailer.createTransport> | null = null;

function obtenerTransportador() {
  if (transportador) return transportador;

  const host = process.env.SMTP_HOST;
  if (!host) return null;

  // Las contraseñas de aplicación de Google se muestran en grupos de cuatro
  // letras separados por espacios. Copiadas tal cual al panel del hosting,
  // Gmail las rechaza: se limpian aquí para que eso no vuelva a pasar.
  const usuario = process.env.SMTP_USER?.trim();
  const clave = process.env.SMTP_PASS?.replace(/\s/g, "");

  transportador = nodemailer.createTransport({
    host: host.trim(),
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE?.trim() === "true",
    auth: usuario ? { user: usuario, pass: clave } : undefined,
  });

  return transportador;
}

export function correoConfigurado(): boolean {
  return transportador !== null || Boolean(process.env.SMTP_HOST);
}

/**
 * Solo para las pruebas: cambia el servidor SMTP por un transporte que no
 * envía nada, para poder leer el correo que se habría mandado.
 */
export function usarTransportadorDePrueba(
  prueba: ReturnType<typeof nodemailer.createTransport>,
): void {
  transportador = prueba;
}

export async function enviarCorreo(opciones: {
  para: string;
  asunto: string;
  html: string;
  /** Versión en texto plano, para clientes que no muestran HTML. */
  texto?: string;
}): Promise<void> {
  const transporte = obtenerTransportador();
  if (!transporte) {
    throw new Error(
      "El backend no tiene definida la variable SMTP_HOST en el servidor, " +
        "que es el servidor de correo con el que se envían los enlaces de acceso.",
    );
  }

  await transporte.sendMail({
    from: (process.env.SMTP_FROM || process.env.SMTP_USER)?.trim(),
    to: opciones.para,
    subject: opciones.asunto,
    html: opciones.html,
    text: opciones.texto,
  });
}
