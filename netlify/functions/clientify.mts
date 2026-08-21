import { revisarSesion } from "../lib/acceso.mts";

/**
 * Proxy hacia la API de Clientify (v2).
 *
 * El token de Clientify da acceso a todo el CRM, así que nunca puede viajar
 * al navegador: vive solo aquí, como variable de entorno del sitio en Netlify
 * (Site configuration → Environment variables → CLIENTIFY_API_TOKEN).
 *
 * Exige sesión abierta: sin eso, cualquiera con la dirección podría leerse el
 * CRM completo a través de este proxy.
 *
 * Rutas:
 *   /api/clientify/me                      -> valida el token y devuelve la cuenta
 *   /api/clientify/companies?buscar=texto  -> empresas cuyo nombre/NIT coincide
 *   /api/clientify/contacts?empresa=nombre -> contactos de esa empresa
 *   /api/clientify/nota  (POST)            -> anota una cotización en la empresa
 *
 * Sin "buscar"/"empresa" la consulta se reenvía tal cual a Clientify, lo que
 * sirve para inspeccionar la API desde el navegador.
 *
 * Nota: la v2 ignora los filtros por parámetro (?name=, ?company=) y devuelve
 * el listado completo, así que el filtrado se hace aquí sobre el catálogo
 * descargado, que se guarda en memoria unos minutos para no rebajar el CRM en
 * cada tecla que se escribe.
 */

const CLIENTIFY_BASE = (
  process.env.CLIENTIFY_API_BASE ?? "https://api-plus.clientify.com/v2"
).replace(/\/+$/, "");

// Lectura, más la anotación de cotizaciones. Nada más: el proxy no puede
// usarse para modificar ni borrar lo que ya hay en el CRM.
const RECURSOS_PERMITIDOS = new Set(["me", "companies", "contacts", "nota"]);

/**
 * Formas posibles del endpoint de notas en Clientify. No pude confirmarlas
 * contra la API real, así que se prueban en orden y se usa la primera que
 * responda bien; la respuesta dice cuál funcionó. Se detiene en el primer
 * acierto para no crear la nota dos veces.
 */
function candidatosDeNota(empresaId: string) {
  return [
    {
      url: `${CLIENTIFY_BASE}/companies/${empresaId}/note/`,
      cuerpo: (titulo: string, texto: string) => ({ name: titulo, comment: texto }),
    },
    {
      url: `${CLIENTIFY_BASE}/companies/${empresaId}/notes/`,
      cuerpo: (titulo: string, texto: string) => ({ name: titulo, comment: texto }),
    },
    {
      url: `${CLIENTIFY_BASE}/notes/`,
      cuerpo: (titulo: string, texto: string) => ({
        name: titulo,
        comment: texto,
        company: Number(empresaId),
      }),
    },
  ];
}

// La v2 obliga a declarar qué campos se quieren.
const CAMPOS_POR_DEFECTO: Record<string, string> = {
  // "employees" llega con los contactos completos (id, nombre, email), así que
  // la búsqueda de empresas ya trae todo lo necesario para la cotización y no
  // hace falta una segunda consulta.
  companies:
    "id,name,business_name,taxpayer_identification_number,employees",
  contacts: "id,full_name,first_name,last_name,emails,phones,company,company_name",
};

const TAMANO_PAGINA = 500;
const MAXIMO_PAGINAS = 30;
// El catálogo de empresas cambia poco durante una jornada de trabajo, así que
// se conserva un buen rato: cada descarga completa son varias páginas.
const VIGENCIA_CACHE_MS = 20 * 60 * 1000;

type Registro = Record<string, unknown>;

