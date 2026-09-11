import { AlmacenSql } from "../../servidor/almacenSql.mts";
import {
  conectarMysql,
  conectarSqlite,
  type Conexion,
} from "../../servidor/sql.mts";

/**
 * De dónde salen los almacenes del sistema.
 *
 * Con DB_HOST definido usa MySQL (el servidor propio en Hostinger); sin eso,
 * un archivo SQLite (SQLITE_FILE), que sirve para ensayar el servidor
 * completo sin base de datos.
 *
 * Las funciones del backend piden sus almacenes por aquí y no saben cuál de
 * los dos está detrás.
 */

const archivoSqlite = process.env.SQLITE_FILE ?? "";

// Una sola conexión para todo el proceso, abierta la primera vez que se pide.
let conexion: Promise<Conexion> | null = null;

function conexionSql(): Promise<Conexion> {
  conexion ??= process.env.DB_HOST
    ? conectarMysql()
    : conectarSqlite(archivoSqlite);
  return conexion;
}

const almacenes = new Map<string, AlmacenSql>();

type Entrada = string | { name: string; consistency?: string };

export function getStore(entrada: Entrada) {
  const nombre = typeof entrada === "string" ? entrada : entrada.name;
  let almacen = almacenes.get(nombre);
  if (!almacen) {
    almacen = new AlmacenSql(conexionSql(), nombre);
    almacenes.set(nombre, almacen);
  }
  return almacen;
}
