import {
  contactosDeEmpresa,
  contactosPorNombreDeEmpresa,
} from "../netlify/functions/clientify.mts";

/**
 * El bug real: Clientify no anida los contactos dentro de la empresa (se
 * probó contra la API y el campo "employees" no existe en la respuesta). Los
 * contactos viven aparte y solo dicen el NOMBRE de su empresa, en texto —
 * nada de un id. Estas pruebas cubren ese cruce, que es lo que se rompió.
 */

let fallos = 0;
function comprobar(nombre, condicion, detalle = "") {
  console.log(`${condicion ? "  ok  " : " FALLA"} ${nombre}${detalle ? ` -> ${detalle}` : ""}`);
  if (!condicion) fallos++;
}

console.log("\n== Cruce de contactos por nombre de empresa ==");
{
  const contactos = [
    { id: 1, first_name: "Laura", company: "Positivo Uno S.A.S" },
    { id: 2, first_name: "Carlos", company: "Positivo Dos S.A.S" },
    { id: 3, first_name: "María", company: "Positivo Dos S.A.S" },
    // Con tilde y mayúsculas distintas: debe encontrarla igual.
    { id: 4, first_name: "Bancóldex Uno", company: "bancoldex" },
    { id: 5, first_name: "Sin empresa", company: null },
  ];
  const porNombre = contactosPorNombreDeEmpresa(contactos);

  const empresaUno = { name: "Positivo Uno S.A.S", business_name: "Positivo Uno S.A.S" };
  comprobar("una empresa con un solo contacto lo encuentra",
    contactosDeEmpresa(empresaUno, porNombre).length === 1);

  const empresaDos = { name: "Positivo Dos S.A.S", business_name: "Positivo Dos S.A.S" };
  comprobar("una empresa con varios contactos los encuentra todos",
    contactosDeEmpresa(empresaDos, porNombre).length === 2);

  const bancoldex = { name: "Bancóldex", business_name: "Bancóldex" };
  comprobar("ignora acentos y mayúsculas al enlazar",
    contactosDeEmpresa(bancoldex, porNombre).length === 1);

  const sinContactos = { name: "Nadie la conoce S.A.S", business_name: "" };
  comprobar("una empresa sin contactos no revienta, da vacío",
    contactosDeEmpresa(sinContactos, porNombre).length === 0);

  comprobar("un contacto sin empresa (company null) no se cuela en ninguna",
    [...porNombre.values()].flat().every((c) => c.id !== 5));
}

console.log("\n== Enlaza por nombre comercial o por razón social ==");
{
  // El contacto trae el texto que sea (a veces el nombre comercial, a veces
  // la razón social), así que hay que probar los dos sin duplicar si acierta
  // en ambos.
  const contactos = [
    { id: 10, first_name: "Ana", company: "Redcol" },
    { id: 11, first_name: "Beto", company: "Redcol Holding S.A.S" },
  ];
  const porNombre = contactosPorNombreDeEmpresa(contactos);
  const empresa = { name: "Redcol", business_name: "Redcol Holding S.A.S" };

  const encontrados = contactosDeEmpresa(empresa, porNombre);
  comprobar("encuentra por los dos nombres sin duplicar", encontrados.length === 2,
    JSON.stringify(encontrados.map((c) => c.id)));

  const mismoNombreYRazonSocial = { name: "Redcol", business_name: "Redcol" };
  comprobar("cuando nombre y razón social son iguales, no busca dos veces",
    contactosDeEmpresa(mismoNombreYRazonSocial, porNombre).length === 1);
}

console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLA(S)`);
process.exit(fallos === 0 ? 0 : 1);
