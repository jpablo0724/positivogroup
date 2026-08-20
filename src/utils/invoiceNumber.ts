import { pedir } from "./api";

/**
 * Numeración de las cotizaciones (PG 0001/26), llevada por el servidor para
 * que dos personas trabajando a la vez nunca reciban el mismo número.
 *
 * `numeroProvisional` solo consulta cuál sería el siguiente, para mostrarlo
 * mientras se llena el formulario. `apartarNumero` es el que lo consume, y se
 * llama al guardar: así, abrir el formulario y no guardar no deja huecos en
 * la secuencia.
 */

/** Cuál sería el siguiente número, sin apartarlo. */
export async function numeroProvisional(): Promise<string> {
  const { numero } = await pedir<{ numero: string }>("/api/numero");
  return numero;
}

/** Aparta el siguiente número de la secuencia y lo devuelve. */
export async function apartarNumero(): Promise<string> {
  const { numero } = await pedir<{ numero: string }>("/api/numero", {
    metodo: "POST",
  });
  return numero;
}
