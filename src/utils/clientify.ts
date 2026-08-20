/**
 * Cliente del proxy /api/clientify (función serverless en Netlify).
 *
 * El navegador nunca ve el token de Clientify: la función serverless lo
 * agrega del lado del servidor. Si el proxy no está disponible (por ejemplo
 * en local sin `netlify dev`, o si falta configurar el token), estas
 * funciones lanzan un error y la interfaz sigue permitiendo escribir los
 * datos del cliente a mano.
 */

export interface EmpresaClientify {
  id: number;
  /** Nombre comercial con el que aparece en el CRM. */
  nombre: string;
  /** Razón social formal, cuando el CRM la tiene registrada. */
  razonSocial: string;
  /** NIT registrado en el CRM (taxpayer_identification_number). */
  nit: string;
}

export interface ContactoClientify {
  nombre: string;
  email: string;
}

export class ClientifyNoDisponible extends Error {}

async function pedir(ruta: string): Promise<unknown> {
  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, { headers: { Accept: "application/json" } });
  } catch {
    throw new ClientifyNoDisponible("No se pudo contactar el servidor");
  }

  const texto = await respuesta.text();
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    // Sin la función serverless, la ruta cae en el index.html de la SPA.
    throw new ClientifyNoDisponible("La conexión con Clientify no está activa");
  }

  if (!respuesta.ok) {
    const detalle =
      typeof cuerpo === "object" && cuerpo !== null && "error" in cuerpo
        ? String((cuerpo as { error: unknown }).error)
        : `HTTP ${respuesta.status}`;
    throw new ClientifyNoDisponible(detalle);
  }

  return cuerpo;
}

function comoLista(cuerpo: unknown): Record<string, unknown>[] {
  if (Array.isArray(cuerpo)) return cuerpo as Record<string, unknown>[];
  if (typeof cuerpo === "object" && cuerpo !== null) {
    const resultados = (cuerpo as { results?: unknown }).results;
    if (Array.isArray(resultados)) return resultados as Record<string, unknown>[];
  }
  return [];
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

export async function buscarEmpresas(
  consulta: string,
): Promise<EmpresaClientify[]> {
  const cuerpo = await pedir(
    `/api/clientify/companies?buscar=${encodeURIComponent(consulta)}`,
  );

  return comoLista(cuerpo)
    .map((empresa) => ({
      id: Number(empresa.id),
      nombre: texto(empresa.name),
      razonSocial: texto(empresa.business_name) || texto(empresa.name),
      nit: texto(empresa.taxpayer_identification_number),
    }))
    .filter((empresa) => Number.isFinite(empresa.id) && empresa.nombre !== "");
}

/**
 * Contactos registrados para la empresa. Se devuelven todos para que, cuando
 * hay más de uno, la interfaz permita elegir cuál va en la cotización.
 */
export async function contactosDeEmpresa(
  nombreEmpresa: string,
): Promise<ContactoClientify[]> {
  const cuerpo = await pedir(
    `/api/clientify/contacts?empresa=${encodeURIComponent(nombreEmpresa)}`,
  );

  const contactos = comoLista(cuerpo).map((contacto) => {
    const emails = Array.isArray(contacto.emails) ? contacto.emails : [];
    const primerEmail = emails
      .map((entrada) =>
        typeof entrada === "object" && entrada !== null
          ? texto((entrada as { email?: unknown }).email)
          : texto(entrada),
      )
      .find(Boolean);

    return {
      nombre:
        texto(contacto.full_name) ||
        [texto(contacto.first_name), texto(contacto.last_name)]
          .filter(Boolean)
          .join(" "),
      email: primerEmail ?? "",
    };
  });

  // Se descartan los registros sin nombre ni email, que no aportan nada al
  // momento de elegir.
  return contactos.filter((c) => c.nombre !== "" || c.email !== "");
}
