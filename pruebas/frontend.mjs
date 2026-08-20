import { chromium } from "playwright";

const OUT = "/tmp/claude-0/-home-user-positivogroup/0ec10a0a-16ad-56b9-ab73-9a3244bdb3c0/scratchpad";
const CODIGO = "clave-de-prueba-local";

let fallos = 0;
function comprobar(nombre, condicion, detalle = "") {
  console.log(`${condicion ? "  ok  " : " FALLA"} ${nombre}${detalle ? ` -> ${detalle}` : ""}`);
  if (!condicion) fallos++;
}

// --- API simulada, con el mismo comportamiento que las funciones reales ---
const CATALOGO_SEMILLA = [
  { nombre: "P01 - Publicidad en Ascensores x 15 días", descripcion: "PUBLICIDAD EN ASCENSORES", observaciones: "Obs de ascensores", orden: 10 },
  { nombre: "P03 - Marketing en Buzones", descripcion: "INSERTOS EN BUZONES", observaciones: "Obs de buzones", orden: 20 },
];
const servidor = {
  cotizaciones: new Map(),
  productos: new Map(CATALOGO_SEMILLA.map((p) => [p.nombre, p])),
  ultimo: 0,
};

function armarApi(page) {
  return page.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const ruta = url.pathname;
    const codigo = req.headers()["x-codigo-acceso"];

    const responder = (cuerpo, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(cuerpo) });

    if (ruta.startsWith("/api/clientify")) return responder({ results: [] });
    if (codigo !== CODIGO) return responder({ error: "codigo_invalido" }, 401);

    const anio = String(new Date().getFullYear() % 100).padStart(2, "0");
    const formatear = (n) => `PG ${String(n).padStart(4, "0")}/${anio}`;

    if (ruta === "/api/numero") {
      if (req.method() === "POST") return responder({ numero: formatear(++servidor.ultimo) });
      return responder({ numero: formatear(servidor.ultimo + 1) });
    }

    if (ruta.startsWith("/api/cotizaciones")) {
      if (req.method() === "POST") {
        const cuerpo = JSON.parse(req.postData());
        servidor.cotizaciones.set(cuerpo.data.numeroFactura, cuerpo);
        return responder({ cotizacion: cuerpo });
      }
      if (req.method() === "DELETE") {
        servidor.cotizaciones.delete(decodeURIComponent(ruta.replace("/api/cotizaciones/", "")));
        return responder({ eliminada: true });
      }
      return responder({ cotizaciones: [...servidor.cotizaciones.values()] });
    }

    if (ruta.startsWith("/api/productos")) {
      if (req.method() === "POST") {
        const p = JSON.parse(req.postData());
        const previo = servidor.productos.get(p.nombreAnterior ?? p.nombre);
        if (p.nombreAnterior && p.nombreAnterior !== p.nombre) {
          servidor.productos.delete(p.nombreAnterior);
        }
        const orden = previo?.orden ?? (servidor.productos.size + 1) * 10;
        servidor.productos.set(p.nombre, { ...p, orden });
        return responder({ producto: p });
      }
      if (req.method() === "DELETE") {
        servidor.productos.delete(decodeURIComponent(ruta.replace("/api/productos/", "")));
        return responder({ eliminado: true });
      }
      const lista = [...servidor.productos.values()].sort((a, b) => a.orden - b.orden);
      return responder({ productos: lista });
    }

    return responder({ error: "no_encontrado" }, 404);
  });
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1700, height: 1050 } });
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
page.on("console", (m) => m.type() === "error" && errores.push(m.text()));

await armarApi(page);
await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

console.log("\n== Pantalla de acceso ==");
{
  comprobar("pide código al entrar", await page.locator('input[type="password"]').isVisible());
  comprobar("no muestra el sistema todavía", (await page.locator("text=Crear cotización").count()) === 0);

  await page.fill('input[type="password"]', "codigo-equivocado");
  await page.click('button:has-text("Entrar")');
  await page.waitForSelector("text=Código incorrecto");
  comprobar("rechaza el código equivocado", true, "muestra el aviso");

  await page.fill('input[type="password"]', CODIGO);
  await page.click('button:has-text("Entrar")');
  await page.waitForSelector("text=Crear cotización", { timeout: 5000 });
  comprobar("entra con el código correcto", true);
}
await page.screenshot({ path: `${OUT}/B1-tras-entrar.png`, fullPage: true });

