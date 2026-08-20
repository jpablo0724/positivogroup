import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Control de acceso del backend.
 *
 * Las cotizaciones guardan datos de clientes (razón social, NIT, correos),
 * y la API vive en una URL pública, así que no puede quedar abierta. Se
 * protege con un código compartido que se define en Netlify
 * (Site configuration → Environment variables → APP_ACCESS_CODE) y que el
 * equipo escribe una vez al entrar al sistema.
 *
 * Sin la variable definida la API no responde: es preferible a quedar
 * publicada sin protección.
 */

export const CABECERA_CODIGO = "x-codigo-acceso";

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** Compara sin filtrar por tiempo cuántos caracteres coinciden. */
function igualSeguro(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * Devuelve una respuesta de error si la petición no trae el código correcto,
 * o null si puede continuar.
 */
export function revisarAcceso(req: Request): Response | null {
  const esperado = process.env.APP_ACCESS_CODE;

  if (!esperado) {
    return json(
      {
        error: "falta_codigo_configurado",
        mensaje:
          "El backend no tiene definida la variable APP_ACCESS_CODE en " +
          "Netlify. Créala en Site configuration → Environment variables y " +
          "vuelve a desplegar.",
      },
      503,
    );
  }

  const recibido = req.headers.get(CABECERA_CODIGO) ?? "";

  if (recibido === "" || !igualSeguro(recibido, esperado)) {
    return json({ error: "codigo_invalido" }, 401);
  }

  return null;
}
