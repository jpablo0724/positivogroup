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

  comprobar("la primera cuenta queda como administradora",
    bien.cuerpo.usuario?.rol === "admin", bien.cuerpo.usuario?.rol);

  // A partir de la primera, el registro queda cerrado: las cuentas las crea un
  // administrador desde Usuarios.
  const repetido = await leer(await auth(req("/api/auth/registro", { cuerpo: CUENTA })));
  comprobar("registrarse de nuevo -> 403", repetido.status === 403, repetido.cuerpo.error);
  comprobar("y dice que el registro está cerrado",
    repetido.cuerpo.error === "registro_cerrado", repetido.cuerpo.error);

  const otro = await leer(await auth(req("/api/auth/registro", { cuerpo: { ...CUENTA, email: "colado@positivogroup.com" } })));
  comprobar("ni siquiera con otro correo", otro.status === 403, otro.cuerpo.error);
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
  await admin(req("/api/admin/usuarios", { cookie: cookieJuan, cuerpo: { nombre: "Otra", apellidos: "Persona", email: "otra@positivogroup.com", contrasena: CUENTA.contrasena, rol: "basico" } }));
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
  delete cuenta.rol;
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
  const admins = todas.filter((u) => u.rol === "admin" || u.admin === true);
  comprobar("solo hay un administrador", admins.length === 1, `${admins.length} de ${todas.length} cuentas`);

  await auth(req("/api/auth/sesion", { metodo: "GET", cookie }));
  const trasSegunda = await Promise.all(
    (await usuarios.list()).blobs.map((b) => usuarios.get(b.key, { type: "json" })),
  );
  comprobar("consultar de nuevo no promueve a otros",
    trasSegunda.filter((u) => u.rol === "admin" || u.admin === true).length === 1);
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