console.log("\n== Numeración contra el servidor ==");
{
  const encabezado = await page.locator("header p").first().innerText();
  comprobar("muestra el número provisional", /PG 0001\/\d{2}/.test(encabezado), encabezado);
  comprobar("aclara que se aparta al guardar", /se aparta al guardar/.test(encabezado));
  comprobar("no consumió número al abrir", servidor.ultimo === 0, `ultimo=${servidor.ultimo}`);

  // Recargar tampoco debe consumir números.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("text=Crear cotización");
  comprobar("recargar no consume número", servidor.ultimo === 0, `ultimo=${servidor.ultimo}`);
  comprobar("no vuelve a pedir el código", (await page.locator('input[type="password"]').count()) === 0);
}

console.log("\n== Crear producto y guardar cotización ==");
{
  await page.click('button:has-text("Agregar producto")');
  await page.waitForSelector('[role="dialog"]');
  const dialog = page.locator('[role="dialog"]');
  await dialog.locator("input").fill("X01 - Parqueaderos residenciales");
  await dialog.locator("textarea").nth(0).fill("Carteleras en el acceso vehicular.");
  await dialog.locator("textarea").nth(1).fill("La tarifa incluye impresión.");
  await dialog.locator('button:has-text("Guardar producto")').click();
  await page.waitForTimeout(400);
  comprobar("el producto sube al servidor", servidor.productos.has("X01 - Parqueaderos residenciales"),
    `${servidor.productos.size} productos`);

  const card = page.locator("div.rounded-lg.border.border-slate-200.bg-slate-50").first();
  await card.locator('input[type="number"]').nth(0).fill("10");
  await card.locator('input[type="number"]').nth(1).fill("250000");
  await card.locator('button:has-text("Agregar producto")').click();
  await page.waitForTimeout(200);

  await page.click('button:has-text("Guardar cotización")');
  await page.waitForSelector("text=Cotización guardada", { timeout: 5000 });

  comprobar("apartó exactamente un número", servidor.ultimo === 1, `ultimo=${servidor.ultimo}`);
  comprobar("guardó en el servidor", servidor.cotizaciones.size === 1, `${[...servidor.cotizaciones.keys()]}`);

  const guardada = [...servidor.cotizaciones.values()][0];
  comprobar("guardó con el número apartado", /^PG 0001\/\d{2}$/.test(guardada.data.numeroFactura), guardada.data.numeroFactura);
  comprobar("guardó el producto", guardada.data.items.length === 1, `${guardada.data.items.length} ítem(s)`);

  const encabezado = await page.locator("header p").first().innerText();
  comprobar("el formulario queda listo para la siguiente", /PG 0002\/\d{2}/.test(encabezado), encabezado);
}
await page.screenshot({ path: `${OUT}/B2-tras-guardar.png`, fullPage: true });

console.log("\n== Listado compartido ==");
{
  // Otra persona guarda desde su equipo: aparece al recargar.
  servidor.cotizaciones.set("PG 0009/26", {
    guardadoEn: new Date().toISOString(),
    data: {
      numeroFactura: "PG 0009/26", fecha: "2026-08-20", validaHasta: "", formaPago: "Contado",
      ivaPorcentaje: 19, observaciones: "", items: [{ id: "x", nombreProducto: "P01", descripcionProducto: "", cantidad: 4, precioUnitario: 100000 }],
      cliente: { razonSocial: "Cliente de otra persona", nit: "", email: "", contacto: "" },
    },
  });

  await page.reload({ waitUntil: "networkidle" });
  await page.click("text=Listado de Cotizaciones");
  await page.waitForSelector("th:has-text('Total antes de IVA')");
  const filas = await page.locator("tbody tr").count();
  comprobar("ve las cotizaciones de todo el equipo", filas === 2, `${filas} filas`);

  // Intl separa el símbolo con espacio duro (U+00A0); se normaliza para comparar.
  const texto = (await page.locator("tbody").innerText()).replace(/ /g, " ");
  comprobar("incluye la cotización ajena", texto.includes("Cliente de otra persona"));
  comprobar(
    "muestra el valor antes de IVA, no el total",
    texto.includes("$ 400.000") && !texto.includes("$ 476.000"),
    texto.match(/\$ [\d.]+/g)?.join(" / "),
  );
}
await page.screenshot({ path: `${OUT}/B3-listado.png`, fullPage: true });

