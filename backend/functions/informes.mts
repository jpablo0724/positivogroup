import { json, quienPide } from "../lib/acceso.mts";
import { puede } from "../lib/auth.mts";
import { CLIENTIFY_BASE, pedirAClientify } from "../lib/clientifyApi.mts";

/**
 * Embudo de leads de Clientify para la pestaña Informes.
 *
 *   GET /api/informes/contactos   -> todos los contactos, ya clasificados
 *   GET /api/informes/conversion  -> fechas "pasó a Aplica" / "pasó a Cliente"
 *                                    de los clientes, para el tiempo de conversión
 *
 * Exige el permiso "informes" (además de sesión).
 *
 * Cada contacto se clasifica aquí, una sola vez, en los niveles del embudo:
 *
 *   Origen          etiquetas de campaña + campo "¿Cómo conociste a positivo group?"
 *   Nivel 2         "Tipo" del contacto en Clientify (contact_type): APLICA, NO APLICA…
 *   Nivel 3         Estado general, sacado del prefijo del campo "Estado de gestión"
 *                   (OP = En oportunidad, G = En gestión, OFF, C = Cliente…)
 *   Nivel 4         el valor completo de "Estado de gestión", con un nombre legible
 *
 * El navegador solo cuenta y filtra: así la regla de negocio vive en un lugar.
 *
 * Los ids de campos personalizados y los nombres de etiquetas se copiaron de
 * la cuenta de Clientify (inspeccionada el 27-oct-2026). Si en el CRM se
 * crea una campaña nueva o se renombra una opción, hay que actualizarlo aquí.
 */

const CAMPO_ESTADO_GESTION = 324845;
const CAMPO_COMO_CONOCIO = 513977;

// --- Origen -----------------------------------------------------------------

export interface Origen {
  clave: string;
  nombre: string;
  grupo: string;
  /** Etiquetas de Clientify que cuentan para este origen, ya normalizadas. */
  etiquetas: string[];
  nota?: string;
}

/**
 * Las etiquetas se escriben como están en Clientify, con sus errores
 * ("barranquilla-abri-2026", "positvo-organico"): si se corrigieran aquí, el
 * informe dejaría de encontrar esos contactos.
 */
export const ORIGENES: Origen[] = [
  { clave: "barranquilla-abr", nombre: "Barranquilla · Abril 2026", grupo: "Meta Ads · Ciudad", etiquetas: ["barranquilla-abri-2026", "barranquilla-abril-2026"] },
  { clave: "bogota-abr", nombre: "Bogotá · Abril 2026", grupo: "Meta Ads · Ciudad", etiquetas: ["bogotá-abril-2026"] },
  { clave: "cali-abr", nombre: "Cali · Abril 2026", grupo: "Meta Ads · Ciudad", etiquetas: ["cali-abril-2026"] },
  { clave: "medellin-abr", nombre: "Medellín · Abril 2026", grupo: "Meta Ads · Ciudad", etiquetas: ["medellín-abril-2026"] },
  { clave: "pereira-abr", nombre: "Pereira-Manizales · Abril 2026", grupo: "Meta Ads · Ciudad", etiquetas: ["pereira-manizales-abril-2026"] },
  { clave: "barranquilla-oct", nombre: "Barranquilla · Oct 2026", grupo: "Meta Ads · Ciudad", etiquetas: ["barranquilla-oct2026"] },
  { clave: "bogota-oct", nombre: "Bogotá · Oct 2026", grupo: "Meta Ads · Ciudad", etiquetas: ["bogotá-oct2026"] },
  { clave: "cali-oct", nombre: "Cali · Oct 2026", grupo: "Meta Ads · Ciudad", etiquetas: ["cali-oct2026"] },
  { clave: "medellin-oct", nombre: "Medellín · Oct 2026", grupo: "Meta Ads · Ciudad", etiquetas: ["medellín-oct2026"] },
  { clave: "pereira-oct", nombre: "Pereira-Armenia · Oct 2026", grupo: "Meta Ads · Ciudad", etiquetas: ["pereira-armenia-oct2026"] },
  { clave: "advantage", nombre: "Advantage (amplia)", grupo: "Meta Ads · General", etiquetas: ["advantage", "advantage-oct2026"] },
  { clave: "mas-pauta", nombre: "Más pauta", grupo: "Meta Ads · General", etiquetas: ["más-pauta", "mas-pauta"], nota: "Activa en julio y parte de agosto" },
  { clave: "sampling", nombre: "Sampling", grupo: "Meta Ads · General", etiquetas: ["sampling", "sampling-ajuste"], nota: "Activa en julio y parte de agosto" },
  { clave: "google-ads", nombre: "Google Ads", grupo: "Formularios web", etiquetas: ["positivo - pauta - google ads", "positivo-pauta-google-ads"] },
  { clave: "organico", nombre: "Orgánico web", grupo: "Formularios web", etiquetas: ["positvo-organico", "positivo-organico"] },
  { clave: "administradores", nombre: "Administradores web", grupo: "Formularios web", etiquetas: ["positivo - administradores - web", "positivo-administradores-web"] },
];

