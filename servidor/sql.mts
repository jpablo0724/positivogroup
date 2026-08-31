/**
 * Acceso a la base de datos, con dos motores detrás de la misma interfaz.
 *
 * En Hostinger corre sobre MySQL, que es lo que el plan provee y respalda. En
 * las pruebas corre sobre SQLite en memoria, que no necesita servidor.
 *
 * Las consultas que usa el sistema son idénticas en los dos motores, así que
 * lo único que cambia es el conector. Eso permite probar aquí exactamente la
 * misma lógica que va a producción, incluida la parte delicada: la escritura
 * condicionada que sostiene la numeración sin repetidos.
 */

export interface Fila {
  clave?: string;
  valor?: string;
  etag?: string;
}

export interface Conexion {
  ejecutar(
    sql: string,
    parametros?: unknown[],
  ): Promise<{ filas: Fila[]; afectadas: number }>;
  /** ¿El error viene de intentar insertar una clave que ya existe? */
  esDuplicado(error: unknown): boolean;
  cerrar(): Promise<void>;
}

/**
 * Una sola tabla para todo, con la misma forma que tenía Netlify Blobs:
 * almacén + clave -> valor JSON. El "etag" cambia en cada escritura y es lo
 * que permite detectar que alguien más modificó el registro mientras tanto.
 */
export const ESQUEMA_MYSQL = `
CREATE TABLE IF NOT EXISTS registros (
  almacen VARCHAR(32)  NOT NULL,
  clave   VARCHAR(191) NOT NULL,
  valor   LONGTEXT     NOT NULL,
  etag    VARCHAR(64)  NOT NULL,
  PRIMARY KEY (almacen, clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

const ESQUEMA_SQLITE = `
CREATE TABLE IF NOT EXISTS registros (
  almacen TEXT NOT NULL,
  clave   TEXT NOT NULL,
  valor   TEXT NOT NULL,
  etag    TEXT NOT NULL,
  PRIMARY KEY (almacen, clave)
);
`;

// --- MySQL (producción) ---

export async function conectarMysql(): Promise<Conexion> {
  const { createPool } = await import("mysql2/promise");

  const pool = createPool({
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    charset: "utf8mb4",
  });

  await pool.query(ESQUEMA_MYSQL);

  return {
    async ejecutar(sql, parametros = []) {
      const [resultado] = await pool.query(sql, parametros);
      if (Array.isArray(resultado)) {
        return { filas: resultado as Fila[], afectadas: resultado.length };
      }
      const info = resultado as { affectedRows?: number };
      return { filas: [], afectadas: info.affectedRows ?? 0 };
    },
    esDuplicado(error) {
      return (error as { code?: string })?.code === "ER_DUP_ENTRY";
    },
    async cerrar() {
      await pool.end();
    },
  };
}

// --- SQLite (pruebas y desarrollo) ---

export async function conectarSqlite(archivo = ":memory:"): Promise<Conexion> {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(archivo);
  db.exec(ESQUEMA_SQLITE);

  return {
    async ejecutar(sql, parametros = []) {
      const sentencia = db.prepare(sql);
      const valores = parametros as never[];

      if (/^\s*select/i.test(sql)) {
        const filas = sentencia.all(...valores) as Fila[];
        return { filas, afectadas: filas.length };
      }

      const resultado = sentencia.run(...valores);
      return { filas: [], afectadas: Number(resultado.changes) };
    },
    esDuplicado(error) {
      return /UNIQUE constraint failed|PRIMARY KEY/i.test(
        (error as Error)?.message ?? "",
      );
    },
    async cerrar() {
      db.close();
    },
  };
}