console.log("\n== Roles y permisos ==");
{
  const { default: productos } = await import("../netlify/functions/productos.mts");

  const entrarJuan = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: CUENTA.email, contrasena: "miClaveNuevaSegura7" } })));
  const cookieAdmin = comoCookie(entrarJuan.cookie);

  const CLAVE_BASICA = "claveDelBasico9";
  const creada = await leer(await admin(req("/api/admin/usuarios", {
    cookie: cookieAdmin,
    cuerpo: { nombre: "Ana", apellidos: "Ríos", email: "ana@positivogroup.com", contrasena: CLAVE_BASICA, rol: "basico" },
  })));
  comprobar("el admin crea una cuenta -> 201", creada.status === 201, `status ${creada.status}`);
  comprobar("nace como básica", creada.cuerpo.usuario?.rol === "basico", creada.cuerpo.usuario?.rol);
  comprobar("guarda los apellidos", creada.cuerpo.usuario?.apellidos === "Ríos", creada.cuerpo.usuario?.apellidos);
  comprobar("por defecto ve sus cotizaciones y nada más",
    JSON.stringify(creada.cuerpo.usuario?.permisos) === JSON.stringify({ cotizaciones: true, catalogo: false, usuarios: false }),
    JSON.stringify(creada.cuerpo.usuario?.permisos));

  const entrarAna = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: "ana@positivogroup.com", contrasena: CLAVE_BASICA } })));
  const cookieAna = comoCookie(entrarAna.cookie);
  comprobar("la cuenta nueva puede entrar", entrarAna.status === 200, `status ${entrarAna.status}`);

  // --- Cada quien ve sus cotizaciones ---
  const delAdmin = { data: { numeroFactura: "PG 9001/26", cliente: "Del admin" } };
  const deAna = { data: { numeroFactura: "PG 9002/26", cliente: "De Ana" } };
  await cotizaciones(req("/api/cotizaciones", { cookie: cookieAdmin, cuerpo: delAdmin }));
  await cotizaciones(req("/api/cotizaciones", { cookie: cookieAna, cuerpo: deAna }));

  const listaAna = await leer(await cotizaciones(req("/api/cotizaciones", { metodo: "GET", cookie: cookieAna })));
  const numerosAna = listaAna.cuerpo.cotizaciones.map((c) => c.data.numeroFactura);
  comprobar("la básica ve la suya", numerosAna.includes("PG 9002/26"));
  comprobar("y NO ve la del admin", !numerosAna.includes("PG 9001/26"), numerosAna.join(", "));

  const listaAdmin = await leer(await cotizaciones(req("/api/cotizaciones", { metodo: "GET", cookie: cookieAdmin })));
  const numerosAdmin = listaAdmin.cuerpo.cotizaciones.map((c) => c.data.numeroFactura);
  comprobar("el admin ve las de todos",
    numerosAdmin.includes("PG 9001/26") && numerosAdmin.includes("PG 9002/26"), numerosAdmin.join(", "));

  // --- No puede tocar las ajenas por más que sepa el número ---
  const pisar = await leer(await cotizaciones(req("/api/cotizaciones", { cookie: cookieAna, cuerpo: { data: { numeroFactura: "PG 9001/26", cliente: "Secuestrada" } } })));
  comprobar("no puede sobrescribir la de otro -> 403", pisar.status === 403, pisar.cuerpo.error);

  const borrar = await leer(await cotizaciones(req("/api/cotizaciones/PG 9001/26", { metodo: "DELETE", cookie: cookieAna })));
  comprobar("no puede borrar la de otro -> 403", borrar.status === 403, borrar.cuerpo.error);

  const enlaceAjeno = await leer(await cotizaciones(req("/api/cotizaciones/enlace", { cookie: cookieAna, cuerpo: { numeroFactura: "PG 9001/26" } })));
  comprobar("ni sacarle enlace público -> 404", enlaceAjeno.status === 404, enlaceAjeno.cuerpo.error);

  // --- El catálogo se consulta siempre, pero no se edita sin permiso ---
  const verCatalogo = await leer(await productos(req("/api/productos", { metodo: "GET", cookie: cookieAna })));
  comprobar("puede consultar el catálogo para cotizar", verCatalogo.status === 200, `status ${verCatalogo.status}`);

  const editarCatalogo = await leer(await productos(req("/api/productos", { cookie: cookieAna, cuerpo: { nombre: "Producto colado" } })));
  comprobar("pero no editarlo -> 403", editarCatalogo.status === 403, editarCatalogo.cuerpo.error);

  // --- Usuarios: ni verlos ni ascenderse ---
  const verUsuarios = await leer(await admin(req("/api/admin/usuarios", { metodo: "GET", cookie: cookieAna })));
  comprobar("no ve la lista de usuarios -> 403", verUsuarios.status === 403, verUsuarios.cuerpo.error);

  const ascenderse = await leer(await admin(req("/api/admin/usuarios/ana@positivogroup.com", { metodo: "PUT", cookie: cookieAna, cuerpo: { nombre: "Ana", rol: "admin" } })));
  comprobar("no puede ascenderse -> 403", ascenderse.status === 403, ascenderse.cuerpo.error);

  // --- El permiso de ver usuarios no da permiso de cambiarlos ---
  await admin(req("/api/admin/usuarios/ana@positivogroup.com", {
    metodo: "PUT", cookie: cookieAdmin,
    cuerpo: { nombre: "Ana", apellidos: "Ríos", rol: "basico", permisos: { cotizaciones: true, catalogo: false, usuarios: true } },
  }));
  const ahoraVe = await leer(await admin(req("/api/admin/usuarios", { metodo: "GET", cookie: cookieAna })));
  comprobar("con el permiso puesto sí ve la lista -> 200", ahoraVe.status === 200, `status ${ahoraVe.status}`);

  const siguesinPoder = await leer(await admin(req("/api/admin/usuarios/ana@positivogroup.com", { metodo: "PUT", cookie: cookieAna, cuerpo: { nombre: "Ana", rol: "admin" } })));
  comprobar("pero sigue sin poder editar -> 403", siguesinPoder.status === 403, siguesinPoder.cuerpo.error);

  // --- El admin no puede dejarse sin rol ---
  const suicidio = await leer(await admin(req(`/api/admin/usuarios/${encodeURIComponent(CUENTA.email.toLowerCase())}`, { metodo: "PUT", cookie: cookieAdmin, cuerpo: { nombre: "Juan", rol: "basico" } })));
  comprobar("el admin no puede quitarse el rol -> 400", suicidio.status === 400, suicidio.cuerpo.error);

  // --- Ascender a alguien le da acceso a todo ---
  await admin(req("/api/admin/usuarios/ana@positivogroup.com", { metodo: "PUT", cookie: cookieAdmin, cuerpo: { nombre: "Ana", rol: "admin" } }));
  const anaAdmin = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: "ana@positivogroup.com", contrasena: CLAVE_BASICA } })));
  comprobar("al ascender, lo puede todo",
    JSON.stringify(anaAdmin.cuerpo.usuario?.permisos) === JSON.stringify({ cotizaciones: true, catalogo: true, usuarios: true }),
    JSON.stringify(anaAdmin.cuerpo.usuario?.permisos));

  const todasAhora = await leer(await cotizaciones(req("/api/cotizaciones", { metodo: "GET", cookie: comoCookie(anaAdmin.cookie) })));
  comprobar("y ve las cotizaciones de todos",
    todasAhora.cuerpo.cotizaciones.some((c) => c.data.numeroFactura === "PG 9001/26"));
}

