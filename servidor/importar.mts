import { readFile } from "node:fs/promises";
import { AlmacenSql } from "./almacenSql.mts";
import { conectarMysql, conectarSqlite, type Conexion } from "./sql.mts";

/**
 * Carga en la base de datos el respaldo descargado de /api/admin/exportar.
 *
 *   node servidor/importar.mts positivogroup-respaldo.json
 *
 * Se puede correr varias veces sin miedo: cada registro se escribe por su
 * clave, así que repetir la importación deja lo mismo, no duplicados. Por
 * defecto no pisa lo que ya exista; con --reemplazar sí.
 */

async function principal() {
  const [archivo, ...banderas] = process.argv.slice(2);

  if (!archivo) {
    console.error("Falta el archivo. Uso: node servidor/importar.mts <respaldo.json>");
    process.exit(1);
  }

  const reemplazar = banderas.includes("--reemplazar");

  const contenido = JSON.parse(await readFile(archivo, "utf8")) as {
    exportadoEn?: string;
    almacenes?: Record<string, Record<string, unknown>>;
  };

  if (!contenido.almacenes) {
    console.error("El archivo no tiene la forma esperada: falta 'almacenes'.");
    process.exit(1);
  }

  // Sin DB_HOST se escribe en un SQLite local, útil para ensayar la
  // importación antes de tocar la base de datos de verdad.
  const conexion: Conexion = process.env.DB_HOST
    ? await conectarMysql()
    : await conectarSqlite(process.env.SQLITE_FILE ?? "datos.sqlite");

  console.log(
    process.env.DB_HOST
      ? `Importando a MySQL en ${process.env.DB_HOST}`
      : `Importando a ${process.env.SQLITE_FILE ?? "datos.sqlite"}`,
  );
  if (contenido.exportadoEn) console.log(`Respaldo del ${contenido.exportadoEn}`);

  let escritos = 0;
  let omitidos = 0;

  for (const [nombre, registros] of Object.entries(contenido.almacenes)) {
    const almacen = new AlmacenSql(conexion, nombre);
    let delAlmacen = 0;

    for (const [clave, valor] of Object.entries(registros)) {
      if (valor === null || valor === undefined) continue;

      const resultado = await almacen.setJSON(
        clave,
        valor,
        reemplazar ? {} : { onlyIfNew: true },
      );

      if (resultado.modified) {
        escritos++;
        delAlmacen++;
      } else {
        omitidos++;
      }
    }

    console.log(`  ${nombre}: ${delAlmacen} de ${Object.keys(registros).length}`);
  }

  await conexion.cerrar();

  console.log(`\nListo. ${escritos} registros escritos.`);
  if (omitidos > 0) {
    console.log(
      `${omitidos} ya existían y se dejaron como estaban. ` +
        "Usa --reemplazar si quieres pisarlos con los del respaldo.",
    );
  }
}

principal().catch((error) => {
  console.error("La importación falló:", error);
  process.exit(1);
});
