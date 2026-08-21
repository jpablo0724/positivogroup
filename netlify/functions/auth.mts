import { json } from "../lib/acceso.mts";
import {
  MINIMO_CONTRASENA,
  NOMBRE_COOKIE,
  abrirSesion,
  buscarUsuario,
  cerrarSesion,
  comoPublico,
  contrasenaCoincide,
  cookieBorrada,
  cookieSesion,
  cerrarSesionesDe,
  crearUsuario,
  derivarContrasena,
  guardarUsuario,
  leerCookie,
  normalizarEmail,
  reclamarPrimerUsuario,
  usuarioDeSesion,
} from "../lib/auth.mts";

/**
 * Registro e inicio de sesión.
 *
 *   POST /api/auth/registro -> crea la cuenta y deja la sesión abierta
 *   POST /api/auth/entrar   -> inicia sesión
 *   POST /api/auth/salir    -> cierra la sesión
 *   GET  /api/auth/sesion   -> quién está dentro
 *
 * El registro exige el código de la empresa (APP_ACCESS_CODE en Netlify). Sin
 * esa puerta, cualquiera que llegara a la dirección podría crearse una cuenta
 * y ver las cotizaciones y los datos de los clientes.
 */

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

/** Respuesta con cookie de sesión adjunta. */
function conCookie(cuerpo: unknown, cookie: string, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "set-cookie": cookie,
    },
  });
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const accion = url.pathname.split("/").filter(Boolean).pop() ?? "";

  try {
    // --- Quién está dentro ---
    if (accion === "sesion") {
      const usuario = await usuarioDeSesion(leerCookie(req, NOMBRE_COOKIE));
      if (!usuario) return json({ error: "sin_sesion" }, 401);
      return json({ usuario: comoPublico(usuario) });
    }

    if (req.method !== "POST") {
      return json({ error: "metodo_no_permitido", metodo: req.method }, 405);
    }

    // --- Cerrar sesión ---
    if (accion === "salir") {
      const testigo = leerCookie(req, NOMBRE_COOKIE);
      if (testigo) await cerrarSesion(testigo);
      return conCookie({ cerrada: true }, cookieBorrada());
    }

    const cuerpo = await req.json().catch(() => ({}));
    const email = normalizarEmail(texto((cuerpo as never)["email"]));
    const contrasena = texto((cuerpo as never)["contrasena"]);

    // --- Registro ---
    if (accion === "registro") {
      const codigoEmpresa = process.env.APP_ACCESS_CODE;
      if (!codigoEmpresa) {
        return json(
          {
            error: "falta_codigo_configurado",
            mensaje:
              "El backend no tiene definida la variable APP_ACCESS_CODE en " +
              "Netlify, que es el código con el que se autoriza el registro.",
          },
          503,
        );
      }

      const nombre = texto((cuerpo as never)["nombre"]).trim();
      const codigo = texto((cuerpo as never)["codigo"]);

      if (nombre === "") return json({ error: "falta_nombre" }, 400);
      if (!EMAIL_VALIDO.test(email)) return json({ error: "email_invalido" }, 400);
      if (contrasena.length < MINIMO_CONTRASENA) {
        return json(
          { error: "contrasena_corta", minimo: MINIMO_CONTRASENA },
          400,
        );
      }
      if (codigo !== codigoEmpresa) {
        return json({ error: "codigo_empresa_invalido" }, 403);
      }

      // La primera cuenta que se registre queda como administradora.
      const esPrimera = await reclamarPrimerUsuario(email);

      const { clave, sal } = await derivarContrasena(contrasena);
      const creado = await crearUsuario({
        email,
        nombre,
        admin: esPrimera,
        clave,
        sal,
        creadoEn: new Date().toISOString(),
      });

      if (!creado) return json({ error: "email_ya_registrado" }, 409);

      const testigo = await abrirSesion(email);
      return conCookie({ usuario: comoPublico(creado) }, cookieSesion(testigo));
    }

    // --- Cambiar la propia contraseña ---
    if (accion === "contrasena") {
      const usuario = await usuarioDeSesion(leerCookie(req, NOMBRE_COOKIE));
      if (!usuario) return json({ error: "sin_sesion" }, 401);

      const actual = texto((cuerpo as never)["actual"]);
      const nueva = texto((cuerpo as never)["nueva"]);

      if (!(await contrasenaCoincide(actual, usuario))) {
        return json({ error: "contrasena_actual_incorrecta" }, 403);
      }
      if (nueva.length < MINIMO_CONTRASENA) {
        return json({ error: "contrasena_corta", minimo: MINIMO_CONTRASENA }, 400);
      }

      const derivada = await derivarContrasena(nueva);
      await guardarUsuario({ ...usuario, clave: derivada.clave, sal: derivada.sal });

      // Se cierran todas las sesiones, incluida esta, y se abre una nueva: así
      // cualquier sesión que hubiera quedado abierta en otro equipo se corta.
      await cerrarSesionesDe(usuario.email);
      const testigo = await abrirSesion(usuario.email);

      return conCookie({ cambiada: true }, cookieSesion(testigo));
    }

    // --- Inicio de sesión ---
    if (accion === "entrar") {
      const usuario = await buscarUsuario(email);

      // El mismo mensaje si el correo no existe o si la contraseña está mal:
      // así no se puede averiguar qué correos tienen cuenta.
      const valida = usuario
        ? await contrasenaCoincide(contrasena, usuario)
        : false;

      if (!usuario || !valida) {
        return json({ error: "credenciales_invalidas" }, 401);
      }

      const testigo = await abrirSesion(usuario.email);
      return conCookie({ usuario: comoPublico(usuario) }, cookieSesion(testigo));
    }

    return json({ error: "accion_desconocida", accion }, 404);
  } catch (err) {
    return json(
      {
        error: "fallo_autenticacion",
        detalle: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
};
