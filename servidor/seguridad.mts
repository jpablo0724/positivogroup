/**
 * Cabeceras de seguridad que acompañan todas las respuestas del servidor.
 *
 * - HSTS: el navegador ya no intenta entrar por HTTP, ni siquiera la primera
 *   vez que se escribe la dirección a mano. Sin includeSubDomains, para no
 *   obligar a HTTPS a otros subdominios de positivogroup.com.
 * - frame-ancestors / X-Frame-Options: nadie puede incrustar la intranet en
 *   otra página para engañar al usuario con clics (clickjacking).
 * - nosniff: el navegador respeta el tipo de archivo declarado y no "adivina"
 *   que un archivo es una página web.
 * - CSP: la página solo carga código propio. Si alguien lograra colar un
 *   <script> en un texto, el navegador se negaría a ejecutarlo. Las fuentes
 *   de Google son la única excepción, porque las usa index.html.
 * - Referrer-Policy: al salir a otro sitio no se manda la dirección completa,
 *   que en los enlaces públicos lleva el testigo de la cotización.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

export const CABECERAS_SEGURIDAD: Record<string, string> = {
  "strict-transport-security": "max-age=31536000",
  "x-frame-options": "SAMEORIGIN",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy": CSP,
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

/**
 * Tope de tamaño del cuerpo de una petición. Sin tope, unas pocas peticiones
 * gigantes llenan la memoria y tumban el servidor. El general cubre de sobra
 * una cotización o un adjunto (3,3 MB); restaurar un respaldo completo lleva
 * uno mucho mayor, y esa ruta solo la puede usar un administrador.
 */
export const MAXIMO_CUERPO_BYTES = 10 * 1024 * 1024;
export const MAXIMO_CUERPO_RESPALDO_BYTES = 200 * 1024 * 1024;
