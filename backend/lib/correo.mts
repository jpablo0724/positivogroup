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

  transportador = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  return transportador;
}

export function correoConfigurado(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export async function enviarCorreo(opciones: {
  para: string;
  asunto: string;
  html: string;
}): Promise<void> {
  const transporte = obtenerTransportador();
  if (!transporte) {
    throw new Error(
      "El backend no tiene definida la variable SMTP_HOST en el servidor, " +
        "que es el servidor de correo con el que se envían los enlaces de acceso.",
    );
  }

  await transporte.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: opciones.para,
    subject: opciones.asunto,
    html: opciones.html,
  });
}