console.log("\n== Catálogo de productos ==");
{
  await page.reload({ waitUntil: "networkidle" });
  await page.click("text=Catálogo de Productos");
  await page.waitForSelector('button:has-text("+ Agregar producto")');

  const tarjetas = await page.locator("text=P01 - Publicidad en Ascensores").count();
  comprobar("muestra los servicios del catálogo", tarjetas > 0);

  // Editar un servicio de fábrica.
  const fila = page.locator("div.rounded-lg.border").filter({ hasText: "P01 - Publicidad en Ascensores" }).first();
  await fila.locator('button:has-text("Editar")').click();
  await page.waitForSelector('[role="dialog"]');
  const dlg = page.locator('[role="dialog"]');
  comprobar("el modal dice Editar producto", (await dlg.locator("h2").innerText()).includes("Editar"));

  const descActual = await dlg.locator("textarea").nth(0).inputValue();
  comprobar("precarga la descripción existente", descActual.includes("PUBLICIDAD EN ASCENSORES"), descActual.slice(0, 30));

  await dlg.locator("textarea").nth(0).fill("DESCRIPCION EDITADA DESDE EL CATALOGO");
  await dlg.locator('button:has-text("Guardar cambios")').click();
  await page.waitForTimeout(500);

  const enServidor = servidor.productos.get("P01 - Publicidad en Ascensores x 15 días");
  comprobar("la edición llega al servidor", enServidor.descripcion === "DESCRIPCION EDITADA DESDE EL CATALOGO", enServidor.descripcion.slice(0, 30));

  // El formulario de cotización debe usar ya la descripción editada.
  await page.click("text=Crear Cotización");
  await page.waitForSelector('button:has-text("Selecciona un producto")');
  await page.click('button:has-text("Selecciona un producto")');
  await page.click("text=P01 - Publicidad en Ascensores");
  await page.waitForTimeout(300);
  const desc = await page.locator("textarea").first().inputValue();
  comprobar("la cotización usa la descripción editada", desc === "DESCRIPCION EDITADA DESDE EL CATALOGO", desc.slice(0, 30));

  // Eliminar un producto.
  await page.click("text=Catálogo de Productos");
  await page.waitForSelector('button:has-text("+ Agregar producto")');
  const fila2 = page.locator("div.rounded-lg.border").filter({ hasText: "P03 - Marketing en Buzones" }).first();
  await fila2.locator('button:has-text("Eliminar")').click();
  await page.waitForSelector("text=Se va a eliminar");
  await page.click('div[role="dialog"] button:has-text("Eliminar")');
  await page.waitForTimeout(500);
  comprobar("elimina del servidor", !servidor.productos.has("P03 - Marketing en Buzones"), `${servidor.productos.size} productos`);
}
await page.screenshot({ path: `${OUT}/B6-catalogo.png`, fullPage: true });

