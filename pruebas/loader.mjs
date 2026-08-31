// Sustituye @netlify/blobs durante las pruebas. Con PRUEBA_ALMACEN=sqlite usa
// el almacén SQL de verdad (el que va a producción sobre MySQL); si no, uno en
// memoria, que es más rápido.
const archivo =
  process.env.PRUEBA_ALMACEN === "sqlite"
    ? "./blobs-sqlite.mjs"
    : "./blobs-memoria.mjs";
const STUB = new URL(archivo, import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === '@netlify/blobs') return { url: STUB, shortCircuit: true };
  return next(specifier, context);
}
