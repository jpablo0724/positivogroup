// Sustituye @netlify/blobs por el almacén en memoria durante las pruebas.
const STUB = new URL('./blobs-memoria.mjs', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === '@netlify/blobs') return { url: STUB, shortCircuit: true };
  return next(specifier, context);
}
