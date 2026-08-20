import { register } from "node:module";
register("./loader.mjs", import.meta.url);

const CODIGO = "clave-de-prueba-local";
process.env.APP_ACCESS_CODE = CODIGO;

const { default: cotizaciones } = await import("../netlify/functions/cotizaciones.mts");
const { default: productos } = await import("../netlify/functions/productos.mts");
const { default: numero } = await import("../netlify/functions/numero.mts");
const { default: auth } = await import("../netlify/functions/auth.mts");

const BASE = "https://cotizador-positivo.netlify.app";

// Se registra una cuenta y se reutiliza su sesión para todas las pruebas: la
// API ya no acepta un código suelto, exige sesión abierta.
const registro = await auth(
  new Request(`${BASE}/api/auth/registro`, {
    method: "POST",
    body: JSON.stringify({
      nombre: "Prueba",
      email: "prueba@positivogroup.com",
      contrasena: "claveDePrueba2026",
      codigo: CODIGO,
    }),
  }),
);
const COOKIE = (registro.headers.get("set-cookie") ?? "").split(";")[0];

function req(ruta, { metodo = "GET", cuerpo, cookie = COOKIE } = {}) {
  return new Request(`${BASE}${ruta}`, {
    method: metodo,
    headers: cookie === null ? {} : { cookie },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

async function leer(respuesta) {
  return { status: respuesta.status, cuerpo: await respuesta.json() };
}

let fallos = 0;
function comprobar(nombre, condicion, detalle = "") {
  console.log(`${condicion ? "  ok  " : " FALLA"} ${nombre}${detalle ? ` -> ${detalle}` : ""}`);
  if (!condicion) fallos++;
}

function cotizacionDe(numeroFactura, razonSocial, items = []) {
  return {
    guardadoEn: new Date().toISOString(),
    data: {
      numeroFactura,
      fecha: "2026-08-20",
      validaHasta: "",
      formaPago: "Contado",
      ivaPorcentaje: 19,
      observaciones: "<div>Prueba</div>",
      cliente: { razonSocial, nit: "900123-1", email: "a@b.co", contacto: "Ana" },
      items,
    },
  };
}

console.log("\n== La API exige sesión ==");
{
  const sinSesion = await leer(await cotizaciones(req("/api/cotizaciones", { cookie: null })));
  comprobar("sin sesión -> 401", sinSesion.status === 401, sinSesion.cuerpo.error);

  const inventada = await leer(await cotizaciones(req("/api/cotizaciones", { cookie: "pg_sesion=inventado" })));
  comprobar("testigo inventado -> 401", inventada.status === 401, inventada.cuerpo.error);

  const bien = await leer(await cotizaciones(req("/api/cotizaciones")));
  comprobar("con sesión -> 200", bien.status === 200, `status ${bien.status}`);
}

console.log("\n== Cotizaciones ==");
{
  await cotizaciones(req("/api/cotizaciones", { metodo: "POST", cuerpo: cotizacionDe("PG 0001/26", "Redcol Holding S.A.S") }));
  await cotizaciones(req("/api/cotizaciones", { metodo: "POST", cuerpo: cotizacionDe("PG 0002/26", "Ombu Renovaciones") }));

  const lista = await leer(await cotizaciones(req("/api/cotizaciones")));
  comprobar("guarda y lista 2", lista.cuerpo.cotizaciones.length === 2, `${lista.cuerpo.cotizaciones.length}`);

  const invalida = await leer(await cotizaciones(req("/api/cotizaciones", { metodo: "POST", cuerpo: { hola: 1 } })));
  comprobar("cotización sin número -> 400", invalida.status === 400, invalida.cuerpo.error);

  // El número lleva espacio y barra: debe sobrevivir la codificación de la URL.
  const borrada = await leer(await cotizaciones(req(`/api/cotizaciones/${encodeURIComponent("PG 0001/26")}`, { metodo: "DELETE" })));
  comprobar("elimina por número con espacio y barra", borrada.status === 200, borrada.cuerpo.eliminada);

  const tras = await leer(await cotizaciones(req("/api/cotizaciones")));
  comprobar("queda 1 tras eliminar", tras.cuerpo.cotizaciones.length === 1, `${tras.cuerpo.cotizaciones.length}`);
  comprobar("la que queda es la correcta", tras.cuerpo.cotizaciones[0].data.numeroFactura === "PG 0002/26");
}

console.log("\n== Catálogo en la base de datos ==");
{
  // La primera consulta siembra el catálogo de servicios.
  const inicial = await leer(await productos(req("/api/productos")));
  comprobar("siembra los 21 servicios", inicial.cuerpo.productos.length === 21, `${inicial.cuerpo.productos.length}`);
  comprobar("respeta el orden del catálogo (P01 primero)", inicial.cuerpo.productos[0].nombre.startsWith("P01"), inicial.cuerpo.productos[0].nombre.slice(0, 20));
  comprobar("P08 va después de P10, como en el original",
    inicial.cuerpo.productos.findIndex((p) => p.nombre.startsWith("P08")) >
    inicial.cuerpo.productos.findIndex((p) => p.nombre.startsWith("P10")));
  comprobar("trae descripción y observaciones", inicial.cuerpo.productos[0].descripcion.includes("ASCENSORES"));

  // No debe volver a sembrar en cada consulta.
  const segunda = await leer(await productos(req("/api/productos")));
  comprobar("no duplica al consultar de nuevo", segunda.cuerpo.productos.length === 21, `${segunda.cuerpo.productos.length}`);

  const P01 = inicial.cuerpo.productos[0].nombre;

  // Editar un producto de fábrica.
  await productos(req("/api/productos", { metodo: "POST", cuerpo: { nombre: P01, descripcion: "Descripción cambiada", observaciones: "Obs nuevas" } }));
  const editado = await leer(await productos(req("/api/productos")));
  const p01 = editado.cuerpo.productos.find((p) => p.nombre === P01);
  comprobar("edita un servicio de fábrica", p01.descripcion === "Descripción cambiada", p01.descripcion);
  comprobar("la edición no lo mueve de posición", editado.cuerpo.productos[0].nombre === P01);
  comprobar("sigue habiendo 21", editado.cuerpo.productos.length === 21, `${editado.cuerpo.productos.length}`);

  // Borrar un producto de fábrica y comprobar que NO reaparece.
  await productos(req(`/api/productos/${encodeURIComponent(P01)}`, { metodo: "DELETE" }));
  const tras = await leer(await productos(req("/api/productos")));
  comprobar("elimina un servicio de fábrica", tras.cuerpo.productos.length === 20, `${tras.cuerpo.productos.length}`);
  comprobar("el borrado NO reaparece al recargar", !tras.cuerpo.productos.some((p) => p.nombre === P01));

  // Crear uno nuevo: va al final.
  await productos(req("/api/productos", { metodo: "POST", cuerpo: { nombre: "X01 - Parqueaderos", descripcion: "Desc", observaciones: "Obs" } }));
  const conNuevo = await leer(await productos(req("/api/productos")));
  comprobar("el producto nuevo va al final", conNuevo.cuerpo.productos.at(-1).nombre === "X01 - Parqueaderos", conNuevo.cuerpo.productos.at(-1).nombre);

  // Renombrar: conserva la posición y no deja duplicado.
  const posicionAntes = conNuevo.cuerpo.productos.findIndex((p) => p.nombre === "X01 - Parqueaderos");
  await productos(req("/api/productos", { metodo: "POST", cuerpo: { nombre: "X01 - Parqueaderos cubiertos", nombreAnterior: "X01 - Parqueaderos", descripcion: "Desc", observaciones: "Obs" } }));
  const renombrado = await leer(await productos(req("/api/productos")));
  comprobar("renombrar no deja duplicado", renombrado.cuerpo.productos.length === conNuevo.cuerpo.productos.length, `${renombrado.cuerpo.productos.length} vs ${conNuevo.cuerpo.productos.length}`);
  comprobar("renombrar conserva la posición", renombrado.cuerpo.productos.findIndex((p) => p.nombre === "X01 - Parqueaderos cubiertos") === posicionAntes);
  comprobar("el nombre viejo desapareció", !renombrado.cuerpo.productos.some((p) => p.nombre === "X01 - Parqueaderos"));

  const sinNombre = await leer(await productos(req("/api/productos", { metodo: "POST", cuerpo: { descripcion: "x" } })));
  comprobar("producto sin nombre -> 400", sinNombre.status === 400, sinNombre.cuerpo.error);
}

console.log("\n== Numeración ==");
{
  const anio = String(new Date().getFullYear() % 100).padStart(2, "0");

  const ojeada1 = await leer(await numero(req("/api/numero")));
  const ojeada2 = await leer(await numero(req("/api/numero")));
  comprobar("GET no consume número", ojeada1.cuerpo.numero === ojeada2.cuerpo.numero, ojeada1.cuerpo.numero);

  const a = await leer(await numero(req("/api/numero", { metodo: "POST" })));
  const b = await leer(await numero(req("/api/numero", { metodo: "POST" })));
  comprobar("POST entrega secuencia", a.cuerpo.numero !== b.cuerpo.numero, `${a.cuerpo.numero} / ${b.cuerpo.numero}`);
  comprobar("formato PG NNNN/AA", /^PG \d{4}\/\d{2}$/.test(a.cuerpo.numero), a.cuerpo.numero);
  comprobar("usa el año en curso", a.cuerpo.numero.endsWith(`/${anio}`), a.cuerpo.numero);

  const trasApartar = await leer(await numero(req("/api/numero")));
  comprobar("GET refleja lo apartado", trasApartar.cuerpo.numero !== a.cuerpo.numero, trasApartar.cuerpo.numero);
}

console.log("\n== Dos personas guardando a la vez ==");
{
  const EN_PARALELO = 25;
  const respuestas = await Promise.all(
    Array.from({ length: EN_PARALELO }, () => numero(req("/api/numero", { metodo: "POST" }))),
  );
  const numeros = await Promise.all(respuestas.map(async (r) => (await r.json()).numero));

  const unicos = new Set(numeros);
  comprobar(`${EN_PARALELO} peticiones simultáneas -> ${unicos.size} números distintos`, unicos.size === EN_PARALELO,
    unicos.size === EN_PARALELO ? "sin repetidos" : `REPETIDOS: ${numeros.length - unicos.size}`);
  comprobar("ninguna falló", respuestas.every((r) => r.status === 200));
}

console.log("\n== No reutiliza números ya usados (migración) ==");
{
  const siguiente = (await (await numero(req("/api/numero"))).json()).numero;
  // Alguien sube una cotización vieja que ya ocupa ese número.
  await cotizaciones(req("/api/cotizaciones", { metodo: "POST", cuerpo: cotizacionDe(siguiente, "Cliente migrado") }));

  const apartado = (await (await numero(req("/api/numero", { metodo: "POST" }))).json()).numero;
  comprobar("salta el número ya ocupado", apartado !== siguiente, `ocupado ${siguiente} -> entregó ${apartado}`);
}

console.log("\n== Métodos no permitidos ==");
{
  const put = await leer(await cotizaciones(req("/api/cotizaciones", { metodo: "PUT" })));
  comprobar("PUT -> 405", put.status === 405, `status ${put.status}`);
}

console.log(fallos === 0 ? "\nTODO OK\n" : `\n${fallos} FALLA(S)\n`);
process.exit(fallos === 0 ? 0 : 1);
