// Ejercita el almacén SQL contra SQLite, con la misma semántica que se usará
// sobre MySQL. Lo que más importa aquí es la escritura condicionada: es lo que
// sostiene la numeración de las cotizaciones sin repetidos.

const { conectarSqlite } = await import("../servidor/sql.mts");
const { AlmacenSql } = await import("../servidor/almacenSql.mts");

let fallos = 0;
function comprobar(nombre, condicion, detalle = "") {
  console.log(`${condicion ? "  ok  " : " FALLA"} ${nombre}${detalle ? ` -> ${detalle}` : ""}`);
  if (!condicion) fallos++;
}

const con = await conectarSqlite();
const almacen = new AlmacenSql(con, "pruebas");
const otro = new AlmacenSql(con, "otro");

console.log("\n== Lo básico ==");
{
  comprobar("una clave que no existe -> null", (await almacen.get("nada", { type: "json" })) === null);

  await almacen.setJSON("a", { hola: "mundo", n: 3 });
  const leido = await almacen.get("a", { type: "json" });
  comprobar("guarda y lee JSON", leido.hola === "mundo" && leido.n === 3, JSON.stringify(leido));

  await almacen.setJSON("a", { hola: "otra vez" });
  comprobar("sobrescribe", (await almacen.get("a", { type: "json" })).hola === "otra vez");

  const conMeta = await almacen.getWithMetadata("a", { type: "json" });
  comprobar("getWithMetadata trae datos y etag",
    conMeta.data.hola === "otra vez" && typeof conMeta.etag === "string", conMeta.etag);

  comprobar("getMetadata trae el etag", (await almacen.getMetadata("a")).etag === conMeta.etag);
  comprobar("getMetadata de lo que no existe -> null", (await almacen.getMetadata("nada")) === null);

  await almacen.delete("a");
  comprobar("elimina", (await almacen.get("a", { type: "json" })) === null);
}

console.log("\n== Los almacenes no se mezclan ==");
{
  await almacen.setJSON("misma-clave", { de: "pruebas" });
  await otro.setJSON("misma-clave", { de: "otro" });
  comprobar("la misma clave en dos almacenes no colisiona",
    (await almacen.get("misma-clave", { type: "json" })).de === "pruebas" &&
    (await otro.get("misma-clave", { type: "json" })).de === "otro");

  const lista = await almacen.list();
  comprobar("list solo devuelve lo de su almacén",
    lista.blobs.every((b) => b.key !== "de-otro") && lista.blobs.some((b) => b.key === "misma-clave"),
    lista.blobs.map((b) => b.key).join(", "));
}

console.log("\n== onlyIfNew ==");
{
  const primera = await almacen.setJSON("unica", { intento: 1 }, { onlyIfNew: true });
  comprobar("la primera escritura entra", primera.modified === true);

  const segunda = await almacen.setJSON("unica", { intento: 2 }, { onlyIfNew: true });
  comprobar("la segunda NO entra", segunda.modified === false);
  comprobar("el valor original no se tocó", (await almacen.get("unica", { type: "json" })).intento === 1);
}

console.log("\n== onlyIfMatch (lo que sostiene la numeración) ==");
{
  await almacen.setJSON("contador", { n: 0 });
  const actual = await almacen.getWithMetadata("contador", { type: "json" });

  const conEtagViejo = await almacen.setJSON("contador", { n: 99 }, { onlyIfMatch: "etag-inventado" });
  comprobar("con un etag que no coincide, NO escribe", conEtagViejo.modified === false);
  comprobar("el valor quedó intacto", (await almacen.get("contador", { type: "json" })).n === 0);

  const conEtagBueno = await almacen.setJSON("contador", { n: 1 }, { onlyIfMatch: actual.etag });
  comprobar("con el etag correcto, sí escribe", conEtagBueno.modified === true);
  comprobar("y el etag cambia", conEtagBueno.etag !== actual.etag);

  // El etag viejo ya no sirve: es justo lo que detecta que otro escribió antes.
  const reintento = await almacen.setJSON("contador", { n: 2 }, { onlyIfMatch: actual.etag });
  comprobar("el etag anterior queda invalidado", reintento.modified === false);
}

console.log("\n== Numeración con varias personas a la vez ==");
{
  // Se reproduce el bucle real de la función numero.mts sobre este almacén.
  async function apartar() {
    for (let intento = 0; intento < 40; intento++) {
      const actual = await almacen.getWithMetadata("secuencia", { type: "json" });
      const siguiente = (actual?.data?.ultimo ?? 0) + 1;
      const escritura = await almacen.setJSON(
        "secuencia",
        { ultimo: siguiente },
        actual?.etag ? { onlyIfMatch: actual.etag } : { onlyIfNew: true },
      );
      if (escritura.modified) return siguiente;
    }
    return null;
  }

  const EN_PARALELO = 30;
  const numeros = await Promise.all(Array.from({ length: EN_PARALELO }, apartar));
  const unicos = new Set(numeros);

  comprobar(`${EN_PARALELO} a la vez -> ${unicos.size} números distintos`,
    unicos.size === EN_PARALELO && !numeros.includes(null),
    unicos.size === EN_PARALELO ? "sin repetidos" : `REPETIDOS: ${numeros.length - unicos.size}`);
  comprobar("la secuencia queda completa del 1 al 30",
    [...unicos].sort((a, b) => a - b).join(",") === Array.from({ length: EN_PARALELO }, (_, i) => i + 1).join(","));
}

console.log("\n== Textos que suelen romper SQL ==");
{
  const raro = { texto: "O'Brien \"comillas\" ; DROP TABLE registros; -- ñ á 💡 <b>&amp;</b>" };
  await almacen.setJSON("raro", raro);
  comprobar("comillas, acentos, emoji y SQL en el valor", (await almacen.get("raro", { type: "json" })).texto === raro.texto);

  const claveRara = "PG 0001/26 · ñáé";
  await almacen.setJSON(claveRara, { ok: true });
  comprobar("claves con espacios, barras y acentos", (await almacen.get(claveRara, { type: "json" })).ok === true);

  await almacen.setJSON("grande", { texto: "x".repeat(200000) });
  comprobar("valores grandes (200 KB)", (await almacen.get("grande", { type: "json" })).texto.length === 200000);
}

await con.cerrar();
console.log(fallos === 0 ? "\nTODO OK\n" : `\n${fallos} FALLA(S)\n`);
process.exit(fallos === 0 ? 0 : 1);
