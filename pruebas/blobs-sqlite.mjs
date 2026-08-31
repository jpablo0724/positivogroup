// Sustituye @netlify/blobs por el almacén SQL sobre SQLite, para correr las
// suites completas del backend contra la misma implementación que irá a
// producción sobre MySQL.

const { conectarSqlite } = await import("../servidor/sql.mts");
const { AlmacenSql } = await import("../servidor/almacenSql.mts");

const conexion = conectarSqlite();
const almacenes = new Map();

export function getStore(entrada) {
  const nombre = typeof entrada === "string" ? entrada : entrada.name;
  if (!almacenes.has(nombre)) {
    almacenes.set(nombre, new AlmacenSql(conexion, nombre));
  }
  return almacenes.get(nombre);
}
