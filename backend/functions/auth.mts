import { randomBytes } from "node:crypto";
import { json } from "../lib/acceso.mts";
import {
  MINIMO_CONTRASENA,
  NOMBRE_COOKIE,
  abrirSesion,
  asegurarPrimerAdmin,
  buscarUsuario,
  cerrarSesion,
  comoPublico,
  consumirTokenRestablecimiento,
  contrasenaCoincide,
  cookieBorrada,
  cookieSesion,
  cambiarEmailDeCuenta,
  cerrarSesionesDe,
  crearTokenRestablecimiento,
  crearUsuario,
  derivarContrasena,
  descartarRestablecimientosDe,
  emailDeTokenRestablecimiento,
  guardarUsuario,
  leerCookie,
  listarUsuarios,
  normalizarEmail,
  reclamarPrimerUsuario,
  usuarioDeSesion,
  type Usuario,
} from "../lib/auth.mts";
import { correoConfigurado, enviarCorreo } from "../lib/correo.mts";
import { reemplazarCorreoEnCotizaciones } from "../lib/almacen.mts";

/**
 * Registro e inicio de sesión.
 *
 *   POST /api/auth/registro     -> crea la cuenta y deja la sesión abierta
 *   POST /api/auth/entrar       -> inicia sesión
 *   POST /api/auth/salir        -> cierra la sesión
 *   GET  /api/auth/sesion       -> quién está dentro
 *   POST /api/auth/perfil       -> cambia el propio nombre, apellidos, correo, teléfono y cargo
 *   POST /api/auth/olvide       -> manda un enlace por correo para restablecer la contraseña
 *   POST /api/auth/validar      -> dice si el testigo del enlace sigue sirviendo
 *   POST /api/auth/restablecer -> pone la contraseña nueva con el testigo del enlace
 *
 * El registro está cerrado: las cuentas las crea un administrador desde la
 * sección de Usuarios. La única excepción es el arranque, cuando todavía no
 * existe ninguna cuenta y hace falta crear la primera —que queda como
 * administradora— con el código de la empresa (APP_ACCESS_CODE).
 */

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

// --- Límite de pedidos de "olvidé mi contraseña" ---
//
// Sin límite, cualquiera podría llenarle el buzón a una persona pidiendo el
// enlace en bucle, o gastar el cupo diario de envíos de la cuenta de Google.
// Se lleva en memoria: el servidor es un solo proceso, y si se reinicia lo
// peor que pasa es que el contador vuelve a cero.

const VENTANA_LIMITE_MS = 15 * 60 * 1000;
const MAXIMO_POR_CORREO = 3;
const MAXIMO_POR_IP = 10;

const pedidosPorClave = new Map<string, number[]>();

/** Anota un pedido y dice si todavía está dentro del límite. */
function dentroDelLimite(clave: string, maximo: number): boolean {
  const ahora = Date.now();
  const recientes = (pedidosPorClave.get(clave) ?? []).filter(
    (momento) => ahora - momento < VENTANA_LIMITE_MS,
  );

  if (recientes.length >= maximo) {
    pedidosPorClave.set(clave, recientes);
    return false;
  }

  recientes.push(ahora);
  pedidosPorClave.set(clave, recientes);
  return true;
}

// --- Límite de intentos fallidos de inicio de sesión ---
//
// Sin límite se pueden probar contraseñas sin parar hasta dar con la buena.
// Se cuenta por cuenta (no por IP, que detrás del proxy se puede falsear):
// pasados 10 intentos fallidos en 15 minutos, esa cuenta no acepta más hasta
// que pase la ventana. Quien sí sabe la contraseña casi nunca falla 10 veces
// seguidas, y entrar bien no suma.

const MAXIMO_FALLOS_LOGIN = 10;
const fallosLogin = new Map<string, number[]>();

function fallosRecientes(email: string): number[] {
  const ahora = Date.now();
  const recientes = (fallosLogin.get(email) ?? []).filter(
    (momento) => ahora - momento < VENTANA_LIMITE_MS,
  );
  if (recientes.length === 0) fallosLogin.delete(email);
  else fallosLogin.set(email, recientes);
  return recientes;
}

function anotarFallo(email: string) {
  // Tope de memoria: si alguien prueba miles de correos inventados, se
  // descartan los más viejos en vez de crecer sin fin.
  if (fallosLogin.size > 10_000) {
    const masViejo = fallosLogin.keys().next().value;
    if (masViejo !== undefined) fallosLogin.delete(masViejo);
  }
  fallosLogin.set(email, [...fallosRecientes(email), Date.now()]);
}

