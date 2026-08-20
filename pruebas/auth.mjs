import { register } from "node:module";
register("./loader.mjs", import.meta.url);

const CODIGO_EMPRESA = "codigo-de-la-empresa-para-pruebas";
process.env.APP_ACCESS_CODE = CODIGO_EMPRESA;

const { default: auth } = await import("../netlify/functions/auth.mts");
const { default: cotizaciones } = await import("../netlify/functions/cotizaciones.mts");

const BASE = "https://cotizador-positivo.netlify.app";

let fallos = 0;
function comprobar(nombre, condicion, detalle = "") {
  console.log(`${condicion ? "  ok  " : " FALLA"} ${nombre}${detalle ? ` -> ${detalle}` : ""}`);
  if (!condicion) fallos++;
}

function req(ruta, { metodo = "POST", cuerpo, cookie } = {}) {
  return new Request(`${BASE}${ruta}`, {
    method: metodo,
    headers: cookie ? { cookie } : {},
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

async function leer(respuesta) {
  return {
    status: respuesta.status,
    cuerpo: await respuesta.json(),
    cookie: respuesta.headers.get("set-cookie") ?? "",
  };
}

/** Extrae "pg_sesion=xxx" de un Set-Cookie para reenviarlo como Cookie. */
function comoCookie(setCookie) {
  return setCookie.split(";")[0];
}

const CUENTA = {
  nombre: "Juan Pablo Moncada",
  email: "Juan.Pablo@positivogroup.com",
  contrasena: "unaClaveLarga2026",
  codigo: CODIGO_EMPRESA,
};

console.log("\n== Registro ==");
let cookieJuan = "";
{
  const sinCodigo = await leer(await auth(req("/api/auth/registro", { cuerpo: { ...CUENTA, codigo: "" } })));
  comprobar("sin código de empresa -> 403", sinCodigo.status === 403, sinCodigo.cuerpo.error);

  const codigoMalo = await leer(await auth(req("/api/auth/registro", { cuerpo: { ...CUENTA, codigo: "otra-cosa" } })));
  comprobar("código equivocado -> 403", codigoMalo.status === 403, codigoMalo.cuerpo.error);

  const corta = await leer(await auth(req("/api/auth/registro", { cuerpo: { ...CUENTA, contrasena: "corta" } })));
  comprobar("contraseña corta -> 400", corta.status === 400, corta.cuerpo.error);

  const emailMalo = await leer(await auth(req("/api/auth/registro", { cuerpo: { ...CUENTA, email: "no-es-correo" } })));
  comprobar("correo inválido -> 400", emailMalo.status === 400, emailMalo.cuerpo.error);

  const sinNombre = await leer(await auth(req("/api/auth/registro", { cuerpo: { ...CUENTA, nombre: "  " } })));
  comprobar("sin nombre -> 400", sinNombre.status === 400, sinNombre.cuerpo.error);

  const bien = await leer(await auth(req("/api/auth/registro", { cuerpo: CUENTA })));
  comprobar("registro correcto -> 200", bien.status === 200, `status ${bien.status}`);
  comprobar("devuelve el usuario", bien.cuerpo.usuario?.nombre === CUENTA.nombre, bien.cuerpo.usuario?.nombre);
  comprobar("normaliza el correo a minúsculas", bien.cuerpo.usuario?.email === CUENTA.email.toLowerCase(), bien.cuerpo.usuario?.email);
  comprobar("NO devuelve la contraseña ni el hash",
    !JSON.stringify(bien.cuerpo).match(/clave|sal|contrasena/i), JSON.stringify(bien.cuerpo));

  comprobar("entrega cookie de sesión", bien.cookie.includes("pg_sesion="));
  comprobar("la cookie es HttpOnly", /HttpOnly/i.test(bien.cookie));
  comprobar("la cookie es Secure", /Secure/i.test(bien.cookie));
  comprobar("la cookie es SameSite=Strict", /SameSite=Strict/i.test(bien.cookie));
  cookieJuan = comoCookie(bien.cookie);

  const repetido = await leer(await auth(req("/api/auth/registro", { cuerpo: CUENTA })));
  comprobar("el mismo correo dos veces -> 409", repetido.status === 409, repetido.cuerpo.error);

  // Mismo correo con otras mayúsculas: debe seguir siendo el mismo.
  const mayusculas = await leer(await auth(req("/api/auth/registro", { cuerpo: { ...CUENTA, email: "JUAN.PABLO@POSITIVOGROUP.COM" } })));
  comprobar("mayúsculas distintas no crean otra cuenta", mayusculas.status === 409, mayusculas.cuerpo.error);
}

console.log("\n== La contraseña nunca se guarda en claro ==");
{
  const { getStore } = await import("@netlify/blobs");
  const usuarios = getStore({ name: "usuarios" });
  const { blobs } = await usuarios.list();
  const registro = await usuarios.get(blobs[0].key, { type: "json" });

  comprobar("el registro no contiene la contraseña",
    !JSON.stringify(registro).includes(CUENTA.contrasena), JSON.stringify(registro).slice(0, 80));
  comprobar("guarda una derivación y su sal",
    typeof registro.clave === "string" && registro.clave.length === 128 && typeof registro.sal === "string",
    `clave de ${registro.clave?.length} caracteres`);

  // Dos cuentas con la MISMA contraseña deben tener hashes distintos (sal por usuario).
  await auth(req("/api/auth/registro", { cuerpo: { nombre: "Otra Persona", email: "otra@positivogroup.com", contrasena: CUENTA.contrasena, codigo: CODIGO_EMPRESA } }));
  const todos = await usuarios.list();
  const registros = await Promise.all(todos.blobs.map((b) => usuarios.get(b.key, { type: "json" })));
  const claves = new Set(registros.map((r) => r.clave));
  comprobar("misma contraseña -> hashes distintos", claves.size === registros.length, `${claves.size} hashes para ${registros.length} cuentas`);
}

console.log("\n== Inicio de sesión ==");
{
  const malaClave = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: CUENTA.email, contrasena: "equivocada" } })));
  comprobar("contraseña mala -> 401", malaClave.status === 401, malaClave.cuerpo.error);

  const noExiste = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: "nadie@positivogroup.com", contrasena: "loquesea12345" } })));
  comprobar("correo inexistente -> 401", noExiste.status === 401, noExiste.cuerpo.error);
  comprobar("no revela si el correo existe o no",
    JSON.stringify(malaClave.cuerpo) === JSON.stringify(noExiste.cuerpo),
    `${JSON.stringify(malaClave.cuerpo)} vs ${JSON.stringify(noExiste.cuerpo)}`);

  const bien = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: CUENTA.email, contrasena: CUENTA.contrasena } })));
  comprobar("credenciales correctas -> 200", bien.status === 200, `status ${bien.status}`);
  comprobar("entrega cookie nueva", bien.cookie.includes("pg_sesion="));
  comprobar("el testigo es distinto al del registro", comoCookie(bien.cookie) !== cookieJuan);

  // Con mayúsculas distintas también debe entrar.
  const conMayusculas = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: "JUAN.PABLO@positivogroup.com", contrasena: CUENTA.contrasena } })));
  comprobar("el correo no distingue mayúsculas", conMayusculas.status === 200, `status ${conMayusculas.status}`);
}

