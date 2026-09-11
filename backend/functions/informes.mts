import { json, quienPide } from "../lib/acceso.mts";
import { puede } from "../lib/auth.mts";
import { CLIENTIFY_BASE, pedirAClientify } from "../lib/clientifyApi.mts";

/**
 * Informe de contactos de Clientify: tipo de contacto, estado del contacto,
 * estado de gestión y campaña (etiqueta), para armar el filtro, la gráfica y
 * la tabla de la pestaña Informes.
 *
 *   GET /api/informes/contactos
 *
 * Exige el permiso "informes" (además de sesión), igual que catálogo o
 * usuarios exigen el suyo.
 *
 * "Estado de gestión" no es un campo propio de Clientify: es un campo
 * personalizado de esta cuenta (id 324845, visto al inspeccionar la API).
 * Sus opciones se copian aquí tal como están configuradas en Clientify; si en
 * el CRM se agrega o renombra una opción, hay que actualizar esta lista.
 */

const CAMPO_ESTADO_GESTION = 324845;

const ESTADOS_GESTION = [
  "OP - Contactado por Email",
  "C - Cliente",
  "OFF - No contesta",
  "OP - Contactado por WApp",
  "OP - Interes de Compra Mayor a 3 Meses",
  "G - Informacion Comercial Enviada",
  "G - Cotizacion Enviada",
  "G - Interes de Compra Menos a 3 Meses",
  "G - En Espera de documentos para Creacion de cliente",
  "G - Estudio de Credito",
  "NA - Administrador de PH",
  "NA - Descartado por Presupuesto",
  "NA - No tenemos lo que busca",
  "NA - Numero equivocado",
  "NA - No Info No Contesta",
  "OFF - Solo Busca Informacion",
];

/** "Lead status" de Clientify (Contact.STATUS_CHOICES), con su etiqueta en español. */
const ESTADOS_CONTACTO: { clave: string; etiqueta: string }[] = [
  { clave: "other", etiqueta: "Otro" },
  { clave: "not-qualified-lead", etiqueta: "Lead no calificado" },
  { clave: "visitor", etiqueta: "Visitante" },
  { clave: "cold-lead", etiqueta: "Lead frío" },
  { clave: "warm-lead", etiqueta: "Lead tibio" },
  { clave: "hot-lead", etiqueta: "Lead caliente" },
  { clave: "in-deal", etiqueta: "En negociación" },
  { clave: "lost-lead", etiqueta: "Lead perdido" },
  { clave: "client", etiqueta: "Cliente" },
  { clave: "lost-client", etiqueta: "Cliente perdido" },
];

/**
 * Las 5 campañas que se reportan, con la etiqueta real en Clientify a la
 * izquierda (sin "#": así están guardadas) y el nombre que se muestra a la
 * derecha. "Barranquilla" está mal escrita en Clientify ("abri" en vez de
 * "abril"); se deja tal cual para que el filtro encuentre los contactos de
 * verdad.
 */
const ETIQUETAS: { etiqueta: string; nombre: string }[] = [
  { etiqueta: "barranquilla-abri-2026", nombre: "Barranquilla-Abril-2026" },
  { etiqueta: "bogotá-abril-2026", nombre: "Bogotá-Abril-2026" },
  { etiqueta: "cali-abril-2026", nombre: "Cali-Abril-2026" },
  { etiqueta: "medellín-abril-2026", nombre: "Medellín-Abril-2026" },
  { etiqueta: "pereira-manizales-abril-2026", nombre: "Pereira-Manizales-Abril-2026" },
];

const CAMPOS = "id,full_name,contact_type,status,tags,custom_fields,company_name";
const TAMANO_PAGINA = 500;
const MAXIMO_PAGINAS = 30;
// Igual que en clientify.mts: el CRM no cambia tan rápido como para pedirlo
// en cada visita a la pestaña.
const VIGENCIA_CACHE_MS = 20 * 60 * 1000;

type Registro = Record<string, unknown>;

