import { register } from "node:module";
register("./loader.mjs", import.meta.url);

const CODIGO_EMPRESA = "codigo-de-la-empresa-para-pruebas";
process.env.APP_ACCESS_CODE = CODIGO_EMPRESA;

const { default: auth } = await import("../netlify/functions/auth.mts");
const { default: cotizaciones } = await import("../netlify/functions/cotizaciones.mts");
const { default: admin } = await import("../netlify/functions/admin.mts");

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

console.log("\n== Administración ==");
{
  // Juan fue el primero en registrarse: es el administrador.
  const entrarJuan = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: CUENTA.email, contrasena: CUENTA.contrasena } })));
  const cookieAdmin = comoCookie(entrarJuan.cookie);
  comprobar("el primero en registrarse es admin", entrarJuan.cuerpo.usuario?.admin === true, `admin=${entrarJuan.cuerpo.usuario?.admin}`);

  // "Otra Persona" se registró después: NO es admin.
  const entrarOtra = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: "otra@positivogroup.com", contrasena: CUENTA.contrasena } })));
  const cookieOtra = comoCookie(entrarOtra.cookie);
  comprobar("los demás NO son admin", entrarOtra.cuerpo.usuario?.admin === false, `admin=${entrarOtra.cuerpo.usuario?.admin}`);

  // Un usuario normal no puede tocar la administración.
  const prohibido = await leer(await admin(req("/api/admin/usuarios", { metodo: "GET", cookie: cookieOtra })));
  comprobar("un usuario normal -> 403", prohibido.status === 403, prohibido.cuerpo.error);

  const sinSesion = await leer(await admin(req("/api/admin/usuarios", { metodo: "GET" })));
  comprobar("sin sesión -> 401", sinSesion.status === 401, sinSesion.cuerpo.error);

  const lista = await leer(await admin(req("/api/admin/usuarios", { metodo: "GET", cookie: cookieAdmin })));
  comprobar("el admin ve las cuentas", lista.cuerpo.usuarios?.length === 2, `${lista.cuerpo.usuarios?.length} cuentas`);
  comprobar("la lista NO trae hashes ni sales",
    !JSON.stringify(lista.cuerpo).match(/"clave"|"sal"/), JSON.stringify(lista.cuerpo).slice(0, 120));

  // Restablecer la contraseña de otra persona.
  const NUEVA = "contrasenaTemporal99";
  const reset = await leer(await admin(req("/api/admin/restablecer", { cookie: cookieAdmin, cuerpo: { email: "otra@positivogroup.com", contrasena: NUEVA } })));
  comprobar("el admin restablece -> 200", reset.status === 200, `status ${reset.status}`);

  const conNueva = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: "otra@positivogroup.com", contrasena: NUEVA } })));
  comprobar("entra con la contraseña nueva", conNueva.status === 200, `status ${conNueva.status}`);

  const conVieja = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: "otra@positivogroup.com", contrasena: CUENTA.contrasena } })));
  comprobar("la contraseña vieja ya no sirve", conVieja.status === 401, conVieja.cuerpo.error);

  // Lo importante: restablecer corta las sesiones que estaban abiertas.
  const sesionVieja = await leer(await cotizaciones(req("/api/cotizaciones", { metodo: "GET", cookie: cookieOtra })));
  comprobar("restablecer cierra sus sesiones abiertas", sesionVieja.status === 401, sesionVieja.cuerpo.error);

  const corta = await leer(await admin(req("/api/admin/restablecer", { cookie: cookieAdmin, cuerpo: { email: "otra@positivogroup.com", contrasena: "abc" } })));
  comprobar("contraseña temporal corta -> 400", corta.status === 400, corta.cuerpo.error);

  const noExiste = await leer(await admin(req("/api/admin/restablecer", { cookie: cookieAdmin, cuerpo: { email: "nadie@positivogroup.com", contrasena: NUEVA } })));
  comprobar("restablecer a quien no existe -> 404", noExiste.status === 404, noExiste.cuerpo.error);

  // El admin no puede eliminarse a sí mismo.
  const suicidio = await leer(await admin(req(`/api/admin/usuarios/${encodeURIComponent(CUENTA.email)}`, { metodo: "DELETE", cookie: cookieAdmin })));
  comprobar("el admin no puede eliminarse", suicidio.status === 400, suicidio.cuerpo.error);

  // Quitarle el acceso a alguien.
  const cookieOtraNueva = comoCookie(conNueva.cookie);
  const quitado = await leer(await admin(req(`/api/admin/usuarios/${encodeURIComponent("otra@positivogroup.com")}`, { metodo: "DELETE", cookie: cookieAdmin })));
  comprobar("quita el acceso -> 200", quitado.status === 200, `status ${quitado.status}`);

  const yaNo = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: "otra@positivogroup.com", contrasena: NUEVA } })));
  comprobar("la cuenta eliminada no puede entrar", yaNo.status === 401, yaNo.cuerpo.error);

  const sesionCortada = await leer(await cotizaciones(req("/api/cotizaciones", { metodo: "GET", cookie: cookieOtraNueva })));
  comprobar("eliminar cierra su sesión abierta", sesionCortada.status === 401, sesionCortada.cuerpo.error);
}

