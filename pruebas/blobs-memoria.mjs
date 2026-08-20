// Implementación en memoria de Netlify Blobs para probar las funciones sin
// depender de la red. Respeta la semántica de etag / onlyIfMatch / onlyIfNew,
// que es justamente lo que sostiene la numeración sin repetidos.

let contadorEtag = 0;

class StoreMemoria {
  constructor(name) {
    this.name = name;
    this.datos = new Map(); // key -> { valor: string, etag: string }
  }

  async #pausa() {
    // Cede el turno para que las operaciones en paralelo se intercalen de
    // verdad y las carreras salgan a la luz.
    await new Promise((r) => setTimeout(r, Math.random() * 3));
  }

  async get(key, options = {}) {
    await this.#pausa();
    const entrada = this.datos.get(key);
    if (!entrada) return null;
    return options.type === "json" ? JSON.parse(entrada.valor) : entrada.valor;
  }

  async getWithMetadata(key, options = {}) {
    await this.#pausa();
    const entrada = this.datos.get(key);
    if (!entrada) return null;
    return {
      data: options.type === "json" ? JSON.parse(entrada.valor) : entrada.valor,
      etag: entrada.etag,
      metadata: {},
    };
  }

  async getMetadata(key) {
    await this.#pausa();
    const entrada = this.datos.get(key);
    return entrada ? { etag: entrada.etag, metadata: {} } : null;
  }

  async set(key, valor, options = {}) {
    await this.#pausa();
    const actual = this.datos.get(key);

    if (options.onlyIfNew && actual) return { modified: false };
    if (options.onlyIfMatch !== undefined) {
      if (!actual || actual.etag !== options.onlyIfMatch) {
        return { modified: false };
      }
    }

    const etag = `etag-${++contadorEtag}`;
    this.datos.set(key, { valor, etag });
    return { modified: true, etag };
  }

  async setJSON(key, datos, options = {}) {
    return this.set(key, JSON.stringify(datos), options);
  }

  async delete(key) {
    await this.#pausa();
    this.datos.delete(key);
  }

  async list() {
    await this.#pausa();
    return {
      blobs: [...this.datos.entries()].map(([key, v]) => ({
        key,
        etag: v.etag,
      })),
      directories: [],
    };
  }
}

const almacenes = new Map();

export function getStore(input) {
  const name = typeof input === "string" ? input : input.name;
  if (!almacenes.has(name)) almacenes.set(name, new StoreMemoria(name));
  return almacenes.get(name);
}

export function reiniciarAlmacenes() {
  almacenes.clear();
}
