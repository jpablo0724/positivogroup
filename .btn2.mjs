import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await nav.newPage({ viewport: { width: 1500, height: 950 } });
const cuenta = { email: "j@p.co", nombre: "Juan", apellidos: "M", rol: "admin", admin: true,
  permisos: { cotizaciones: true, catalogo: true, usuarios: true } };
await page.route("**/api/**", (r) => {
  const u = new URL(r.request().url()).pathname;
  const j = (b) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  if (u.endsWith("/sesion")) return j({ usuario: cuenta });
  if (u === "/api/numero") return j({ numero: "PG 0011/26" });
  if (u.startsWith("/api/productos")) return j({ productos: [] });
  if (u.startsWith("/api/admin/usuarios")) return j({ usuarios: [cuenta] });
  return j({ cotizaciones: [] });
});
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.click('button:has-text("Usuarios")');
await page.waitForSelector('button:has-text("Crear usuario")');
console.log("Crear usuario:", await page.locator('button:has-text("Crear usuario")')
  .evaluate((b) => getComputedStyle(b).backgroundImage));
await page.click("text=Crear Cotización");
await page.waitForSelector('button:has-text("+ Agregar producto")');
console.log("enlace + Agregar producto:", await page.locator('button:has-text("+ Agregar producto")').first()
  .evaluate((b) => getComputedStyle(b).color));
await nav.close();
