import { getStore as getStoreNetlify } from "@netlify/blobs";
import { AlmacenSql } from "../../servidor/almacenSql.mts";
import { conectarMysql, type Conexion } from "../../servidor/sql.mts";

/**
 * De dónde salen los almacenes del sistema.
 *
 * Con DB_HOST definido usa MySQL (el servidor propio en Hostinger); si no,
 * Netlify Blobs. Así los dos despliegues conviven durante la migración y se
 * puede volver atrás sin tocar código.
 *
 * Las funciones del backend piden sus almacenes por aquí y no saben cuál de
 * los dos está detrás.
 */

const usaMysql = Boolean(process.env.DB_HOST);

// Una sola conexión para todo el proceso, abierta la primera vez que se pide.
let conexion: Promise<Conexion> | null = null;

function conexionMysql(): Promise<Conexion> {
  conexion ??= conectarMysql();
  return conexion;
}

const almacenes = new Map<string, AlmacenSql>();

type Entrada = string | { name: string; consistency?: string };

export function getStore(entrada: Entrada) {
  if (!usaMysql) return getStoreNetlify(entrada as never);

  const nombre = typeof entrada === "string" ? entrada : entrada.name;
  let almacen = almacenes.get(nombre);
  if (!almacen) {
    almacen = new AlmacenSql(conexionMysql(), nombre);
    almacenes.set(nombre, almacen);
  }
  return almacen as never;
}
