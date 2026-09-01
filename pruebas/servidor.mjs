// Levanta el servidor propio de verdad —el mismo archivo que correrá en
// Hostinger— contra SQLite, y lo ejercita por HTTP. Comprueba que las
// funciones del backend siguen respondiendo igual fuera de Netlify.

import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let fallos = 0;
function comprobar(nombre, condicion, detalle = "") {
  console.log(`${condicion ? "  ok  " : " FALLA"} ${nombre}${detalle ? ` -> ${detalle}` : ""}`);
  if (!condicion) fallos++;
}

// Un dist/ mínimo para comprobar el servido de archivos y el respaldo de la SPA.
const dist = mkdtempSync(join(tmpdir(), "dist-"));
mkdirSync(join(dist, "assets"));
writeFileSync(join(dist, "index.html"), "<!doctype html><title>App</title>");
writeFileSync(join(dist, "assets", "app-abc123.js"), "console.log(1)");
// Un archivo con tilde en el nombre, como el logo de la cotización: el
// navegador lo pide con %XX y el servidor tiene que deshacerlo.
writeFileSync(join(dist, "Logo-Cotización.png"), "png-de-mentira");

const PUERTO = 3311;
const proceso = spawn(
  process.execPath,
  ["--experimental-sqlite", "--import", "./pruebas/registrar-sqlite.mjs", "servidor/index.mts"],
  {
    env: {
      ...process.env,
      PORT: String(PUERTO),
      DIST_DIR: dist,
      APP_ACCESS_CODE: "codigo-de-prueba",
      PRUEBA_ALMACEN: "sqlite",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let salida = "";
proceso.stdout.on("data", (d) => { salida += d; });
proceso.stderr.on("data", (d) => { salida += d; });

const BASE = `http://127.0.0.1:${PUERTO}`;

// Espera a que abra el puerto.
for (let i = 0; i < 60; i++) {
  try {
    await fetch(`${BASE}/`);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 250));
  }
}

let cookie = "";
async function pedir(ruta, { metodo = "GET", cuerpo, conCookie = true } = {}) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      ...(conCookie && cookie ? { cookie } : {}),
      ...(cuerpo ? { "content-type": "application/json" } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    redirect: "manual",
  });
  const texto = await respuesta.text();
  let datos = null;
  try { datos = JSON.parse(texto); } catch { /* HTML */ }
  return { status: respuesta.status, datos, texto, respuesta };
}

console.log("\n== El servidor arranca ==");
{
  comprobar("responde en el puerto", salida.includes("escuchando"), salida.split("\n")[0]);
}

console.log("\n== Sirve el frontend ==");
{
  const raiz = await pedir("/");
  comprobar("la raíz devuelve el index", raiz.texto.includes("<title>App</title>"), `status ${raiz.status}`);

  const asset = await pedir("/assets/app-abc123.js");
  comprobar("sirve los assets", asset.texto.includes("console.log"), `status ${asset.status}`);
  comprobar("los assets se cachean",
    /immutable/.test(asset.respuesta.headers.get("cache-control") ?? ""),
    asset.respuesta.headers.get("cache-control"));

  const html = await pedir("/");
  comprobar("el index NO se cachea",
    /must-revalidate/.test(html.respuesta.headers.get("cache-control") ?? ""),
    html.respuesta.headers.get("cache-control"));

  const enlace = await pedir("/c/loquesea");
  comprobar("una ruta de la app cae en el index", enlace.texto.includes("<title>App</title>"));

  const fuga = await pedir("/../../etc/passwd");
  comprobar("no deja salir de dist/", !fuga.texto.includes("root:"), `status ${fuga.status}`);
}

console.log("\n== La API responde ==");
{
  const sinSesion = await pedir("/api/cotizaciones");
  comprobar("sin sesión -> 401", sinSesion.status === 401, sinSesion.datos?.error);

  const registro = await pedir("/api/auth/registro", {
    metodo: "POST",
    cuerpo: { nombre: "Prueba Servidor", email: "prueba@positivogroup.com", contrasena: "claveLarga2026", codigo: "codigo-de-prueba" },
  });
  comprobar("registro -> 200", registro.status === 200, `status ${registro.status} ${JSON.stringify(registro.datos)}`);
  comprobar("es admin por ser la primera cuenta", registro.datos?.usuario?.admin === true);

  const setCookie = registro.respuesta.headers.getSetCookie();
  comprobar("entrega una sola cookie de sesión", setCookie.length === 1, `${setCookie.length}`);
  comprobar("la cookie conserva HttpOnly y SameSite",
    /HttpOnly/i.test(setCookie[0]) && /SameSite=Strict/i.test(setCookie[0]), setCookie[0]);
  cookie = setCookie[0].split(";")[0];

  const sesion = await pedir("/api/auth/sesion");
  comprobar("la sesión funciona por HTTP", sesion.datos?.usuario?.email === "prueba@positivogroup.com", sesion.datos?.usuario?.email);
}