// Contraseña de nadie, para gastar el mismo tiempo cuando el correo no
// existe. Si no, la respuesta rápida delataría qué correos tienen cuenta.
const usuarioFicticio: Promise<Usuario> = derivarContrasena(
  randomBytes(16).toString("hex"),
).then((derivada) => ({ email: "", nombre: "", creadoEn: "", ...derivada }));

/**
 * Tope de largo de una contraseña. Derivar una de varios megas ocupa el
 * procesador un buen rato; nadie usa una de más de 256 caracteres.
 */
const MAXIMO_CONTRASENA = 256;

function contrasenaLarga() {
  return json(
    {
      error: "contrasena_larga",
      mensaje: `La contraseña no puede tener más de ${MAXIMO_CONTRASENA} caracteres.`,
    },
    400,
  );
}

/** IP de quien pide. Detrás del proxy de Hostinger la dice x-forwarded-for. */
function ipDe(req: Request): string {
  const reenviada = req.headers.get("x-forwarded-for") ?? "";
  return reenviada.split(",")[0].trim() || "desconocida";
}

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * El correo con el enlace. Va en tablas y estilos en línea porque es lo único
 * que Gmail y Outlook respetan; el degradado de la marca lleva un color sólido
 * detrás para los clientes que no lo pintan.
 */
