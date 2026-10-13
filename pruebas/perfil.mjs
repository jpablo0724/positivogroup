// Cambio de nombre y de correo desde el perfil, contra el servidor real sobre
// SQLite. Lo importante: al cambiar el correo, la persona sigue con la sesión
// abierta, sigue viendo sus cotizaciones, firma con el correo nuevo (también
// en el enlace público) y entra con el nuevo, no con el viejo.

import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let fallos = 0;
function comprobar(nombre, condicion, detalle = "") {
  console.log(`${condicion ? "  ok  " : " FALLA"} ${nombre}${detalle ? ` -> ${detalle}` : ""}`);
  if (!condicion) fallos++;
}

const dist = mkdtempSync(join(tmpdir(), "dist-"));
writeFileSync(join(dist, "index.html"), "<!doctype html><title>App</title>");

const PUERTO = 3312;
const proceso = spawn(process.execPath, ["--experimental-sqlite", "servidor/index.mts"], {
  env: { ...process.env, PORT: String(PUERTO), DIST_DIR: dist, APP_ACCESS_CODE: "codigo", CLIENTIFY_API_TOKEN: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
let salida = "";
proceso.stdout.on("data", (d) => { salida += d; });
proceso.stderr.on("data", (d) => { salida += d; });

const BASE = `http://127.0.0.1:${PUERTO}`;
for (let i = 0; i < 60; i++) {
  try { await fetch(`${BASE}/`); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
}

async function pedir(ruta, { metodo = "GET", cuerpo, cookie = "" } = {}) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(cuerpo ? { "content-type": "application/json" } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await respuesta.text();
  let datos = null;
  try { datos = JSON.parse(texto); } catch { /* no es JSON */ }
  return { status: respuesta.status, datos, respuesta };
}

const CLAVE = "claveLarga2026";
const VIEJO = "ana@positivogroup.com";
const NUEVO = "ana.perez@positivogroup.com";

try {
  // La primera cuenta (admin) y una segunda, para probar el correo ocupado.
  const registro = await pedir("/api/auth/registro", {
    metodo: "POST",
    cuerpo: { nombre: "Ana", email: VIEJO, contrasena: CLAVE, codigo: "codigo" },
  });
  const cookie = registro.respuesta.headers.getSetCookie()[0].split(";")[0];
  const otra = await pedir("/api/admin/usuarios", {
    metodo: "POST", cookie,
    cuerpo: { nombre: "Otro", email: "otro@positivogroup.com", contrasena: CLAVE, rol: "basico", telefono: "1", cargo: "X" },
  });
  comprobar("se crea una segunda cuenta", otra.status === 201, `${otra.status} ${JSON.stringify(otra.datos)}`);

  const numero = await pedir("/api/numero", { metodo: "POST", cookie });
  await pedir("/api/cotizaciones", {
    metodo: "POST", cookie,
    cuerpo: {
      guardadoEn: new Date().toISOString(),
      data: {
        numeroFactura: numero.datos.numero, fecha: "2026-10-12", validaHasta: "", formaPago: "Contado",
        ivaPorcentaje: 19, observaciones: "", items: [],
        cliente: { razonSocial: "Cliente", nit: "1", email: "a@b.co", contacto: "X" },
      },
    },
  });
  const enlace = await pedir("/api/cotizaciones/enlace", {
    metodo: "POST", cookie, cuerpo: { numeroFactura: numero.datos.numero },
  });
  const testigoPublico = enlace.datos?.token ?? enlace.datos?.testigo ?? "";

  console.log("\n== Cambiar el nombre ==");
  {
    const r = await pedir("/api/auth/perfil", {
      metodo: "POST", cookie,
      cuerpo: { nombre: "Ana María", apellidos: "Pérez", email: VIEJO, telefono: "300", cargo: "Comercial" },
    });
    comprobar("guarda nombre y apellidos", r.status === 200 && r.datos.usuario.apellidos === "Pérez", JSON.stringify(r.datos));
    const equipo = await pedir("/api/cotizaciones/equipo", { cookie });
    const yo = equipo.datos.equipo.find((m) => m.email === VIEJO);
    comprobar("el equipo (firma de la cotización) trae el nombre nuevo", yo?.nombre === "Ana María" && yo?.apellidos === "Pérez");
  }

  console.log("\n== Cambiar el correo ==");
  {
    const sinClave = await pedir("/api/auth/perfil", {
      metodo: "POST", cookie, cuerpo: { nombre: "Ana María", email: NUEVO, contrasena: "mala-clave" },
    });
    comprobar("sin la contraseña correcta no lo cambia", sinClave.status === 403, `${sinClave.status}`);

    const ocupado = await pedir("/api/auth/perfil", {
      metodo: "POST", cookie, cuerpo: { nombre: "Ana María", email: "otro@positivogroup.com", contrasena: CLAVE },
    });
    comprobar("no deja tomar el correo de otra cuenta", ocupado.status === 409, `${ocupado.status}`);

    const r = await pedir("/api/auth/perfil", {
      metodo: "POST", cookie,
      cuerpo: { nombre: "Ana María", apellidos: "Pérez", email: " Ana.Perez@PositivoGroup.com ", telefono: "300", cargo: "Comercial", contrasena: CLAVE },
    });
    comprobar("lo cambia (normalizado)", r.status === 200 && r.datos.usuario.email === NUEVO, JSON.stringify(r.datos));
    comprobar("conserva el rol de administradora", r.datos?.usuario?.admin === true);

    const sesion = await pedir("/api/auth/sesion", { cookie });
    comprobar("la sesión sigue abierta con el correo nuevo", sesion.datos?.usuario?.email === NUEVO, sesion.datos?.usuario?.email);

    const lista = await pedir("/api/cotizaciones", { cookie });
    const cot = lista.datos?.cotizaciones?.[0];
    comprobar("la cotización ahora es del correo nuevo", cot?.creadoPor === NUEVO, cot?.creadoPor);
    comprobar("el historial también", cot?.historial?.every((h) => h.quien === NUEVO), JSON.stringify(cot?.historial));

    const equipo = await pedir("/api/cotizaciones/equipo", { cookie });
    const correos = equipo.datos.equipo.map((m) => m.email);
    comprobar("el equipo tiene el correo nuevo y no el viejo", correos.includes(NUEVO) && !correos.includes(VIEJO), correos.join(","));

    if (testigoPublico) {
      const publica = await pedir(`/api/publico/${testigoPublico}`);
      comprobar("el enlace público firma con el correo nuevo",
        JSON.stringify(publica.datos).includes(NUEVO) && JSON.stringify(publica.datos).includes("Ana María"),
        `status ${publica.status}`);
    } else {
      comprobar("se obtuvo el enlace público", false, JSON.stringify(enlace.datos));
    }

    const conViejo = await pedir("/api/auth/entrar", { metodo: "POST", cuerpo: { email: VIEJO, contrasena: CLAVE } });
    comprobar("ya no se entra con el correo viejo", conViejo.status === 401, `${conViejo.status}`);
    const conNuevo = await pedir("/api/auth/entrar", { metodo: "POST", cuerpo: { email: NUEVO, contrasena: CLAVE } });
    comprobar("se entra con el correo nuevo y la misma contraseña", conNuevo.status === 200, `${conNuevo.status}`);
  }
} catch (err) {
  console.error(err);
  console.error(salida);
  fallos++;
} finally {
  proceso.kill();
}

console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLA(S)`);
process.exit(fallos === 0 ? 0 : 1);