console.log("\n== Cotizaciones, catálogo y numeración ==");
{
  const catalogo = await pedir("/api/productos");
  comprobar("siembra los 21 servicios", catalogo.datos?.productos?.length === 21, `${catalogo.datos?.productos?.length}`);

  const numero = await pedir("/api/numero", { metodo: "POST" });
  comprobar("aparta un número", /^PG \d{4}\/\d{2}$/.test(numero.datos?.numero ?? ""), numero.datos?.numero);

  const guardar = await pedir("/api/cotizaciones", {
    metodo: "POST",
    cuerpo: {
      guardadoEn: new Date().toISOString(),
      data: {
        numeroFactura: numero.datos.numero, fecha: "2026-08-21", validaHasta: "", formaPago: "Contado",
        ivaPorcentaje: 19, observaciones: "", items: [],
        cliente: { razonSocial: "Cliente de prueba", nit: "1", email: "a@b.co", contacto: "Ana" },
      },
    },
  });
  comprobar("guarda una cotización", guardar.status === 200, `status ${guardar.status}`);

  const lista = await pedir("/api/cotizaciones");
  comprobar("la lista la trae", lista.datos?.cotizaciones?.length === 1, `${lista.datos?.cotizaciones?.length}`);

  const enlace = await pedir("/api/cotizaciones/enlace", { metodo: "POST", cuerpo: { numeroFactura: numero.datos.numero } });
  comprobar("crea el enlace público", /^[A-Za-z0-9_-]{43}$/.test(enlace.datos?.testigo ?? ""), enlace.datos?.testigo?.length);

  const publico = await pedir(`/api/publico/${enlace.datos.testigo}`, { conCookie: false });
  comprobar("el enlace se ve sin sesión", publico.datos?.cotizacion?.data?.numeroFactura === numero.datos.numero);
}

console.log("\n== Numeración con varias personas a la vez, por HTTP ==");
{
  const respuestas = await Promise.all(
    Array.from({ length: 20 }, () => pedir("/api/numero", { metodo: "POST" })),
  );
  const numeros = respuestas.map((r) => r.datos?.numero);
  const unicos = new Set(numeros);
  comprobar("20 peticiones simultáneas -> 20 números distintos", unicos.size === 20,
    unicos.size === 20 ? "sin repetidos" : `REPETIDOS: ${20 - unicos.size}`);
  comprobar("ninguna falló", respuestas.every((r) => r.status === 200));
}

console.log("\n== Archivos con tilde en el nombre ==");
{
  const codificado = await fetch(`${BASE}/Logo-Cotizaci%C3%B3n.png`);
  comprobar("sirve el archivo pedido con %XX", codificado.status === 200,
    `status ${codificado.status}`);
  comprobar("y es el archivo correcto",
    (await codificado.text()) === "png-de-mentira");

  // El saneado del camino tiene que seguir en pie con la descodificación.
  const escape = await fetch(`${BASE}/..%2f..%2fetc%2fpasswd`);
  comprobar("no deja salir de dist/ con %2f", escape.status !== 200 ||
    !(await escape.text()).includes("root:"), `status ${escape.status}`);
}

console.log("\n== Exportar ==");
{
  const respaldo = await pedir("/api/admin/exportar");
  comprobar("el admin exporta", respaldo.status === 200 && respaldo.datos?.almacenes, `status ${respaldo.status}`);
  comprobar("trae las cotizaciones", Object.keys(respaldo.datos.almacenes.cotizaciones).length === 1);
}

proceso.kill();
console.log(fallos === 0 ? "\nTODO OK\n" : `\n${fallos} FALLA(S)\n`);
if (fallos > 0) console.log("Salida del servidor:\n" + salida.slice(-2000));
process.exit(fallos === 0 ? 0 : 1);
