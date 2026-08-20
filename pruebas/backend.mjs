import { register } from "node:module";
register("./loader.mjs", import.meta.url);

const CODIGO = "clave-de-prueba-local";
process.env.APP_ACCESS_CODE = CODIGO;

const { default: cotizaciones } = await import("../netlify/functions/cotizaciones.mts");
const { default: productos } = await import("../netlify/functions/productos.mts");
const { default: numero } = await import("../netlify/functions/numero.mts");

const BASE = "https://cotizador-positivo.netlify.app";

function req(ruta, { metodo = "GET", cuerpo, codigo = CODIGO } = {}) {
  return new Request(`${BASE}${ruta}`, {
    method: metodo,
    headers: codigo === null ? {} : { "x-codigo-acceso": codigo },
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

console.log("\n== Control de acceso ==");
{
  const sinCodigo = await leer(await cotizaciones(req("/api/cotizaciones", { codigo: null })));
  comprobar("sin código -> 401", sinCodigo.status === 401, `status ${sinCodigo.status}`);

  const malCodigo = await leer(await cotizaciones(req("/api/cotizaciones", { codigo: "otra-cosa" })));
  comprobar("código incorrecto -> 401", malCodigo.status === 401, `status ${malCodigo.status}`);

  // Un código de otra longitud no debe colarse ni romper la comparación.
  const corto = await leer(await cotizaciones(req("/api/cotizaciones", { codigo: "x" })));
  comprobar("código corto -> 401", corto.status === 401, `status ${corto.status}`);

  delete process.env.APP_ACCESS_CODE;
  const sinVariable = await leer(await cotizaciones(req("/api/cotizaciones")));
  comprobar("sin APP_ACCESS_CODE -> 503", sinVariable.status === 503, sinVariable.cuerpo.error);
  process.env.APP_ACCESS_CODE = CODIGO;

  const bien = await leer(await cotizaciones(req("/api/cotizaciones")));
  comprobar("código correcto -> 200", bien.status === 200, `status ${bien.status}`);
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

console.log("\n== Productos ==");
{
  await productos(req("/api/productos", { metodo: "POST", cuerpo: { nombre: "X01 - Parqueaderos", descripcion: "Desc", observaciones: "Obs" } }));
  await productos(req("/api/productos", { metodo: "POST", cuerpo: { nombre: "A02 - Otro/Especial", descripcion: "D2", observaciones: "O2" } }));

  const lista = await leer(await productos(req("/api/productos")));
  comprobar("guarda y lista 2 productos", lista.cuerpo.productos.length === 2, `${lista.cuerpo.productos.length}`);
  comprobar("ordenados alfabéticamente", lista.cuerpo.productos[0].nombre.startsWith("A02"));

  const sinNombre = await leer(await productos(req("/api/productos", { metodo: "POST", cuerpo: { descripcion: "x" } })));
  comprobar("producto sin nombre -> 400", sinNombre.status === 400, sinNombre.cuerpo.error);

  await productos(req(`/api/productos/${encodeURIComponent("A02 - Otro/Especial")}`, { metodo: "DELETE" }));
  const tras = await leer(await productos(req("/api/productos")));
  comprobar("elimina producto con barra en el nombre", tras.cuerpo.productos.length === 1, `${tras.cuerpo.productos.length}`);
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