/** Opciones del campo "¿Cómo conociste a positivo group?", tal cual en Clientify. */
export const COMO_CONOCIO = [
  { valor: "Facebook", nombre: "Facebook" },
  { valor: "Instagram", nombre: "Instagram" },
  { valor: "Google", nombre: "Google" },
  { valor: "Referido (amigo,  cliente o aliado)", nombre: "Referido (amigo, cliente o aliado)" },
  { valor: "Ascensor", nombre: "Ascensor" },
];

// --- Niveles 2, 3 y 4 ------------------------------------------------------

export const CALIFICACIONES = [
  { clave: "aplica", nombre: "Aplica" },
  { clave: "no-aplica", nombre: "No aplica" },
  { clave: "duplicado", nombre: "Duplicado" },
  { clave: "agencia", nombre: "Agencia" },
  { clave: "secundario", nombre: "Contacto secundario" },
  { clave: "sin-calificar", nombre: "Sin calificar" },
];

export const ESTADOS_GENERALES = [
  { clave: "oportunidad", nombre: "En oportunidad" },
  { clave: "gestion", nombre: "En gestión" },
  { clave: "off", nombre: "Off" },
  { clave: "cliente", nombre: "Cliente" },
  { clave: "duplicado", nombre: "Duplicado" },
  { clave: "secundario", nombre: "Contacto secundario" },
  { clave: "no-aplica", nombre: "Marcado No aplica" },
  { clave: "sin-estado", nombre: "Sin estado de gestión" },
];

/**
 * Cada opción de "Estado de gestión" con su estado general (nivel 3) y el
 * nombre con que se muestra (nivel 4). "Cliente" a secas es un valor viejo
 * que aún tienen algunos contactos, de antes de que la opción se llamara
 * "C - Cliente".
 */
export const SUBESTADOS: { valor: string; estado: string; nombre: string }[] = [
  { valor: "OP - Contactado por Email", estado: "oportunidad", nombre: "Contactado por email" },
  { valor: "OP - Contactado por WApp", estado: "oportunidad", nombre: "Contactado por WhatsApp" },
  { valor: "OP - Interes de Compra Mayor a 3 Meses", estado: "oportunidad", nombre: "Interés de compra mayor a 3 meses" },
  { valor: "G - Informacion Comercial Enviada", estado: "gestion", nombre: "Información comercial enviada" },
  { valor: "G - Cotizacion Enviada", estado: "gestion", nombre: "Cotización enviada" },
  { valor: "G - Interes de Compra Menos a 3 Meses", estado: "gestion", nombre: "Interés de compra menor a 3 meses" },
  { valor: "G - En Espera de documentos para Creacion de cliente", estado: "gestion", nombre: "En espera de documentos para creación de cliente" },
  { valor: "G - Estudio de Credito", estado: "gestion", nombre: "En estudio de crédito" },
  { valor: "OFF - Solo Busca Informacion", estado: "off", nombre: "Solo busca información" },
  { valor: "OFF - No contesta", estado: "off", nombre: "No contesta" },
  { valor: "C - Cliente", estado: "cliente", nombre: "Cliente" },
  { valor: "Cliente", estado: "cliente", nombre: "Cliente" },
  { valor: "Duplicado", estado: "duplicado", nombre: "Duplicado" },
  { valor: "Contacto Secundario", estado: "secundario", nombre: "Contacto secundario" },
  { valor: "NA - Administrador de PH", estado: "no-aplica", nombre: "Administrador de propiedad horizontal" },
  { valor: "NA - Descartado por Presupuesto", estado: "no-aplica", nombre: "Descartado por presupuesto" },
  { valor: "NA - No tenemos lo que busca", estado: "no-aplica", nombre: "No tenemos lo que busca" },
  { valor: "NA - Numero equivocado", estado: "no-aplica", nombre: "Número equivocado" },
  { valor: "NA - No Info No Contesta", estado: "no-aplica", nombre: "No información (no contesta)" },
];