function correoRestablecimiento(nombre: string, enlace: string) {
  const saludo = nombre ? `Hola ${escaparHtml(nombre)},` : "Hola,";
  const enlaceHtml = escaparHtml(enlace);

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#141624;padding:24px 32px;color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:1px;">
          POSITIVO GROUP
        </td></tr>
        <tr><td style="padding:32px;color:#0f172a;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 16px;">${saludo}</p>
          <p style="margin:0 0 24px;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en la intranet. Haz clic en el botón para crear una nueva:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td style="border-radius:8px;background:#ff0856;background-image:linear-gradient(90deg,#ff0856 0%,#c8007f 100%);">
            <a href="${enlaceHtml}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-weight:bold;text-decoration:none;font-size:15px;">Crear contraseña nueva</a>
          </td></tr></table>
          <p style="margin:0 0 8px;font-size:13px;color:#475569;">El enlace vale por <strong>1 hora</strong> y se puede usar una sola vez.</p>
          <p style="margin:0 0 24px;font-size:13px;color:#475569;">Si no fuiste tú, ignora este correo: tu contraseña no cambia.</p>
          <p style="margin:0;font-size:12px;color:#94a3b8;word-break:break-all;">Si el botón no funciona, copia esta dirección en el navegador:<br><a href="${enlaceHtml}" style="color:#64748b;">${enlaceHtml}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const texto =
    `${nombre ? `Hola ${nombre},` : "Hola,"}\n\n` +
    "Recibimos una solicitud para restablecer la contraseña de tu cuenta en la intranet de Positivo Group.\n\n" +
    `Abre este enlace para crear una nueva:\n${enlace}\n\n` +
    "El enlace vale por 1 hora y se puede usar una sola vez.\n" +
    "Si no fuiste tú, ignora este correo: tu contraseña no cambia.\n";

  return { html, texto };
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
      if (!usuario) {
        // La pantalla de acceso necesita saber si el sistema está recién
        // instalado: en ese caso, y solo en ese, ofrece crear la primera
        // cuenta en vez de únicamente iniciar sesión.
        const cuentas = await listarUsuarios();
        return json({ error: "sin_sesion", sinCuentas: cuentas.length === 0 }, 401);
      }

      // Aquí, porque es lo que se consulta al abrir la página: si el sistema
      // se quedó sin administrador, se repara antes de decir quién es quién.
      await asegurarPrimerAdmin();

      const alDia = (await buscarUsuario(usuario.email)) ?? usuario;
      return json({ usuario: comoPublico(alDia) });
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
              "el servidor, que es el código con el que se autoriza el registro.",
          },
          503,
        );
      }

      // El registro solo existe para crear la primera cuenta. A partir de ahí
      // las crea un administrador desde Usuarios, con su rol y sus permisos.
      const cuentas = await listarUsuarios();
      if (cuentas.length > 0) {
        return json(
          {
            error: "registro_cerrado",
            mensaje:
              "Las cuentas las crea un administrador desde la sección de " +
              "Usuarios. Pídele que te cree la tuya.",
          },
          403,
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
      if (contrasena.length > MAXIMO_CONTRASENA) return contrasenaLarga();
      if (codigo !== codigoEmpresa) {
        return json({ error: "codigo_empresa_invalido" }, 403);
      }

      // Reclamar el puesto de primera cuenta es lo que resuelve dos registros
      // simultáneos: solo uno lo consigue.
      const esPrimera = await reclamarPrimerUsuario(email);
      if (!esPrimera) return json({ error: "registro_cerrado" }, 403);

      const { clave, sal } = await derivarContrasena(contrasena);
      const creado = await crearUsuario({
        email,
        nombre,
        apellidos: texto((cuerpo as never)["apellidos"]).trim(),
        rol: "admin",
        admin: true,
        clave,
        sal,
        creadoEn: new Date().toISOString(),
      });

      if (!creado) return json({ error: "email_ya_registrado" }, 409);

      const testigo = await abrirSesion(email);
      return conCookie({ usuario: comoPublico(creado) }, cookieSesion(testigo));
    }

    // --- Olvidé mi contraseña: manda el enlace de restablecimiento ---
    //
    // Siempre responde igual, exista o no la cuenta: así no se puede
    // averiguar qué correos tienen cuenta con solo mirar la respuesta.
    if (accion === "olvide") {
      if (!EMAIL_VALIDO.test(email)) return json({ error: "email_invalido" }, 400);

      // Antes de mirar si la cuenta existe: si el aviso de "sin servidor de
      // correo" solo saliera para las cuentas que existen, delataría cuáles
      // son.
      if (!correoConfigurado()) {
        return json(
          {
            error: "correo_no_configurado",
            mensaje:
              "El envío de correos no está configurado todavía. Pídele a un " +
              "administrador que te restablezca la contraseña.",
          },
          503,
        );
      }

      if (!dentroDelLimite(`ip:${ipDe(req)}`, MAXIMO_POR_IP)) {
        return json(
          {
            error: "demasiados_intentos",
            mensaje:
              "Pediste el enlace demasiadas veces. Espera unos minutos y " +
              "vuelve a intentarlo.",
          },
          429,
        );
      }

      // Pasado el límite por correo no se avisa: se responde como siempre y
      // simplemente no se manda nada más. Así no sirve para saber qué correos
      // tienen cuenta ni para inundar un buzón.
      const usuario = await buscarUsuario(email);
      if (usuario && dentroDelLimite(`correo:${usuario.email}`, MAXIMO_POR_CORREO)) {
        const testigo = await crearTokenRestablecimiento(usuario.email);
        const base = (process.env.SITE_URL || url.origin).trim().replace(/\/+$/, "");
        const enlace = `${base}/restablecer?token=${testigo}`;
        const { html, texto: textoPlano } = correoRestablecimiento(
          usuario.nombre,
          enlace,
        );

        try {
          await enviarCorreo({
            para: usuario.email,
            asunto: "Restablece tu contraseña — Intranet Positivo Group",
            html,
            texto: textoPlano,
          });
        } catch (err) {
          // El detalle (usuario o clave del SMTP rechazados, etc.) queda en el
          // registro del servidor, no en la pantalla de quien lo pidió.
          console.error("No se pudo enviar el correo de restablecimiento:", err);
          await consumirTokenRestablecimiento(testigo);
          return json(
            {
              error: "correo_no_enviado",
              mensaje:
                "No se pudo enviar el correo en este momento. Inténtalo más " +
                "tarde o pídele a un administrador que te restablezca la " +
                "contraseña.",
            },
            502,
          );
        }
      }

      return json({ enviado: true });
    }

    // --- ¿El enlace todavía sirve? ---
    //
    // La página del enlace lo pregunta al abrirse, para decir de entrada que
    // venció en vez de dejar que la persona escriba la contraseña para nada.
    // No lo consume.
    if (accion === "validar") {
      const testigo = texto((cuerpo as never)["token"]);
      const correoDeCuenta = await emailDeTokenRestablecimiento(testigo);
      return json({ valido: correoDeCuenta !== null });
    }

    // --- Restablecer la contraseña con el testigo del enlace ---
    if (accion === "restablecer") {
      const testigo = texto((cuerpo as never)["token"]);
      const nueva = texto((cuerpo as never)["nueva"]);

      const correoDeCuenta = await emailDeTokenRestablecimiento(testigo);
      if (!correoDeCuenta) {
        return json({ error: "token_invalido" }, 400);
      }
      if (nueva.length < MINIMO_CONTRASENA) {
        return json({ error: "contrasena_corta", minimo: MINIMO_CONTRASENA }, 400);
      }
      if (nueva.length > MAXIMO_CONTRASENA) return contrasenaLarga();

      const usuario = await buscarUsuario(correoDeCuenta);
      if (!usuario) {
        await consumirTokenRestablecimiento(testigo);
        return json({ error: "token_invalido" }, 400);
      }

      const derivada = await derivarContrasena(nueva);
      await guardarUsuario({ ...usuario, clave: derivada.clave, sal: derivada.sal });
      // Este enlace y cualquier otro que hubiera pedido antes.
      await descartarRestablecimientosDe(usuario.email);

      // Igual que al cambiar la contraseña desde el perfil: se cierran todas
      // las sesiones abiertas y se deja una nueva, ya restablecida.
      await cerrarSesionesDe(usuario.email);
      const testigoSesion = await abrirSesion(usuario.email);

      return conCookie({ restablecida: true }, cookieSesion(testigoSesion));
    }

    // --- Cambiar los propios datos ---
    //
    // Cualquier cuenta con sesión puede cambiar sus propios datos, no solo un
    // administrador: son suyos.
    //
    // El correo también se puede cambiar, pero es la clave con la que el
    // sistema identifica la cuenta —el inicio de sesión, el autor de cada
    // cotización, a quién se reasignó—, así que cambiarlo mueve todo eso al
    // correo nuevo (ver cambiarEmailDeCuenta). Por ser el dato con el que se
    // entra, exige la contraseña actual, igual que cambiar la contraseña.
    if (accion === "perfil") {
      const usuario = await usuarioDeSesion(leerCookie(req, NOMBRE_COOKIE));
      if (!usuario) return json({ error: "sin_sesion" }, 401);

      const nombre = texto((cuerpo as never)["nombre"]).trim();
      if (nombre === "") {
        return json({ error: "falta_nombre", mensaje: "Escribe tu nombre." }, 400);
      }

      const datos = {
        ...usuario,
        nombre,
        apellidos: texto((cuerpo as never)["apellidos"]).trim(),
        telefono: texto((cuerpo as never)["telefono"]).trim(),
        cargo: texto((cuerpo as never)["cargo"]).trim(),
      };

      const pedido = texto((cuerpo as never)["email"]);
      const emailNuevo = pedido.trim() === "" ? usuario.email : normalizarEmail(pedido);

      if (emailNuevo === usuario.email) {
        await guardarUsuario(datos);
        return json({ usuario: comoPublico(datos) });
      }

      if (!EMAIL_VALIDO.test(emailNuevo)) {
        return json(
          { error: "email_invalido", mensaje: "El correo nuevo no es válido." },
          400,
        );
      }
      const contrasena = texto((cuerpo as never)["contrasena"]);
      if (!(await contrasenaCoincide(contrasena, usuario))) {
        return json(
          {
            error: "contrasena_actual_incorrecta",
            mensaje: "La contraseña actual no es correcta.",
          },
          403,
        );
      }

      const movido = await cambiarEmailDeCuenta(datos, emailNuevo, async () => {
        await reemplazarCorreoEnCotizaciones(usuario.email, emailNuevo);
      });
      if (!movido) {
        return json(
          {
            error: "email_ya_registrado",
            mensaje: "Ese correo ya pertenece a otra cuenta.",
          },
          409,
        );
      }

      return json({ usuario: comoPublico(movido), emailAnterior: usuario.email });
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
      if (nueva.length > MAXIMO_CONTRASENA) return contrasenaLarga();

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
      if (fallosRecientes(email).length >= MAXIMO_FALLOS_LOGIN) {
        return json(
          {
            error: "demasiados_intentos",
            mensaje:
              "Demasiados intentos fallidos con este correo. Espera 15 " +
              "minutos o usa \"¿Olvidaste tu contraseña?\".",
          },
          429,
        );
      }

      const usuario =
        contrasena.length <= MAXIMO_CONTRASENA ? await buscarUsuario(email) : null;

      // El mismo mensaje si el correo no existe o si la contraseña está mal:
      // así no se puede averiguar qué correos tienen cuenta.
      const valida = usuario
        ? await contrasenaCoincide(contrasena, usuario)
        : await contrasenaCoincide(
            contrasena.slice(0, MAXIMO_CONTRASENA),
            await usuarioFicticio,
          ).then(() => false);

      if (!usuario || !valida) {
        anotarFallo(email);
        return json({ error: "credenciales_invalidas" }, 401);
      }

      fallosLogin.delete(email);
      const testigo = await abrirSesion(usuario.email);
      return conCookie({ usuario: comoPublico(usuario) }, cookieSesion(testigo));
    }

    return json({ error: "accion_desconocida", accion }, 404);
  } catch (err) {
    // El detalle queda en el registro del servidor, no en la pantalla:
    // puede traer datos internos de la base de datos o del sistema.
    console.error("fallo_autenticacion:", err);
    return json({ error: "fallo_autenticacion" }, 502);
  }
};