let cache: { guardadoEn: number; contactos: Registro[] } | null = null;

export interface ContactoInforme {
  id: number;
  nombre: string;
  empresa: string;
  tipoContacto: string;
  estado: string;
  estadoGestion: string;
  etiquetas: string[];
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

/** El valor guardado en el campo personalizado "Estado de gestión", o "". */
function estadoGestionDe(contacto: Registro): string {
  const campos = Array.isArray(contacto.custom_fields)
    ? (contacto.custom_fields as Registro[])
    : [];
  const campo = campos.find((c) => c.field_id === CAMPO_ESTADO_GESTION);
  return texto(campo?.value);
}

export function comoContactoInforme(contacto: Registro): ContactoInforme {
  return {
    id: Number(contacto.id),
    nombre: texto(contacto.full_name),
    empresa: texto(contacto.company_name),
    tipoContacto: texto(contacto.contact_type),
    estado: texto(contacto.status),
    estadoGestion: estadoGestionDe(contacto),
    etiquetas: Array.isArray(contacto.tags)
      ? (contacto.tags as unknown[]).map((t) => texto(t)).filter(Boolean)
      : [],
  };
}

async function contactosCompletos(token: string): Promise<Registro[]> {
  if (cache && Date.now() - cache.guardadoEn < VIGENCIA_CACHE_MS) {
    return cache.contactos;
  }

  const contactos: Registro[] = [];

  for (let pagina = 1; pagina <= MAXIMO_PAGINAS; pagina++) {
    const url = new URL(`${CLIENTIFY_BASE}/contacts/`);
    url.searchParams.set("fields", CAMPOS);
    url.searchParams.set("page_size", String(TAMANO_PAGINA));
    url.searchParams.set("page", String(pagina));

    const respuesta = await pedirAClientify(url, token);
    if (!respuesta.ok) {
      throw new Error(`Clientify respondió ${respuesta.status} al pedir contactos`);
    }

    const cuerpo = (await respuesta.json()) as {
      results?: Registro[];
      next?: string | null;
    };

    const lote = Array.isArray(cuerpo.results) ? cuerpo.results : [];
    contactos.push(...lote);

    if (!cuerpo.next || lote.length === 0) break;
  }

  cache = { guardadoEn: Date.now(), contactos };
  return contactos;
}

export default async (req: Request) => {
  if (req.method !== "GET") {
    return json({ error: "metodo_no_permitido", metodo: req.method }, 405);
  }

  const quien = await quienPide(req);
  if (!quien) return json({ error: "sin_sesion" }, 401);
  if (!puede(quien, "informes")) {
    return json({ error: "requiere_permiso", permiso: "informes" }, 403);
  }

  const url = new URL(req.url);
  const resto = decodeURIComponent(
    url.pathname.replace(/^.*?\/informes\/?/, ""),
  );

  if (resto !== "contactos") {
    return json({ error: "ruta_desconocida", resto }, 404);
  }

  const token = process.env.CLIENTIFY_API_TOKEN;
  if (!token) {
    return json(
      {
        error: "falta_token",
        mensaje:
          "La función no puede leer CLIENTIFY_API_TOKEN. Si la variable ya " +
          "está creada en el servidor, hay que reiniciarlo para que entre.",
      },
      503,
    );
  }

  try {
    const crudos = await contactosCompletos(token);
    const contactos = crudos.map(comoContactoInforme);

    // El tipo de contacto no tiene una lista fija en Clientify: se arma con
    // los valores que de verdad aparecen en los datos.
    const tiposContacto = [
      ...new Set(contactos.map((c) => c.tipoContacto).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "es"));

    return json({
      contactos,
      catalogos: {
        tiposContacto,
        estados: ESTADOS_CONTACTO,
        estadosGestion: ESTADOS_GESTION,
        etiquetas: ETIQUETAS,
      },
    });
  } catch (err) {
    return json(
      {
        error: "fallo_consultando_clientify",
        detalle: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
};