// --- Lectura de Clientify ---------------------------------------------------

const CAMPOS = "id,full_name,contact_type,status,tags,custom_fields,company_name,owner,owner_name,created";
// Páginas chicas pedidas varias a la vez: una página de 500 con campos
// personalizados podía pasar del límite de espera y tumbar el informe
// entero, y en serie la descarga completa tardaba más de un minuto.
const TAMANO_PAGINA = 100;
const MAXIMO_PAGINAS = 200;
const PAGINAS_SIMULTANEAS = 6;
const REINTENTOS_PAGINA = 2;
// Pasado este tiempo se renueva por detrás; mientras tanto se sigue
// respondiendo con lo guardado, así nadie espera la descarga salvo la
// primera vez tras un reinicio (y para eso está precalentarInformes).
const VIGENCIA_CACHE_MS = 20 * 60 * 1000;

type Registro = Record<string, unknown>;

let cache: { guardadoEn: number; contactos: Registro[] } | null = null;
// La descarga en curso, compartida: si llegan varias peticiones a la vez
// (contactos y conversión salen juntas del navegador) bajan una sola vez.
let descargaEnCurso: Promise<Registro[]> | null = null;

export interface ContactoInforme {
  id: number;
  nombre: string;
  empresa: string;
  comercial: string;
  /** Fecha de ingreso al CRM, "AAAA-MM-DD" en hora de Colombia. */
  creado: string;
  calificacion: string;
  estadoGeneral: string;
  /** Valor crudo de "Estado de gestión" ("" si no tiene). */
  estadoGestion: string;
  /** Claves de ORIGENES que tiene el contacto. */
  origenes: string[];
  /** Valores de COMO_CONOCIO marcados. */
  comoConocio: string[];
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

/** Minúsculas, sin "#" ni espacios de sobra: así se comparan las etiquetas. */
export function normalizarEtiqueta(etiqueta: string): string {
  return etiqueta.normalize("NFC").trim().toLowerCase().replace(/^#+/, "");
}

const ORIGEN_POR_ETIQUETA = new Map<string, string>();
for (const origen of ORIGENES) {
  for (const etiqueta of origen.etiquetas) {
    ORIGEN_POR_ETIQUETA.set(normalizarEtiqueta(etiqueta), origen.clave);
  }
}

const SUBESTADO_POR_VALOR = new Map(
  SUBESTADOS.map((s) => [s.valor.toLowerCase(), s]),
);

function valorDeCampo(contacto: Registro, campoId: number): unknown {
  const campos = Array.isArray(contacto.custom_fields)
    ? (contacto.custom_fields as Registro[])
    : [];
  return campos.find((c) => c.field_id === campoId)?.value;
}

export function calificacionDe(tipo: string): string {
  const t = tipo.trim().toUpperCase();
  if (t === "APLICA") return "aplica";
  if (t === "NO APLICA") return "no-aplica";
  if (t === "DUPLICADO") return "duplicado";
  if (t === "AGENCIA") return "agencia";
  if (t === "CONTACTO SECUNDARIO") return "secundario";
  return "sin-calificar";
}

export function estadoGeneralDe(estadoGestion: string): string {
  const valor = estadoGestion.trim();
  if (!valor) return "sin-estado";
  const conocido = SUBESTADO_POR_VALOR.get(valor.toLowerCase());
  if (conocido) return conocido.estado;
  // Una opción nueva en Clientify que aún no está en la lista: se ubica por
  // su prefijo, que es la convención que usan.
  const prefijo = valor.split(/\s*-\s*/)[0].toUpperCase();
  if (prefijo === "OP") return "oportunidad";
  if (prefijo === "G") return "gestion";
  if (prefijo === "OFF") return "off";
  if (prefijo === "C") return "cliente";
  if (prefijo === "NA") return "no-aplica";
  return "sin-estado";
}

/**
 * El multiselección puede llegar como lista o como texto. No se parte por
 * comas porque "Referido (amigo,  cliente o aliado)" lleva comas: se busca
 * cada opción conocida dentro del valor.
 */
export function comoConocioDe(valor: unknown): string[] {
  const crudo = Array.isArray(valor) ? valor.map(texto).join("|") : texto(valor);
  if (!crudo) return [];
  const comparable = crudo.toLowerCase().replace(/\s+/g, " ");
  return COMO_CONOCIO.filter((o) =>
    comparable.includes(o.valor.toLowerCase().replace(/\s+/g, " ")),
  ).map((o) => o.valor);
}

export function comoContactoInforme(contacto: Registro): ContactoInforme {
  const estadoGestion = texto(valorDeCampo(contacto, CAMPO_ESTADO_GESTION));
  const etiquetas = Array.isArray(contacto.tags)
    ? (contacto.tags as unknown[]).map(texto).filter(Boolean)
    : [];
  const origenes = [
    ...new Set(
      etiquetas
        .map((e) => ORIGEN_POR_ETIQUETA.get(normalizarEtiqueta(e)))
        .filter((c): c is string => Boolean(c)),
    ),
  ];

  return {
    id: Number(contacto.id),
    nombre: texto(contacto.full_name),
    empresa: texto(contacto.company_name),
    comercial: texto(contacto.owner_name) || texto(contacto.owner),
    // La fecha ya viene con la zona de Colombia (-05:00): los primeros 10
    // caracteres son el día local, sin tener que convertir.
    creado: texto(contacto.created).slice(0, 10),
    calificacion: calificacionDe(texto(contacto.contact_type)),
    estadoGeneral: estadoGeneralDe(estadoGestion),
    estadoGestion,
    origenes,
    comoConocio: comoConocioDe(valorDeCampo(contacto, CAMPO_COMO_CONOCIO)),
  };
}

interface PaginaContactos {
  results?: Registro[];
  next?: string | null;
  count?: number;
}

async function paginaDeContactos(pagina: number, token: string): Promise<PaginaContactos> {
  const url = new URL(`${CLIENTIFY_BASE}/contacts/`);
  url.searchParams.set("fields", CAMPOS);
  url.searchParams.set("page_size", String(TAMANO_PAGINA));
  url.searchParams.set("page", String(pagina));

  let ultimoError: unknown;
  for (let intento = 0; intento <= REINTENTOS_PAGINA; intento++) {
    try {
      const respuesta = await pedirAClientify(url, token);
      if (respuesta.ok) return (await respuesta.json()) as PaginaContactos;
      ultimoError = new Error(`Clientify respondió ${respuesta.status} en la página ${pagina}`);
      // Un 4xx no se arregla reintentando (salvo 429, que es "más despacio").
      if (respuesta.status < 500 && respuesta.status !== 429) break;
    } catch (err) {
      ultimoError = err;
    }
    await new Promise((r) => setTimeout(r, 800 * (intento + 1)));
  }
  throw ultimoError;
}

/**
 * Baja todos los contactos: la primera página dice cuántos hay ("count") y
 * con eso el resto se pide en paralelo. Si Clientify no mandara el total,
 * se sigue página a página hasta que no haya "next".
 */
export async function descargarContactos(token: string): Promise<Registro[]> {
  const inicio = Date.now();
  const primera = await paginaDeContactos(1, token);
  const lotes: Registro[][] = [primera.results ?? []];

  if (typeof primera.count === "number") {
    const paginas = Math.min(MAXIMO_PAGINAS, Math.ceil(primera.count / TAMANO_PAGINA));
    let siguiente = 2;
    const trabajador = async () => {
      while (siguiente <= paginas) {
        const pagina = siguiente++;
        lotes[pagina - 1] = (await paginaDeContactos(pagina, token)).results ?? [];
      }
    };
    await Promise.all(Array.from({ length: PAGINAS_SIMULTANEAS }, trabajador));
  } else {
    let actual = primera;
    for (let pagina = 2; actual.next && pagina <= MAXIMO_PAGINAS; pagina++) {
      actual = await paginaDeContactos(pagina, token);
      if (!actual.results?.length) break;
      lotes.push(actual.results);
    }
  }

  // Un contacto puede repetirse si se crea uno nuevo mientras se pagina
  // (corre los demás una posición): se deja una sola vez cada id.
  const porId = new Map<unknown, Registro>();
  for (const c of lotes.flat()) porId.set(c.id, c);
  const contactos = [...porId.values()];
  console.log(`Informes: ${contactos.length} contactos de Clientify en ${Date.now() - inicio} ms`);
  return contactos;
}

function renovarContactos(token: string): Promise<Registro[]> {
  descargaEnCurso ??= descargarContactos(token)
    .then((contactos) => {
      cache = { guardadoEn: Date.now(), contactos };
      return contactos;
    })
    .finally(() => {
      descargaEnCurso = null;
    });
  return descargaEnCurso;
}

async function contactosCompletos(token: string): Promise<Registro[]> {
  if (!cache) return renovarContactos(token);
  if (Date.now() - cache.guardadoEn >= VIGENCIA_CACHE_MS) {
    renovarContactos(token).catch((err) =>
      console.error("Informes: no se pudo renovar los contactos", err),
    );
  }
  return cache.contactos;
}

/**
 * Descarga los contactos y el historial de los clientes al arrancar el
 * servidor, para que la primera visita a Informes tras un despliegue no
 * tenga que esperar.
 */
export function precalentarInformes(): void {
  const token = process.env.CLIENTIFY_API_TOKEN;
  if (!token) return;
  renovarContactos(token)
    .then(() => conversionesDeClientes(token))
    .catch((err) => console.error("Informes: no se pudo precargar", err));
}

// --- Tiempo de conversión ---------------------------------------------------

export interface Conversion {
  id: number;
  /** Cuándo se marcó APLICA (ISO), o la fecha de ingreso si no quedó registro. */
  aplicaEn: string;
  aplicaEstimado: boolean;
  /** Cuándo pasó a Cliente (ISO), o "" si el historial no lo registra. */
  clienteEn: string;
}

// Una vez un contacto pasa a Cliente esas fechas no cambian, así que se
// guardan sin vencimiento. Los que no tienen registro se reintentan con la
// vigencia normal, por si fue una falla momentánea.
const conversiones = new Map<number, { guardadoEn: number; dato: Conversion }>();
const MAXIMO_PAGINAS_HISTORIAL = 5;
const PETICIONES_SIMULTANEAS = 4;

/**
 * Del historial ("logger") del contacto saca la primera vez que su tipo
 * quedó en APLICA y la primera vez que "Estado de gestión" quedó en Cliente.
 * Las entradas llegan de la más reciente a la más vieja.
 */
export function fechasDeConversion(entradas: Registro[]): { aplicaEn: string; clienteEn: string } {
  let aplicaEn = "";
  let clienteEn = "";
  for (const entrada of entradas) {
    const extra = (entrada.extra ?? {}) as Registro;
    const campo = texto(extra.field_name);
    const nuevo = texto(extra.new_value);
    const fecha = texto(entrada.created);
    if (!fecha) continue;
    if (campo === "contact_type" && calificacionDe(nuevo) === "aplica") {
      if (!aplicaEn || fecha < aplicaEn) aplicaEn = fecha;
    }
    if (campo.startsWith("custom_field_Estado de gesti") && estadoGeneralDe(nuevo) === "cliente") {
      if (!clienteEn || fecha < clienteEn) clienteEn = fecha;
    }
  }
  return { aplicaEn, clienteEn };
}

/**
 * La v2 debería exponer el muro igual que la v1; si no, se cae a la v1 (el
 * mismo token sirve para ambas).
 */
// La versión de la API que respondió la última vez, para no probar las dos
// en cada uno de los clientes.
let baseHistorial = CLIENTIFY_BASE;

async function historialDe(id: number, token: string): Promise<Registro[]> {
  const bases = [...new Set([baseHistorial, CLIENTIFY_BASE, "https://api.clientify.net/v1"])];
  for (const base of bases) {
    const entradas: Registro[] = [];
    let ok = true;
    for (let pagina = 1; pagina <= MAXIMO_PAGINAS_HISTORIAL; pagina++) {
      const url = new URL(`${base}/contacts/${id}/wallentries/`);
      url.searchParams.set("type", "logger");
      url.searchParams.set("page_size", "100");
      url.searchParams.set("page", String(pagina));
      const respuesta = await pedirAClientify(url, token);
      if (!respuesta.ok) {
        ok = false;
        break;
      }
      const cuerpo = (await respuesta.json()) as { results?: Registro[]; next?: string | null };
      const lote = Array.isArray(cuerpo.results) ? cuerpo.results : [];
      entradas.push(...lote.filter((e) => !e.type || e.type === "logger"));
      if (!cuerpo.next || lote.length === 0) break;
    }
    if (ok) {
      baseHistorial = base;
      return entradas;
    }
  }
  throw new Error(`No se pudo leer el historial del contacto ${id}`);
}

async function conversionDe(contacto: Registro, token: string): Promise<Conversion> {
  const id = Number(contacto.id);
  const guardada = conversiones.get(id);
  if (guardada && (guardada.dato.clienteEn || Date.now() - guardada.guardadoEn < VIGENCIA_CACHE_MS)) {
    return guardada.dato;
  }

  const { aplicaEn, clienteEn } = fechasDeConversion(await historialDe(id, token));
  const dato: Conversion = {
    id,
    aplicaEn: aplicaEn || texto(contacto.created),
    aplicaEstimado: !aplicaEn,
    clienteEn,
  };
  conversiones.set(id, { guardadoEn: Date.now(), dato });
  return dato;
}

// Igual que con los contactos: la precarga y el navegador comparten un solo
// recorrido por los clientes en vez de hacer cada uno el suyo.
let conversionesEnCurso: Promise<Conversion[]> | null = null;

function conversionesDeClientes(token: string): Promise<Conversion[]> {
  conversionesEnCurso ??= recorrerClientes(token).finally(() => {
    conversionesEnCurso = null;
  });
  return conversionesEnCurso;
}

async function recorrerClientes(token: string): Promise<Conversion[]> {
  const clientes = (await contactosCompletos(token)).filter(
    (c) => comoContactoInforme(c).estadoGeneral === "cliente",
  );

  const resultado: Conversion[] = [];
  let siguiente = 0;
  // Unas pocas a la vez: son decenas de clientes y no conviene disparar
  // todas las peticiones juntas contra Clientify.
  const trabajador = async () => {
    while (siguiente < clientes.length) {
      const contacto = clientes[siguiente++];
      try {
        resultado.push(await conversionDe(contacto, token));
      } catch (err) {
        console.error("fallo_historial_contacto:", contacto.id, err);
      }
    }
  };
  await Promise.all(Array.from({ length: PETICIONES_SIMULTANEAS }, trabajador));
  return resultado;
}

// --- Rutas ------------------------------------------------------------------

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

  if (resto !== "contactos" && resto !== "conversion") {
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
    if (resto === "conversion") {
      return json({ conversiones: await conversionesDeClientes(token) });
    }

    const contactos = (await contactosCompletos(token)).map(comoContactoInforme);

    const comerciales = [
      ...new Set(contactos.map((c) => c.comercial).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "es"));

    return json({
      contactos,
      actualizadoEn: new Date(cache?.guardadoEn ?? Date.now()).toISOString(),
      catalogos: {
        origenes: ORIGENES.map(({ clave, nombre, grupo, nota }) => ({ clave, nombre, grupo, nota })),
        comoConocio: COMO_CONOCIO,
        calificaciones: CALIFICACIONES,
        estadosGenerales: ESTADOS_GENERALES,
        subestados: SUBESTADOS,
        comerciales,
      },
    });
  } catch (err) {
    // El detalle queda en el registro del servidor, no en la pantalla:
    // puede traer datos internos de la base de datos o del sistema.
    console.error("fallo_consultando_clientify:", err);
    return json({ error: "fallo_consultando_clientify" }, 502);
  }
};
