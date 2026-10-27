import {
  comoContactoInforme,
  descargarContactos,
  comoConocioDe,
  estadoGeneralDe,
  fechasDeConversion,
} from "../backend/functions/informes.mts";

/**
 * Clasificación del embudo de leads con datos reales de Clientify: las
 * etiquetas con "#" y errores de escritura, el valor viejo "Cliente", el
 * multiselección con comas dentro de una opción y el historial de un cliente
 * de verdad (Blaster, que pasó a APLICA el 30-sep y a Cliente el 15-oct).
 */

let fallos = 0;
function comprobar(nombre, condicion, detalle = "") {
  console.log(`${condicion ? "  ok  " : " FALLA"} ${nombre}${detalle ? ` -> ${detalle}` : ""}`);
  if (!condicion) fallos++;
}

console.log("\n== Estado general (nivel 3) ==");
comprobar("OP es En oportunidad", estadoGeneralDe("OP - Contactado por WApp") === "oportunidad");
comprobar("G es En gestión", estadoGeneralDe("G - Estudio de Credito") === "gestion");
comprobar("OFF es Off", estadoGeneralDe("OFF - No contesta") === "off");
comprobar("C - Cliente es Cliente", estadoGeneralDe("C - Cliente") === "cliente");
comprobar("el valor viejo 'Cliente' también", estadoGeneralDe("Cliente") === "cliente");
comprobar("NA es No aplica", estadoGeneralDe("NA - Numero equivocado") === "no-aplica");
comprobar("vacío es Sin estado", estadoGeneralDe("") === "sin-estado");
comprobar("una opción nueva se ubica por prefijo", estadoGeneralDe("G - Opción nueva") === "gestion");

console.log("\n== Contacto completo ==");
{
  const c = comoContactoInforme({
    id: 177007648,
    full_name: "Miguel gil",
    owner: "comercial.digital@positivogroup.com",
    owner_name: "Nohemí Calderín",
    contact_type: "APLICA",
    created: "2026-10-12T07:26:35.049673-05:00",
    tags: ["facebook-ads-lead", "comercial digital", "bogotá-abril-2026", "#advantage", "bogotá-oct2026"],
    custom_fields: [
      { field_id: 324845, value: "OP - Contactado por Email" },
      { field_id: 513977, value: "Instagram, Referido (amigo,  cliente o aliado)" },
    ],
  });
  comprobar("calificación Aplica", c.calificacion === "aplica");
  comprobar("estado En oportunidad", c.estadoGeneral === "oportunidad");
  comprobar("comercial por nombre", c.comercial === "Nohemí Calderín");
  comprobar("fecha de ingreso local", c.creado === "2026-10-12");
  comprobar(
    "orígenes: #advantage sin el # y las dos campañas de Bogotá",
    JSON.stringify(c.origenes.sort()) === JSON.stringify(["advantage", "bogota-abr", "bogota-oct"]),
    JSON.stringify(c.origenes),
  );
  comprobar("cómo conoció: dos opciones, sin partir el referido por la coma", c.comoConocio.length === 2, JSON.stringify(c.comoConocio));
}
{
  const c = comoContactoInforme({ id: 1, contact_type: null, tags: ["barranquilla-abri-2026", "positvo-organico"] });
  comprobar("sin tipo queda Sin calificar", c.calificacion === "sin-calificar");
  comprobar("etiquetas mal escritas en Clientify se reconocen", c.origenes.length === 2, JSON.stringify(c.origenes));
}
comprobar("cómo conoció como lista", comoConocioDe(["Google", "Ascensor"]).length === 2);

console.log("\n== Tiempo de conversión ==");
{
  const historial = [
    { created: "2026-10-15T10:38:30-05:00", extra: { field_name: "custom_field_Estado de gestión", new_value: "C - Cliente" } },
    { created: "2026-10-02T15:58:40-05:00", extra: { field_name: "custom_field_Estado de gestión", new_value: "G - En Espera de documentos para Creacion de cliente" } },
    { created: "2026-09-30T10:24:12-05:00", extra: { field_name: "contact_type", new_value: "APLICA" } },
    { created: "2026-09-30T10:24:06-05:00", extra: { field_name: "custom_field_Estado de gestión", new_value: "OP - Contactado por WApp" } },
  ];
  const { aplicaEn, clienteEn } = fechasDeConversion(historial);
  comprobar("encuentra cuándo pasó a APLICA", aplicaEn.startsWith("2026-09-30"));
  comprobar("encuentra cuándo pasó a Cliente", clienteEn.startsWith("2026-10-15"));
  const dias = (Date.parse(clienteEn) - Date.parse(aplicaEn)) / 86_400_000;
  comprobar("Blaster tardó ~15 días", Math.round(dias) === 15, dias.toFixed(2));
}

console.log("\n== Descarga en paralelo ==");
{
  // Clientify simulado: 437 contactos, y la página 3 falla una vez (como un
  // 502 pasajero) para comprobar el reintento.
  const TOTAL = 437;
  let peticiones = 0;
  let enVuelo = 0;
  let maximoEnVuelo = 0;
  let fallo3 = false;
  const fetchReal = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = new URL(String(url));
    const pagina = Number(u.searchParams.get("page"));
    const tamano = Number(u.searchParams.get("page_size"));
    peticiones++;
    enVuelo++;
    maximoEnVuelo = Math.max(maximoEnVuelo, enVuelo);
    await new Promise((r) => setTimeout(r, 20));
    enVuelo--;
    if (pagina === 3 && !fallo3) {
      fallo3 = true;
      return new Response("caído", { status: 502 });
    }
    const desde = (pagina - 1) * tamano;
    const cuantos = Math.max(0, Math.min(tamano, TOTAL - desde));
    const results = Array.from({ length: cuantos }, (_, i) => ({ id: desde + i + 1 }));
    return Response.json({ count: TOTAL, next: desde + tamano < TOTAL ? "x" : null, results });
  };
  try {
    const contactos = await descargarContactos("token-de-prueba");
    comprobar("trae todos los contactos", contactos.length === TOTAL, String(contactos.length));
    comprobar("sin repetidos", new Set(contactos.map((c) => c.id)).size === TOTAL);
    comprobar("pide varias páginas a la vez", maximoEnVuelo > 1, `máximo simultáneas: ${maximoEnVuelo}`);
    comprobar("reintenta la página que falló", fallo3 && peticiones === Math.ceil(TOTAL / 100) + 1, `${peticiones} peticiones`);
  } finally {
    globalThis.fetch = fetchReal;
  }
}

console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\nTodo bien");
process.exit(fallos ? 1 : 0);
