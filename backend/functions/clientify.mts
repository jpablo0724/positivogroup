import { revisarSesion } from "../lib/acceso.mts";
import { CLIENTIFY_BASE, pedirAClientify } from "../lib/clientifyApi.mts";

/**
 * Proxy hacia la API de Clientify (v2).
 *
 * El token de Clientify da acceso a todo el CRM, así que nunca puede viajar
 * al navegador: vive solo aquí, como variable de entorno del servidor
 * (CLIENTIFY_API_TOKEN).
 *
 * Exige sesión abierta: sin eso, cualquiera con la dirección podría leerse el
 * CRM completo a través de este proxy.
 *
 * Rutas:
 *   /api/clientify/me                      -> valida el token y devuelve la cuenta
 *   /api/clientify/companies?buscar=texto    -> empresas cuyo nombre/NIT coincide, con sus contactos
 *   /api/clientify/contacts?empresaId=id     -> contactos de esa empresa
 *   /api/clientify/nota  (POST)              -> anota una cotización en la empresa
 *
 * La nota se anota siempre a nombre de la cuenta dueña de CLIENTIFY_API_TOKEN:
 * se probó a mandar el dueño real (por id de usuario, por correo, con los
 * distintos nombres de campo que usa la API — owner, owner_id, assigned_to,
 * assigned_to_id) y Clientify los ignora todos. Su endpoint de anotar una
 * empresa (/companies/<id>/note/, documentado así en newapi.clientify.com)
 * solo acepta "name" y "comment" — no hay forma soportada de fijar el dueño.
 * Por eso quien creó la cotización va como texto, en la propia nota
 * (ver textoDeNota en src/utils/notaClientify.ts), no como un dato del CRM.
 *
 * Sin "buscar"/"empresaId" la consulta se reenvía tal cual a Clientify, lo que
 * sirve para inspeccionar la API desde el navegador.
 *
 * Nota: la v2 ignora los filtros por parámetro (?name=, ?company=) y devuelve
 * el listado completo, así que el filtrado se hace aquí sobre el catálogo
 * descargado, que se guarda en memoria unos minutos para no rebajar el CRM en
 * cada tecla que se escribe.
 */

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
//
// Los contactos NO llegan anidados en la empresa (se probó pidiendo
// "employees" y Clientify simplemente no lo devuelve): viven en su propio
// recurso, /contacts/, y cada uno solo dice el NOMBRE de su empresa en el
// campo "company" — no hay un id que los enlace. Por eso companies() cruza
// ambos catálogos por nombre normalizado antes de responder.
const CAMPOS_POR_DEFECTO: Record<string, string> = {
  companies: "id,name,business_name,taxpayer_identification_number",
  contacts: "id,full_name,first_name,last_name,emails,phones,company,company_name",
};

const TAMANO_PAGINA = 500;
const MAXIMO_PAGINAS = 30;
// El catálogo de empresas cambia poco durante una jornada de trabajo, así que
// se conserva un buen rato: cada descarga completa son varias páginas.
const VIGENCIA_CACHE_MS = 20 * 60 * 1000;
// Páginas que se piden a la vez una vez se sabe cuántas hay. Pocas, para no
// toparse con el límite de peticiones de Clientify.
const PAGINAS_EN_PARALELO = 4;

type Registro = Record<string, unknown>;

const cache = new Map<string, { guardadoEn: number; registros: Registro[] }>();
// Descargas en curso. Mientras el catálogo baja, cada tecla que escribe el
// usuario (y cada otro usuario) espera esa misma descarga en vez de lanzar
// otra completa por su cuenta.
const enCurso = new Map<string, Promise<Registro[]>>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/**
 * Agrupa los contactos por el nombre de su empresa (normalizado), que es el
 * único dato con el que Clientify los enlaza — no hay un id de por medio.
 */