console.log("\n== La API exige sesión ==");
{
  const sinCookie = await leer(await cotizaciones(req("/api/cotizaciones", { metodo: "GET" })));
  comprobar("sin sesión -> 401", sinCookie.status === 401, sinCookie.cuerpo.error);

  const inventada = await leer(await cotizaciones(req("/api/cotizaciones", { metodo: "GET", cookie: "pg_sesion=testigo-inventado" })));
  comprobar("testigo inventado -> 401", inventada.status === 401, inventada.cuerpo.error);

  const conSesion = await leer(await cotizaciones(req("/api/cotizaciones", { metodo: "GET", cookie: cookieJuan })));
  comprobar("con sesión válida -> 200", conSesion.status === 200, `status ${conSesion.status}`);

  const quien = await leer(await auth(req("/api/auth/sesion", { metodo: "GET", cookie: cookieJuan })));
  comprobar("/sesion dice quién está dentro", quien.cuerpo.usuario?.email === CUENTA.email.toLowerCase(), quien.cuerpo.usuario?.email);
}

console.log("\n== Cerrar sesión ==");
{
  const salida = await leer(await auth(req("/api/auth/salir", { cookie: cookieJuan })));
  comprobar("cierra -> 200", salida.status === 200, `status ${salida.status}`);
  comprobar("borra la cookie", /Max-Age=0/.test(salida.cookie), salida.cookie);

  const despues = await leer(await cotizaciones(req("/api/cotizaciones", { metodo: "GET", cookie: cookieJuan })));
  comprobar("el testigo ya no sirve", despues.status === 401, despues.cuerpo.error);
}

console.log("\n== El testigo no se guarda en claro ==");
{
  const { getStore } = await import("@netlify/blobs");
  const nueva = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: CUENTA.email, contrasena: CUENTA.contrasena } })));
  const testigo = decodeURIComponent(comoCookie(nueva.cookie).split("=").slice(1).join("="));

  const sesiones = getStore({ name: "sesiones" });
  const { blobs } = await sesiones.list();
  comprobar("ninguna clave de sesión es el testigo", !blobs.some((b) => b.key === testigo), `${blobs.length} sesión(es)`);
  comprobar("las claves son huellas de 64 hex", blobs.every((b) => /^[0-9a-f]{64}$/.test(b.key)), blobs[0]?.key.slice(0, 20));
}

console.log(fallos === 0 ? "\nTODO OK\n" : `\n${fallos} FALLA(S)\n`);
process.exit(fallos === 0 ? 0 : 1);
