import { json } from "../lib/acceso.mts";
import { buscarUsuario } from "../lib/auth.mts";
import {
  almacenCotizaciones,
  almacenEnlaces,
  claveCotizacion,
} from "../lib/almacen.mts";

/**
 * Cotización vista por el cliente, sin necesidad de entrar al sistema.
 *
 *   GET /api/publico/<testigo>
 *
 * Es la única ruta del backend que no exige sesión, porque el cliente que
 * recibe el enlace no tiene cuenta. Lo que la protege es que el testigo son
 * 32 bytes al azar: no se puede adivinar ni recorrer, y sin él esta ruta no
 * devuelve nada.
 *
 * Solo entrega la cotización que corresponde a ese testigo. Nunca lista, ni
 * permite escribir.
 *
 * También resuelve quién firma (nombre, teléfono y correo de quien la creó):
 * quien recibe el enlace no tiene sesión, así que no puede consultar el
 * equipo por su cuenta como sí hace la aplicación por dentro.
 */

export default async (req: Request) => {
  if (req.method !== "GET") {
    return json({ error: "metodo_no_permitido", metodo: req.method }, 405);
  }

  const url = new URL(req.url);
  const testigo = decodeURIComponent(
    url.pathname.replace(/^.*?\/publico\/?/, ""),
  ).trim();

  // Formato del testigo: 43 caracteres base64url. Se comprueba antes de tocar
  // el almacenamiento, para que una ruta cualquiera no dispare una lectura.
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(testigo)) {
    return json({ error: "enlace_invalido" }, 404);
  }

  try {
    const enlace = (await almacenEnlaces().get(testigo, { type: "json" })) as {
      numeroFactura?: string;
    } | null;

    if (!enlace?.numeroFactura) return json({ error: "enlace_invalido" }, 404);

    const cotizacion = (await almacenCotizaciones().get(
      claveCotizacion(enlace.numeroFactura),
      { type: "json" },
    )) as { creadoPor?: string; data?: unknown; guardadoEn?: string } | null;

    // El enlace puede seguir vivo aunque la cotización ya se haya eliminado.
    if (!cotizacion) return json({ error: "cotizacion_no_existe" }, 404);

    const autor = cotizacion.creadoPor
      ? await buscarUsuario(cotizacion.creadoPor)
      : null;
    const creador = autor
      ? {
          nombre: [autor.nombre, autor.apellidos].filter(Boolean).join(" "),
          telefono: autor.telefono ?? "",
          correo: autor.email,
          cargo: autor.cargo ?? "",
        }
      : null;

    // Solo lo que se ve en el documento. El registro guardado trae además
    // datos internos —el motivo de ganada o perdida, el historial con los
    // correos del equipo, a quién se reasignó, los enlaces a los adjuntos— que
    // el cliente no debe poder leer, ni siquiera mirando la respuesta en las
    // herramientas del navegador.
    return json({
      cotizacion: { data: cotizacion.data, guardadoEn: cotizacion.guardadoEn },
      creador,
    });
  } catch (err) {
    console.error("Error en el enlace público:", err);
    return json({ error: "fallo_almacenamiento" }, 502);
  }
};