export function contactosPorNombreDeEmpresa(
  contactos: Registro[],
): Map<string, Registro[]> {
  const mapa = new Map<string, Registro[]>();
  for (const contacto of contactos) {
    const clave = normalizar(contacto.company);
    if (clave === "") continue;
    const lista = mapa.get(clave);
    if (lista) lista.push(contacto);
    else mapa.set(clave, [contacto]);
  }
  return mapa;
}

/**
 * Los contactos de una empresa: se busca tanto por su nombre comercial como
 * por su razón social, porque en Clientify el contacto solo trae uno de los
 * dos como texto y no siempre es el mismo que se muestra en la búsqueda.
 */
export function contactosDeEmpresa(
  empresa: Registro,
  porNombre: Map<string, Registro[]>,
): Registro[] {
  const deNombre = porNombre.get(normalizar(empresa.name)) ?? [];
  const claveRazonSocial = normalizar(empresa.business_name);
  if (claveRazonSocial === "" || claveRazonSocial === normalizar(empresa.name)) {
    return deNombre;
  }

  const deRazonSocial = porNombre.get(claveRazonSocial) ?? [];
  if (deRazonSocial.length === 0) return deNombre;

  // Se combinan sin duplicar, por si el mismo contacto quedó con el mismo
  // texto en las dos búsquedas.
  const vistos = new Set(deNombre.map((c) => c.id));
  return [...deNombre, ...deRazonSocial.filter((c) => !vistos.has(c.id))];
}

