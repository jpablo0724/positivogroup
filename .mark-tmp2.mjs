import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-positivogroup/0ec10a0a-16ad-56b9-ab73-9a3244bdb3c0/scratchpad";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await nav.newPage({ viewport: { width: 1300, height: 500 } });
const cuenta = { email: "j@p.co", nombre: "Juan", apellidos: "M", rol: "admin", admin: true,
  permisos: { cotizaciones: true, catalogo: true, usuarios: true } };
await page.route("**/api/**", (r) => {
  const u = new URL(r.request().url()).pathname;
  const j = (b) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
  if (u.endsWith("/sesion")) return j({ usuario: cuenta });
  if (u === "/api/numero") return j({ numero: "PG 0013/26" });
  if (u.startsWith("/api/productos")) return j({ productos: [] });
  return j({ cotizaciones: [] });
});
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector("#invoice-preview");
await page.fill('input[placeholder="Escribe para buscar en"]', "Positivo group");
await page.fill('input[placeholder="Marca del cliente"]', "Aromas del Valle");
await page.waitForTimeout(400);
await page.locator("#invoice-preview").screenshot({ path: `${OUT}/M1-marca-reubicada.png` });
await nav.close();