console.log("\n== Producto sin cantidad ni precio ==");
{
  await page.evaluate((c) => localStorage.setItem("positivogroup:codigoAcceso", c), CODIGO);
  await page.reload({ waitUntil: "networkidle" });
  await page.click("text=Crear Cotización");
  await page.waitForSelector('button:has-text("Selecciona un producto")');

  // Elegir solo el producto, sin tocar cantidad ni precio.
  await page.click('button:has-text("Selecciona un producto")');
  await page.click("text=P01 - Publicidad en Ascensores");
  await page.waitForTimeout(200);

  const boton = page.locator('div.bg-slate-50 button:has-text("Agregar producto")');
  comprobar("el botón se habilita solo con el producto", await boton.isEnabled());

  await boton.click();
  await page.waitForTimeout(300);

  const tabla = await page.locator("#invoice-preview table").innerText();
  comprobar("el producto aparece en la cotización", tabla.includes("P01 - Publicidad en Ascensores"));
  comprobar("la descripción aparece debajo del nombre", tabla.includes("DESCRIPCION EDITADA") || tabla.includes("PUBLICIDAD EN ASCENSORES"), tabla.split("\n")[2]);
  comprobar("cantidad y precio salen con raya, no en cero", !tabla.includes("$ 0"), tabla.replace(/\n/g, " | ").slice(0, 160));

  // Y el total sigue en cero, sin romperse.
  const totales = await page.locator("#invoice-preview").innerText();
  comprobar("el TOTAL queda en cero", /TOTAL\s*\$\s*0/.test(totales.replace(/\u00a0/g, " ")));

  // Ahora sí ponerle precio: debe recalcular.
  await page.locator("div.rounded-lg.border").filter({ hasText: "1. P01" }).first()
    .locator('button:has-text("Editar")').click();
  await page.waitForTimeout(200);
  const card = page.locator("div.bg-slate-50").first();
  comprobar("al editar, cantidad queda vacía y no en 0", (await card.locator('input[type="number"]').nth(0).inputValue()) === "");

  await card.locator('input[type="number"]').nth(0).fill("3");
  await card.locator('input[type="number"]').nth(1).fill("500000");
  await card.locator('button:has-text("Guardar cambios")').click();
  await page.waitForTimeout(300);

  const conPrecio = (await page.locator("#invoice-preview").innerText()).replace(/\u00a0/g, " ");
  comprobar("al ponerle precio recalcula", conPrecio.includes("$ 1.500.000"), conPrecio.match(/\$ [\d.]+/g)?.join(" / "));
}
await page.screenshot({ path: `${OUT}/B7-sin-precio.png`, fullPage: true });

console.log("\n== El código deja de servir ==");
{
  await page.evaluate(() => localStorage.setItem("positivogroup:codigoAcceso", "ya-no-sirve"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('input[type="password"]', { timeout: 5000 });
  comprobar("vuelve a pedir el código", true);
  const aviso = await page.locator("text=dejó de ser válido").count();
  comprobar("explica por qué", aviso > 0);
}
await page.screenshot({ path: `${OUT}/B4-codigo-invalido.png`, fullPage: true });

console.log("\n== Migración de datos del navegador ==");
{
  await page.evaluate((codigo) => {
    localStorage.setItem("positivogroup:codigoAcceso", codigo);
    localStorage.removeItem("positivogroup:migradoAlServidor");
    localStorage.setItem("positivogroup:cotizacionesGuardadas", JSON.stringify([
      { guardadoEn: "2026-08-01T10:00:00.000Z", data: { numeroFactura: "PG 0100/26", fecha: "2026-08-01", validaHasta: "", formaPago: "Contado", ivaPorcentaje: 19, observaciones: "vieja", items: [], cliente: { razonSocial: "Cliente antiguo", nit: "", email: "", contacto: "" } } },
    ]));
    localStorage.setItem("positivogroup:productosPersonalizados", JSON.stringify([
      { nombre: "Z99 - Producto viejo", descripcion: "d", observaciones: "o" },
    ]));
  }, CODIGO);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("text=Subir al servidor", { timeout: 5000 });
  comprobar("ofrece subir lo guardado en el navegador", true);

  await page.click('button:has-text("Subir al servidor")');
  await page.waitForTimeout(800);
  comprobar("subió la cotización vieja", servidor.cotizaciones.has("PG 0100/26"), `${[...servidor.cotizaciones.keys()]}`);
  comprobar("subió el producto viejo", servidor.productos.has("Z99 - Producto viejo"));
  comprobar("el aviso desaparece", (await page.locator("text=Subir al servidor").count()) === 0);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("text=Crear cotización");
  comprobar("no vuelve a ofrecerlo tras subir", (await page.locator("text=Subir al servidor").count()) === 0);
}
await page.screenshot({ path: `${OUT}/B5-migrado.png`, fullPage: true });

console.log("\nERRORES DE CONSOLA:", JSON.stringify(errores.filter((e) => !e.includes("ERR_CONNECTION"))));
console.log(fallos === 0 ? "\nTODO OK\n" : `\n${fallos} FALLA(S)\n`);
await browser.close();
process.exit(fallos === 0 ? 0 : 1);