/** Quita acentos y mayúsculas para que "Bancoldex" encuentre "Bancóldex". */
function normalizar(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Solo los dígitos, para que "900.123.456-1" y "9001234561" coincidan. */
function soloDigitos(valor: unknown): string {
  return String(valor ?? "").replace(/\D/g, "");
}

interface PaginaClientify {
  results?: Registro[];
  next?: string | null;
  count?: number;
}

async function pedirPagina(
  recurso: string,
  pagina: number,
  token: string,
): Promise<PaginaClientify> {
  const url = new URL(`${CLIENTIFY_BASE}/${recurso}/`);
  url.searchParams.set("fields", CAMPOS_POR_DEFECTO[recurso] ?? "id,name");
  url.searchParams.set("page_size", String(TAMANO_PAGINA));
  url.searchParams.set("page", String(pagina));

  const respuesta = await pedirAClientify(url, token);
  if (!respuesta.ok) {
    throw new Error(`Clientify respondió ${respuesta.status} al pedir ${recurso}`);
  }
  return (await respuesta.json()) as PaginaClientify;
}

function lote(pagina: PaginaClientify): Registro[] {
  return Array.isArray(pagina.results) ? pagina.results : [];
}

/**
 * Descarga el listado completo de un recurso. La primera página dice cuántos
 * registros hay en total, y con eso el resto se pide en paralelo en vez de
 * una tras otra. Si Clientify no informa el total, se sigue página a página.
 */
async function descargarCatalogo(
  recurso: string,
  token: string,
): Promise<Registro[]> {
  const primera = await pedirPagina(recurso, 1, token);
  const registros = [...lote(primera)];

  if (!primera.next || registros.length === 0) return registros;

  if (typeof primera.count === "number" && primera.count > 0) {
    const totalPaginas = Math.min(
      MAXIMO_PAGINAS,
      Math.ceil(primera.count / registros.length),
    );
    const pendientes: number[] = [];
    for (let p = 2; p <= totalPaginas; p++) pendientes.push(p);

    const porPagina: Registro[][] = [];
    for (let i = 0; i < pendientes.length; i += PAGINAS_EN_PARALELO) {
      const tanda = pendientes.slice(i, i + PAGINAS_EN_PARALELO);
      const paginas = await Promise.all(
        tanda.map((p) => pedirPagina(recurso, p, token)),
      );
      paginas.forEach((pagina, j) => (porPagina[tanda[j]] = lote(pagina)));
    }
    for (const parte of porPagina) if (parte) registros.push(...parte);
    return registros;
  }

  for (let pagina = 2; pagina <= MAXIMO_PAGINAS; pagina++) {
    const cuerpo = await pedirPagina(recurso, pagina, token);
    registros.push(...lote(cuerpo));
    if (!cuerpo.next || lote(cuerpo).length === 0) break;
  }
  return registros;
}

/** Lanza (o reutiliza) la descarga del catálogo y la guarda en caché. */
function refrescarCatalogo(recurso: string, token: string): Promise<Registro[]> {
  const yaBajando = enCurso.get(recurso);
  if (yaBajando) return yaBajando;

  const inicio = Date.now();
  const promesa = descargarCatalogo(recurso, token)
    .then((registros) => {
      cache.set(recurso, { guardadoEn: Date.now(), registros });
      console.log(
        `Clientify: ${recurso} descargado (${registros.length} registros, ${Date.now() - inicio} ms)`,
      );
      return registros;
    })
    .finally(() => enCurso.delete(recurso));

  enCurso.set(recurso, promesa);
  return promesa;
}

/**
 * El catálogo de un recurso. Si el caché está vencido se responde igual con
 * lo guardado y se renueva por detrás: así nadie se queda esperando la
 * descarga completa salvo la primera vez tras arrancar el servidor (y eso lo
 * evita precalentarCatalogos).
 */
async function catalogoCompleto(
  recurso: string,
  token: string,
): Promise<Registro[]> {
  const enCache = cache.get(recurso);
  if (!enCache) return refrescarCatalogo(recurso, token);

  if (Date.now() - enCache.guardadoEn >= VIGENCIA_CACHE_MS) {
    refrescarCatalogo(recurso, token).catch((err) =>
      console.error(`Clientify: no se pudo renovar ${recurso}`, err),
    );
  }
  return enCache.registros;
}

/**
 * Descarga empresas y contactos al arrancar el servidor, para que la primera
 * búsqueda del día no tenga que esperar a que bajen.
 */
export function precalentarCatalogos(): void {
  const token = process.env.CLIENTIFY_API_TOKEN;
  if (!token) return;
  for (const recurso of ["companies", "contacts"]) {
    refrescarCatalogo(recurso, token).catch((err) =>
      console.error(`Clientify: no se pudo precargar ${recurso}`, err),
    );
  }
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
          "está creada en el servidor, hay que reiniciarlo para que entre.",
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
      // Con ?por=nit solo se mira el NIT, y por dígitos: así da igual si se
      // escribe con puntos y guion o sin ellos.
      const porNit = entrante.searchParams.get("por") === "nit";
      const consulta = porNit ? soloDigitos(buscar) : normalizar(buscar);
      if (consulta.length < (porNit ? 3 : 2)) {
        return json({ count: 0, results: [] });
      }

      const [todas, contactos] = await Promise.all([
        catalogoCompleto("companies", token),
        catalogoCompleto("contacts", token),
      ]);
      const contactosPorNombre = contactosPorNombreDeEmpresa(contactos);

      const coincide = porNit
        ? (registro: Registro) =>
            soloDigitos(registro.taxpayer_identification_number).includes(
              consulta,
            )
        : (registro: Registro) =>
            normalizar(registro.name).includes(consulta) ||
            normalizar(registro.business_name).includes(consulta) ||
            normalizar(registro.taxpayer_identification_number).includes(
              consulta,
            );

      const coincidencias = todas
        .filter(coincide)
        .slice(0, 20)
        .map((empresa) => ({
          ...empresa,
          employees: contactosDeEmpresa(empresa, contactosPorNombre),
        }));

      return json({ count: coincidencias.length, results: coincidencias });
    }

    // --- Empleados de una empresa, tomados del catálogo ya cacheado ---
    if (recurso === "contacts" && empresaId !== null) {
      const [empresas, contactos] = await Promise.all([
        catalogoCompleto("companies", token),
        catalogoCompleto("contacts", token),
      ]);
      const laEmpresa = empresas.find(
        (registro) => String(registro.id) === empresaId,
      );
      const empleados = laEmpresa
        ? contactosDeEmpresa(laEmpresa, contactosPorNombreDeEmpresa(contactos))
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
