import { json, revisarSesion } from "../lib/acceso.mts";
import {
  almacenContadores,
  almacenCotizaciones,
  claveCotizacion,
} from "../lib/almacen.mts";

/**
 * Numeración de las cotizaciones (PG 0001/26).
 *
 *   GET  /api/numero -> cuál sería el siguiente, sin apartarlo
 *   POST /api/numero -> aparta el siguiente y lo devuelve
 *
 * El número se aparta al guardar, no al abrir el formulario: si se apartara al
 * abrir, cada vez que alguien entra y no guarda quedaría un hueco en la
 * secuencia.
 *
 * Dos personas guardando al mismo tiempo son el caso delicado. El contador se
 * escribe con `onlyIfMatch`, así que la segunda escritura falla si el contador
 * cambió desde que se leyó, y se reintenta con el número siguiente. Así nunca
 * se entrega el mismo número dos veces.
 */

const CLAVE = "cotizaciones";
const MAXIMO_INTENTOS = 25;

interface Contador {
  anio: number;
  ultimo: number;
}

function anioActual(): number {
  return new Date().getFullYear() % 100;
}

function formatear(numero: number, anio: number): string {
  return `PG ${String(numero).padStart(4, "0")}/${String(anio).padStart(2, "0")}`;
}

function comoContador(valor: unknown, anio: number): Contador {
  const posible = valor as Contador | null;
  if (
    posible &&
    typeof posible.anio === "number" &&
    typeof posible.ultimo === "number" &&
    posible.anio === anio
  ) {
    return posible;
  }
  // Sin contador todavía, o cambió el año: la secuencia arranca de nuevo.
  return { anio, ultimo: 0 };
}

export default async (req: Request) => {
  const sinSesion = await revisarSesion(req);
  if (sinSesion) return sinSesion;

  const contadores = almacenContadores();
  const cotizaciones = almacenCotizaciones();
  const anio = anioActual();

  try {
    if (req.method === "GET") {
      const guardado = await contadores.get(CLAVE, { type: "json" });
      const contador = comoContador(guardado, anio);
      return json({ numero: formatear(contador.ultimo + 1, anio) });
    }

    if (req.method !== "POST") {
      return json({ error: "metodo_no_permitido", metodo: req.method }, 405);
    }

    for (let intento = 0; intento < MAXIMO_INTENTOS; intento++) {
      const actual = await contadores.getWithMetadata(CLAVE, { type: "json" });
      const contador = comoContador(actual?.data, anio);
      const candidato = contador.ultimo + 1;
      const numero = formatear(candidato, anio);

      // Si el número ya está usado (por ejemplo al subir cotizaciones que
      // venían guardadas en el navegador), se avanza sin devolverlo.
      const ocupado = await cotizaciones.getMetadata(claveCotizacion(numero));

      const nuevo: Contador = { anio, ultimo: candidato };
      const escritura = await contadores.setJSON(
        CLAVE,
        nuevo,
        actual?.etag ? { onlyIfMatch: actual.etag } : { onlyIfNew: true },
      );

      // Otra persona apartó un número entre la lectura y la escritura:
      // se vuelve a intentar con el contador ya actualizado.
      if (!escritura.modified) continue;

      if (!ocupado) return json({ numero });
    }

    return json({ error: "no_se_pudo_apartar_numero" }, 409);
  } catch (err) {
    return json(
      {
        error: "fallo_almacenamiento",
        detalle: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
};
