/**
 * Proxy hacia la API de Clientify (v2).
 *
 * El token de Clientify da acceso a todo el CRM, así que nunca puede viajar
 * al navegador: vive solo aquí, como variable de entorno del sitio en Netlify
 * (Site configuration → Environment variables → CLIENTIFY_API_TOKEN).
 *
 * Rutas:
 *   /api/clientify/me                      -> valida el token y devuelve la cuenta
 *   /api/clientify/companies?buscar=texto  -> empresas cuyo nombre/NIT coincide
 *   /api/clientify/contacts?empresa=nombre -> contactos de esa empresa
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

// Solo recursos de lectura, para que el proxy no pueda usarse para modificar
// ni borrar nada en el CRM.
const RECURSOS_PERMITIDOS = new Set(["me", "companies", "contacts"]);

// La v2 obliga a declarar qué campos se quieren.
const CAMPOS_POR_DEFECTO: Record<string, string> = {
  // "employees" trae los contactos asociados a la empresa: es el vínculo
  // fiable, porque cruzar por nombre falla en cuanto difieren ("Redcol
  // Holding" vs "Redcol Holding S.A.S").
  companies:
    "id,name,business_name,taxpayer_identification_number,employees,employees_count",
  contacts: "id,full_name,first_name,last_name,emails,phones,company,company_name",
};

const TAMANO_PAGINA = 200;
const MAXIMO_PAGINAS = 30;
const VIGENCIA_CACHE_MS = 5 * 60 * 1000;

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

/**
 * Saca los ids de contacto del campo "employees" de una empresa. No está
 * documentado si viene como números, como URLs o como objetos, así que se
 * contemplan las tres formas.
 */
function idsDeEmpleados(employees: unknown): number[] {
  if (!Array.isArray(employees)) return [];

  return employees
    .map((entrada) => {
      if (typeof entrada === "number") return entrada;

      if (typeof entrada === "string") {
        // Formato URL: https://.../contacts/167216500/
        const encontrado = entrada.match(/(\d+)\/?$/);
        return encontrado ? Number(encontrado[1]) : NaN;
      }

      if (typeof entrada === "object" && entrada !== null) {
        const objeto = entrada as { id?: unknown; url?: unknown };
        if (typeof objeto.id === "number") return objeto.id;
        if (typeof objeto.url === "string") {
          const encontrado = objeto.url.match(/(\d+)\/?$/);
          return encontrado ? Number(encontrado[1]) : NaN;
        }
      }

      return NaN;
    })
    .filter((id) => Number.isFinite(id));
}

async function pedirAClientify(url: URL, token: string): Promise<Response> {
  // La v1 autentica con "Token <clave>"; si la v2 esperara "Bearer", el primer
  // intento devuelve 401 y se reintenta con el otro esquema.
  let respuesta = await fetch(url, {
    headers: { Authorization: `Token ${token}`, Accept: "application/json" },
  });

  if (respuesta.status === 401 || respuesta.status === 403) {
    respuesta = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
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

  const buscar = entrante.searchParams.get("buscar");
  const empresa = entrante.searchParams.get("empresa");
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

    // --- Empleados (contactos) de una empresa ---
    if (recurso === "contacts" && (empresaId !== null || empresa !== null)) {
      const todos = await catalogoCompleto("contacts", token);

      // Vía principal: los ids que la propia empresa lista en "employees".
      if (empresaId !== null) {
        const empresas = await catalogoCompleto("companies", token);
        const laEmpresa = empresas.find(
          (registro) => String(registro.id) === empresaId,
        );

        const ids = new Set(idsDeEmpleados(laEmpresa?.employees));

        if (ids.size > 0) {
          const coincidencias = todos.filter((registro) =>
            ids.has(Number(registro.id)),
          );
          return json({
            count: coincidencias.length,
            results: coincidencias,
            origen: "employees",
          });
        }

        // Si la empresa no lista empleados, se intenta por nombre antes de
        // darla por vacía.
        if (empresa === null && laEmpresa) {
          const porNombre = normalizar(laEmpresa.name);
          const coincidencias = todos.filter(
            (registro) =>
              normalizar(registro.company) === porNombre ||
              normalizar(registro.company_name) === porNombre,
          );
          return json({
            count: coincidencias.length,
            results: coincidencias,
            origen: "nombre",
          });
        }
      }

      // Respaldo: cruce por nombre de empresa.
      const objetivo = normalizar(empresa);
      if (objetivo.length < 2) return json({ count: 0, results: [] });

      const coincidencias = todos
        .filter(
          (registro) =>
            normalizar(registro.company) === objetivo ||
            normalizar(registro.company_name) === objetivo,
        )
        .slice(0, 20);

      return json({
        count: coincidencias.length,
        results: coincidencias,
        origen: "nombre",
      });
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