const cache = new Map<string, { guardadoEn: number; registros: Registro[] }>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** Quita acentos y mayúsculas para que "Bancoldex" encuentre "Bancóldex". */
function normalizar(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

interface OpcionesClientify {
  metodo?: "GET" | "POST";
  cuerpo?: unknown;
}

async function pedirAClientify(
  url: URL,
  token: string,
  { metodo = "GET", cuerpo }: OpcionesClientify = {},
): Promise<Response> {
  const opciones = (esquema: string): RequestInit => ({
    method: metodo,
    headers: {
      Authorization: `${esquema} ${token}`,
      Accept: "application/json",
      ...(cuerpo === undefined ? {} : { "content-type": "application/json" }),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

  // La v1 autentica con "Token <clave>"; si la v2 esperara "Bearer", el primer
  // intento devuelve 401 y se reintenta con el otro esquema.
  let respuesta = await fetch(url, opciones("Token"));

  if (respuesta.status === 401 || respuesta.status === 403) {
    respuesta = await fetch(url, opciones("Bearer"));
  }

  return respuesta;
}

/** Descarga el listado completo de un recurso, paginando y cacheando. */
async function catalogoCompleto(
  recurso: string,
  token: string,
): Promise<Registro[]> {
  const enCache = cache.get(recurso);
  if (enCache && Date.now() - enCache.guardadoEn < VIGENCIA_CACHE_MS) {
    return enCache.registros;
  }

  const registros: Registro[] = [];

  for (let pagina = 1; pagina <= MAXIMO_PAGINAS; pagina++) {
    const url = new URL(`${CLIENTIFY_BASE}/${recurso}/`);
    url.searchParams.set("fields", CAMPOS_POR_DEFECTO[recurso] ?? "id,name");
    url.searchParams.set("page_size", String(TAMANO_PAGINA));
    url.searchParams.set("page", String(pagina));

    const respuesta = await pedirAClientify(url, token);
    if (!respuesta.ok) {
      throw new Error(
        `Clientify respondió ${respuesta.status} al pedir ${recurso}`,
      );
    }

    const cuerpo = (await respuesta.json()) as {
      results?: Registro[];
      next?: string | null;
    };

    const lote = Array.isArray(cuerpo.results) ? cuerpo.results : [];
    registros.push(...lote);

    if (!cuerpo.next || lote.length === 0) break;
  }

  cache.set(recurso, { guardadoEn: Date.now(), registros });
  return registros;
}

export default async (req: Request) => {
  const sinSesion = await revisarSesion(req);
  if (sinSesion) return sinSesion;

  const token = process.env.CLIENTIFY_API_TOKEN;

  if (!token) {
    const nombresVisibles = Object.keys(process.env)
      .filter((nombre) => /CLIENTIFY|CONTEXT|DEPLOY/i.test(nombre))
      .sort();

    return json(
      {
        error: "falta_token",
        mensaje:
          "La función no puede leer CLIENTIFY_API_TOKEN. Si la variable ya " +
          "está creada en Netlify, hay que desplegar de nuevo para que entre.",
        diagnostico: {
          variableDefinida: "CLIENTIFY_API_TOKEN" in process.env,
          contexto: process.env.CONTEXT ?? "(desconocido)",
          variablesVisibles: nombresVisibles,
        },
      },
      503,
    );
  }

  const entrante = new URL(req.url);
  const segmentos = entrante.pathname.split("/").filter(Boolean);
  const recurso = segmentos[segmentos.length - 1] ?? "";

  if (!RECURSOS_PERMITIDOS.has(recurso)) {
    return json(
      {
        error: "recurso_no_permitido",
        recurso,
        permitidos: [...RECURSOS_PERMITIDOS],
        ejemplo: "/api/clientify/companies?buscar=banco",
      },
      400,
    );
  }

  // --- Anotar una cotización en la ficha de la empresa ---
  if (recurso === "nota") {
    if (req.method !== "POST") {
      return json({ error: "metodo_no_permitido", metodo: req.method }, 405);
    }

    const cuerpo = (await req.json().catch(() => ({}))) as {
      empresaId?: unknown;
      titulo?: unknown;
      texto?: unknown;
    };

    const empresaId = String(cuerpo.empresaId ?? "").trim();
    const titulo = String(cuerpo.titulo ?? "").trim();
    const texto = String(cuerpo.texto ?? "").trim();

    if (!/^\d+$/.test(empresaId)) return json({ error: "empresa_invalida" }, 400);
    if (titulo === "" || texto === "") return json({ error: "nota_vacia" }, 400);

    const intentos: {
      url: string;
      status: number;
      respuesta: string;
    }[] = [];

    for (const candidato of candidatosDeNota(empresaId)) {
      const destino = new URL(candidato.url);
      let respuesta: Response;
      try {
        respuesta = await pedirAClientify(destino, token, {
          metodo: "POST",
          cuerpo: candidato.cuerpo(titulo, texto),
        });
      } catch (err) {
        intentos.push({
          url: candidato.url,
          status: 0,
          respuesta: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      const cuerpoTexto = await respuesta.text();

      if (respuesta.ok) {
        return json({
          enviada: true,
          endpoint: candidato.url,
          respuesta: cuerpoTexto.slice(0, 500),
        });
      }

      intentos.push({
        url: candidato.url,
        status: respuesta.status,
        respuesta: cuerpoTexto.slice(0, 400),
      });
    }

    // Ninguna forma funcionó: se devuelve todo lo que dijo Clientify, que es
    // lo que hace falta para corregir el endpoint.
    return json(
      {
        error: "no_se_pudo_crear_la_nota",
        mensaje:
          "Clientify rechazó las tres formas conocidas de crear una nota. " +
          "El detalle de abajo dice cuál es la correcta.",
        intentos,
      },
      502,
    );
  }

  const buscar = entrante.searchParams.get("buscar");
  const empresaId = entrante.searchParams.get("empresaId");

  try {
    // --- Búsqueda de empresas por nombre, razón social o NIT ---
    if (recurso === "companies" && buscar !== null) {
      const consulta = normalizar(buscar);
      if (consulta.length < 2) return json({ count: 0, results: [] });

      const todas = await catalogoCompleto("companies", token);
      const coincidencias = todas
        .filter(
          (registro) =>
            normalizar(registro.name).includes(consulta) ||
            normalizar(registro.business_name).includes(consulta) ||
            normalizar(registro.taxpayer_identification_number).includes(
              consulta,
            ),
        )
        .slice(0, 20);

      return json({ count: coincidencias.length, results: coincidencias });
    }

    // --- Empleados de una empresa, tomados del catálogo ya cacheado ---
    if (recurso === "contacts" && empresaId !== null) {
      const empresas = await catalogoCompleto("companies", token);
      const laEmpresa = empresas.find(
        (registro) => String(registro.id) === empresaId,
      );
      const empleados = Array.isArray(laEmpresa?.employees)
        ? laEmpresa.employees
        : [];

      return json({ count: empleados.length, results: empleados });
    }

    // --- Paso directo, útil para inspeccionar la API desde el navegador ---
    const destino = new URL(`${CLIENTIFY_BASE}/${recurso}/`);
    entrante.searchParams.forEach((valor, clave) => {
      destino.searchParams.append(clave, valor);
    });

    const campos = CAMPOS_POR_DEFECTO[recurso];
    if (campos && !destino.searchParams.has("fields")) {
      destino.searchParams.set("fields", campos);
    }

    const respuesta = await pedirAClientify(destino, token);
    const texto = await respuesta.text();

    if (!respuesta.ok) {
      return json(
        {
          error: "clientify_respondio_error",
          status: respuesta.status,
          url: destino.toString(),
          respuesta: texto.slice(0, 1000),
        },
        respuesta.status,
      );
    }

    try {
      return json(JSON.parse(texto));
    } catch {
      return json(
        { error: "respuesta_no_es_json", respuesta: texto.slice(0, 1000) },
        502,
      );
    }
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
