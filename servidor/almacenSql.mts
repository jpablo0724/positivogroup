import { randomUUID } from "node:crypto";
import type { Conexion } from "./sql.mts";

/**
 * Almacén con la misma interfaz que Netlify Blobs, sobre SQL.
 *
 * Se implementa exactamente lo que el sistema usa —get, getWithMetadata,
 * getMetadata, setJSON con sus condiciones, delete y list—, de modo que las
 * funciones del backend no cambian ni una línea al migrar.
 *
 * Lo importante es `setJSON` con condiciones, que es lo que sostiene la
 * numeración de las cotizaciones:
 *
 *   onlyIfNew   -> INSERT; si la clave ya existe, no modifica nada.
 *   onlyIfMatch -> UPDATE ... WHERE etag = ?; si otro escribió primero, el
 *                  etag ya no coincide, no se afecta ninguna fila y quien
 *                  llamó sabe que debe reintentar.
 *
 * Las dos son atómicas en el motor, no en este proceso, así que siguen siendo
 * correctas con varias personas guardando a la vez.
 */

interface OpcionesEscritura {
  onlyIfNew?: boolean;
  onlyIfMatch?: string;
}

interface Resultado {
  modified: boolean;
  etag?: string;
}

export class AlmacenSql {
  // La conexión llega como promesa para poder crear el almacén sin await,
  // igual que getStore de Netlify. Cada método la espera por dentro.
  private conexion: Promise<Conexion>;
  private nombre: string;

  constructor(conexion: Promise<Conexion> | Conexion, nombre: string) {
    this.conexion = Promise.resolve(conexion);
    this.nombre = nombre;
  }

  private async con(): Promise<Conexion> {
    return this.conexion;
  }

  private async leerFila(clave: string): Promise<Fila | null> {
    const { filas } = await (await this.con()).ejecutar(
      "SELECT valor, etag FROM registros WHERE almacen = ? AND clave = ?",
      [this.nombre, clave],
    );
    const fila = filas[0];
    return fila ? { valor: String(fila.valor), etag: String(fila.etag) } : null;
  }

  async get(clave: string, opciones?: { type?: string }): Promise<unknown> {
    const fila = await this.leerFila(clave);
    if (!fila) return null;
    return opciones?.type === "json" ? JSON.parse(fila.valor) : fila.valor;
  }

  async getWithMetadata(
    clave: string,
    opciones?: { type?: string },
  ): Promise<{ data: unknown; etag: string } | null> {
    const fila = await this.leerFila(clave);
    if (!fila) return null;
    return {
      data: opciones?.type === "json" ? JSON.parse(fila.valor) : fila.valor,
      etag: fila.etag,
    };
  }

  async getMetadata(clave: string): Promise<{ etag: string } | null> {
    const fila = await this.leerFila(clave);
    return fila ? { etag: fila.etag } : null;
  }

  async set(
    clave: string,
    valor: string,
    opciones: OpcionesEscritura = {},
  ): Promise<Resultado> {
    const etag = randomUUID();

    // Solo si no existe: lo resuelve la clave primaria, no una comprobación
    // previa que podría quedar obsoleta entre la lectura y la escritura.
    if (opciones.onlyIfNew) {
      try {
        await (await this.con()).ejecutar(
          "INSERT INTO registros (almacen, clave, valor, etag) VALUES (?, ?, ?, ?)",
          [this.nombre, clave, valor, etag],
        );
        return { modified: true, etag };
      } catch (error) {
        if ((await this.con()).esDuplicado(error)) return { modified: false };
        throw error;
      }
    }

    // Solo si nadie lo cambió desde que se leyó.
    if (opciones.onlyIfMatch !== undefined) {
      const { afectadas } = await (await this.con()).ejecutar(
        "UPDATE registros SET valor = ?, etag = ? WHERE almacen = ? AND clave = ? AND etag = ?",
        [valor, etag, this.nombre, clave, opciones.onlyIfMatch],
      );
      return afectadas > 0 ? { modified: true, etag } : { modified: false };
    }

    // Escritura normal: se intenta actualizar y, si no existía, se inserta. Si
    // otro lo insertó en ese instante, se vuelve a actualizar.
    const { afectadas } = await (await this.con()).ejecutar(
      "UPDATE registros SET valor = ?, etag = ? WHERE almacen = ? AND clave = ?",
      [valor, etag, this.nombre, clave],
    );
    if (afectadas > 0) return { modified: true, etag };

    try {
      await (await this.con()).ejecutar(
        "INSERT INTO registros (almacen, clave, valor, etag) VALUES (?, ?, ?, ?)",
        [this.nombre, clave, valor, etag],
      );
    } catch (error) {
      if (!(await this.con()).esDuplicado(error)) throw error;
      await (await this.con()).ejecutar(
        "UPDATE registros SET valor = ?, etag = ? WHERE almacen = ? AND clave = ?",
        [valor, etag, this.nombre, clave],
      );
    }

    return { modified: true, etag };
  }

  async setJSON(
    clave: string,
    datos: unknown,
    opciones: OpcionesEscritura = {},
  ): Promise<Resultado> {
    return this.set(clave, JSON.stringify(datos), opciones);
  }

  async delete(clave: string): Promise<void> {
    await (await this.con()).ejecutar(
      "DELETE FROM registros WHERE almacen = ? AND clave = ?",
      [this.nombre, clave],
    );
  }

  async list(): Promise<{ blobs: { key: string; etag: string }[] }> {
    const { filas } = await (await this.con()).ejecutar(
      "SELECT clave, etag FROM registros WHERE almacen = ?",
      [this.nombre],
    );
    return {
      blobs: filas.map((fila) => ({
        key: String(fila.clave),
        etag: String(fila.etag),
      })),
    };
  }
}

interface Fila {
  valor: string;
  etag: string;
}