console.log("\n== Cuenta creada antes de que existiera la marca de admin ==");
{
  const { getStore } = await import("@netlify/blobs");
  const usuarios = getStore({ name: "usuarios" });
  const contadores = getStore({ name: "contadores" });

  // Se reproduce el estado real: la cuenta existe sin el campo admin, y la
  // marca de "primer usuario" nunca se escribió porque en ese momento no
  // existía esa función.
  const clave = Buffer.from(CUENTA.email.toLowerCase(), "utf8").toString("base64url");
  const cuenta = await usuarios.get(clave, { type: "json" });
  delete cuenta.admin;
  await usuarios.setJSON(clave, cuenta);
  await contadores.delete("primer_usuario_registrado");

  const antes = await usuarios.get(clave, { type: "json" });
  comprobar("la cuenta quedó sin marca de admin", antes.admin === undefined, `admin=${antes.admin}`);

  // Al consultar la sesión, el sistema debe repararlo solo.
  const entrada = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: CUENTA.email, contrasena: CUENTA.contrasena } })));
  const cookie = comoCookie(entrada.cookie);
  comprobar("antes de reparar, entrar no la reporta admin", entrada.cuerpo.usuario?.admin === false, `admin=${entrada.cuerpo.usuario?.admin}`);

  const sesion = await leer(await auth(req("/api/auth/sesion", { metodo: "GET", cookie })));
  comprobar("consultar la sesión la repara", sesion.cuerpo.usuario?.admin === true, `admin=${sesion.cuerpo.usuario?.admin}`);

  const guardada = await usuarios.get(clave, { type: "json" });
  comprobar("la reparación queda guardada", guardada.admin === true);

  const puedeAdministrar = await leer(await admin(req("/api/admin/usuarios", { metodo: "GET", cookie })));
  comprobar("y ya puede administrar -> 200", puedeAdministrar.status === 200, `status ${puedeAdministrar.status}`);

  // No debe promover a nadie más en las siguientes consultas.
  const otraCuenta = await usuarios.list();
  const todas = await Promise.all(otraCuenta.blobs.map((b) => usuarios.get(b.key, { type: "json" })));
  const admins = todas.filter((u) => u.admin === true);
  comprobar("solo hay un administrador", admins.length === 1, `${admins.length} de ${todas.length} cuentas`);

  await auth(req("/api/auth/sesion", { metodo: "GET", cookie }));
  const trasSegunda = await Promise.all(
    (await usuarios.list()).blobs.map((b) => usuarios.get(b.key, { type: "json" })),
  );
  comprobar("consultar de nuevo no promueve a otros",
    trasSegunda.filter((u) => u.admin === true).length === 1);
}