console.log("\n== Respaldo: exportar e importar ==");
{
  // Se entra como el administrador, que a esta altura tiene la contraseña ya
  // cambiada por el bloque anterior.
  const entrada = await leer(await auth(req("/api/auth/entrar", { cuerpo: { email: CUENTA.email, contrasena: "miClaveNuevaSegura7" } })));
  const cookieAdmin = comoCookie(entrada.cookie);

  const exportado = await leer(await admin(req("/api/admin/exportar", { metodo: "GET", cookie: cookieAdmin })));
  comprobar("exportar -> 200", exportado.status === 200, `status ${exportado.status}`);

  const almacenes = exportado.cuerpo.almacenes ?? {};
  comprobar("el volcado trae las cotizaciones", "cotizaciones" in almacenes);
  comprobar("el volcado trae las cuentas", "usuarios" in almacenes);
  comprobar("el volcado NO trae las sesiones", !("sesiones" in almacenes),
    Object.keys(almacenes).join(", "));

  // Importar lo que ya está no debe cambiar nada: así, repetir la carga en un
  // servidor nuevo es inofensivo.
  const repetido = await leer(await admin(req("/api/admin/importar", { cookie: cookieAdmin, cuerpo: { almacenes } })));
  comprobar("reimportar lo mismo -> 200", repetido.status === 200, `status ${repetido.status}`);
  comprobar("reimportar no escribe nada", repetido.cuerpo.escritos === 0,
    `escribió ${repetido.cuerpo.escritos}`);

  // Un registro que no existía sí entra.
  const nuevo = await leer(await admin(req("/api/admin/importar", {
    cookie: cookieAdmin,
    cuerpo: { almacenes: { productos: { prueba_respaldo: { nombre: "Traído del respaldo" } } } },
  })));
  comprobar("importa lo que falta", nuevo.cuerpo.escritos === 1, `escribió ${nuevo.cuerpo.escritos}`);

  const { getStore } = await import("@netlify/blobs");
  const traido = await getStore({ name: "productos" }).get("prueba_respaldo", { type: "json" });
  comprobar("y queda guardado", traido?.nombre === "Traído del respaldo");

  // Un archivo manipulado no puede colarse una sesión abierta.
  const intruso = await leer(await admin(req("/api/admin/importar", {
    cookie: cookieAdmin,
    cuerpo: { almacenes: { sesiones: { colada: { email: CUENTA.email, expiraEn: "2099-01-01T00:00:00.000Z" } } } },
  })));
  comprobar("ignora almacenes que no son del respaldo",
    intruso.cuerpo.escritos === 0 && intruso.cuerpo.ignorados?.includes("sesiones"),
    JSON.stringify(intruso.cuerpo));

  // Ni siquiera con --reemplazar debe pisar la cuenta de quien está importando:
  // se quedaría fuera del sistema a mitad de la restauración.
  const claveAdmin = Buffer.from(CUENTA.email.toLowerCase(), "utf8").toString("base64url");
  const suplantacion = await leer(await admin(req("/api/admin/importar", {
    cookie: cookieAdmin,
    cuerpo: {
      reemplazar: true,
      almacenes: { usuarios: { [claveAdmin]: { email: CUENTA.email, nombre: "Pisado", clave: "00", sal: "00", creadoEn: "2020-01-01T00:00:00.000Z" } } },
    },
  })));
  comprobar("no pisa la cuenta de quien importa", suplantacion.cuerpo.escritos === 0,
    `escribió ${suplantacion.cuerpo.escritos}`);

  const sigueDentro = await leer(await admin(req("/api/admin/usuarios", { metodo: "GET", cookie: cookieAdmin })));
  comprobar("y sigue pudiendo administrar", sigueDentro.status === 200, `status ${sigueDentro.status}`);

  const sinPermiso = await leer(await admin(req("/api/admin/importar", { cuerpo: { almacenes: {} } })));
  comprobar("importar sin sesión -> 401", sinPermiso.status === 401, sinPermiso.cuerpo.error);

  const basura = await leer(await admin(req("/api/admin/importar", { cookie: cookieAdmin, cuerpo: { nada: 1 } })));
  comprobar("un archivo que no es respaldo -> 400", basura.status === 400, basura.cuerpo.error);
}

console.log(fallos === 0 ? "\nTODO OK\n" : `\n${fallos} FALLA(S)\n`);
process.exit(fallos === 0 ? 0 : 1);