console.log("\n== Exportar la base de datos ==");
{
  const entrarJuan = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: CUENTA.email, contrasena: CUENTA.contrasena } })));
  const cookieAdmin = comoCookie(entrarJuan.cookie);

  const respuesta = await admin(req("/api/admin/exportar", { metodo: "GET", cookie: cookieAdmin }));
  comprobar("el admin exporta -> 200", respuesta.status === 200, `status ${respuesta.status}`);
  comprobar("llega como descarga", /attachment/.test(respuesta.headers.get("content-disposition") ?? ""),
    respuesta.headers.get("content-disposition"));

  const volcado = await respuesta.json();
  comprobar("trae todos los almacenes",
    ["cotizaciones", "productos", "contadores", "usuarios", "enlaces"].every((n) => n in volcado.almacenes),
    Object.keys(volcado.almacenes).join(", "));
  comprobar("NO exporta las sesiones", !("sesiones" in volcado.almacenes));
  comprobar("trae las cuentas con su hash, para no tener que registrarse de nuevo",
    Object.values(volcado.almacenes.usuarios).every((u) => typeof u.clave === "string" && typeof u.sal === "string"),
    `${Object.keys(volcado.almacenes.usuarios).length} cuenta(s)`);
  comprobar("lleva fecha y versión", typeof volcado.exportadoEn === "string" && volcado.version === 1);

  // Un usuario normal no puede llevarse la base de datos.
  const otra = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: "otra@positivogroup.com", contrasena: CUENTA.contrasena } })));
  if (otra.status === 200) {
    const prohibido = await leer(await admin(req("/api/admin/exportar", { metodo: "GET", cookie: comoCookie(otra.cookie) })));
    comprobar("un usuario normal no puede exportar -> 403", prohibido.status === 403, prohibido.cuerpo.error);
  }

  const sinSesion = await leer(await admin(req("/api/admin/exportar", { metodo: "GET" })));
  comprobar("sin sesión no se puede exportar -> 401", sinSesion.status === 401, sinSesion.cuerpo.error);
}

console.log("\n== Cambiar la propia contraseña ==");
{
  const entrada = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: CUENTA.email, contrasena: CUENTA.contrasena } })));
  const cookieA = comoCookie(entrada.cookie);
  // Una segunda sesión, como si hubiera quedado abierta en otro equipo.
  const otraSesion = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: CUENTA.email, contrasena: CUENTA.contrasena } })));
  const cookieB = comoCookie(otraSesion.cookie);

  const malActual = await leer(await auth(req("/api/auth/contrasena", { cookie: cookieA, cuerpo: { actual: "equivocada", nueva: "otraClaveLarga1" } })));
  comprobar("contraseña actual equivocada -> 403", malActual.status === 403, malActual.cuerpo.error);

  const nuevaCorta = await leer(await auth(req("/api/auth/contrasena", { cookie: cookieA, cuerpo: { actual: CUENTA.contrasena, nueva: "abc" } })));
  comprobar("nueva demasiado corta -> 400", nuevaCorta.status === 400, nuevaCorta.cuerpo.error);

  const sinSesion = await leer(await auth(req("/api/auth/contrasena", { cuerpo: { actual: CUENTA.contrasena, nueva: "otraClaveLarga1" } })));
  comprobar("sin sesión -> 401", sinSesion.status === 401, sinSesion.cuerpo.error);

  const CAMBIADA = "miClaveNuevaSegura7";
  const bien = await leer(await auth(req("/api/auth/contrasena", { cookie: cookieA, cuerpo: { actual: CUENTA.contrasena, nueva: CAMBIADA } })));
  comprobar("cambia bien -> 200", bien.status === 200, `status ${bien.status}`);
  comprobar("entrega sesión nueva", bien.cookie.includes("pg_sesion="));

  const conNueva = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: CUENTA.email, contrasena: CAMBIADA } })));
  comprobar("entra con la contraseña cambiada", conNueva.status === 200, `status ${conNueva.status}`);

  const laOtra = await leer(await cotizaciones(req("/api/cotizaciones", { metodo: "GET", cookie: cookieB })));
  comprobar("cierra la sesión del otro equipo", laOtra.status === 401, laOtra.cuerpo.error);

  const nueva = await leer(await cotizaciones(req("/api/cotizaciones", { metodo: "GET", cookie: comoCookie(bien.cookie) })));
  comprobar("la sesión recién abierta sí sirve", nueva.status === 200, `status ${nueva.status}`);
}

console.log(fallos === 0 ? "\nTODO OK\n" : `\n${fallos} FALLA(S)\n`);
process.exit(fallos === 0 ? 0 : 1);
