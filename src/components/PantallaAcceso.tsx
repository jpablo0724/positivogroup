import { useState } from "react";
import LogoEmpresa from "./LogoEmpresa";
import { BackendNoDisponible, ErrorApi, SinSesion } from "../utils/api";
import {
  MINIMO_CONTRASENA,
  entrar,
  pedirRestablecimiento,
  registrarse,
  type UsuarioPublico,
} from "../utils/auth";
import { selectTriggerClass } from "./SearchableSelect";

interface PantallaAccesoProps {
  onEntrar: (usuario: UsuarioPublico) => void;
  /** Mensaje de por qué se volvió a pedir el ingreso, si aplica. */
  aviso?: string | null;
  /**
   * El sistema no tiene ninguna cuenta todavía. Solo entonces se ofrece crear
   * una: es la del primer administrador, que a partir de ahí crea las demás
   * desde la sección de Usuarios.
   */
  sinCuentas?: boolean;
}

const labelClass = "mb-1 block text-xs font-medium text-slate-600";

/** Traduce los códigos del backend a algo que se entienda. */
function mensajeDeError(err: unknown): string {
  if (err instanceof SinSesion) {
    return "Correo o contraseña incorrectos.";
  }

  if (err instanceof ErrorApi) {
    switch (err.codigo) {
      case "credenciales_invalidas":
        return "Correo o contraseña incorrectos.";
      case "codigo_empresa_invalido":
        return "El código de la empresa no es correcto. Pídeselo al administrador.";
      case "email_ya_registrado":
        return "Ese correo ya tiene una cuenta. Inicia sesión.";
      case "registro_cerrado":
        return err.message;
      case "contrasena_corta":
        return `La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres.`;
      case "email_invalido":
        return "Escribe un correo válido.";
      case "falta_nombre":
        return "Escribe tu nombre.";
      case "demasiados_intentos":
      case "correo_no_configurado":
      case "correo_no_enviado":
        return err.message;
      default:
        return err.message;
    }
  }

  if (err instanceof BackendNoDisponible) return err.message;
  return "No se pudo completar la operación.";
}

/**
 * "Olvidé mi contraseña": pide el correo y manda el enlace. Al terminar dice
 * lo mismo exista o no la cuenta, igual que el servidor.
 */
function FormularioOlvide({
  emailInicial,
  onVolver,
}: {
  emailInicial: string;
  onVolver: (email: string) => void;
}) {
  const [email, setEmail] = useState(emailInicial);
  const [ocupado, setOcupado] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (email.trim() === "" || ocupado) return;

    setOcupado(true);
    setError(null);

    try {
      await pedirRestablecimiento(email.trim());
      setEnviado(true);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-marca p-4">
      <form
        onSubmit={enviar}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl"
      >
        <LogoEmpresa />
        <h1 className="mt-6 text-lg font-semibold text-slate-900">
          Recuperar contraseña
        </h1>

        {enviado ? (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            Si <strong>{email.trim()}</strong> tiene una cuenta, te llegará un
            correo con un enlace para crear una contraseña nueva. Vale por una
            hora. Revisa también la carpeta de spam.
          </p>
        ) : (
          <>
            <p className="mt-2 text-xs text-slate-500">
              Escribe el correo con el que entras y te enviaremos un enlace
              para crear una contraseña nueva.
            </p>

            <div className="mt-5">
              <label className={labelClass}>Correo</label>
              <input
                type="email"
                autoFocus
                autoComplete="email"
                className={selectTriggerClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@positivogroup.com"
              />
            </div>

            {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={email.trim() === "" || ocupado}
              className="mt-5 w-full rounded-md boton-accion py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed"
            >
              {ocupado ? "Enviando…" : "Enviar enlace"}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => onVolver(email)}
          className="mt-4 w-full text-center text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          ← Volver a iniciar sesión
        </button>
      </form>
    </div>
  );
}

export default function PantallaAcceso({
  onEntrar,
  aviso,
  sinCuentas = false,
}: PantallaAccesoProps) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [olvido, setOlvido] = useState(false);

  // Ya no hay pestaña de registro: o el sistema está vacío y hay que crear la
  // primera cuenta, o se inicia sesión con una que creó un administrador.
  const registrando = sinCuentas;

  const completo =
    email.trim() !== "" &&
    contrasena !== "" &&
    (!registrando || (nombre.trim() !== "" && codigo !== ""));

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!completo || ocupado) return;

    setOcupado(true);
    setError(null);

    try {
      const usuario = registrando
        ? await registrarse({ nombre, email, contrasena, codigo })
        : await entrar(email, contrasena);
      onEntrar(usuario);
    } catch (err) {
      setError(mensajeDeError(err));
      setOcupado(false);
    }
  }

  if (olvido) {
    return (
      <FormularioOlvide
        emailInicial={email}
        onVolver={(correo) => {
          setEmail(correo);
          setError(null);
          setOlvido(false);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-marca p-4">
      <form
        onSubmit={enviar}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl"
      >
        <LogoEmpresa />
        <h1 className="mt-6 text-lg font-semibold text-slate-900">
          Sistema de cotizaciones
        </h1>

        {registrando && (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            No hay ninguna cuenta todavía. La que crees aquí queda como
            administradora y desde ella se dan de alta las demás.
          </p>
        )}

        {aviso && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {aviso}
          </p>
        )}

        <div className="mt-5 space-y-3">
          {registrando && (
            <div>
              <label className={labelClass}>Nombre</label>
              <input
                autoFocus
                className={selectTriggerClass}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre y apellido"
              />
            </div>
          )}

          <div>
            <label className={labelClass}>Correo</label>
            <input
              type="email"
              autoFocus={!registrando}
              autoComplete="email"
              className={selectTriggerClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@positivogroup.com"
            />
          </div>

          <div>
            <label className={labelClass}>Contraseña</label>
            <input
              type="password"
              autoComplete={registrando ? "new-password" : "current-password"}
              className={selectTriggerClass}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder={
                registrando ? `Mínimo ${MINIMO_CONTRASENA} caracteres` : ""
              }
            />
            {!registrando && (
              <button
                type="button"
                onClick={() => setOlvido(true)}
                className="mt-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </div>

          {registrando && (
            <div>
              <label className={labelClass}>Código de la empresa</label>
              <input
                type="password"
                className={selectTriggerClass}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Te lo da el administrador"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Se pide una sola vez, al crear la cuenta.
              </p>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={!completo || ocupado}
          className="mt-5 w-full rounded-md boton-accion py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed"
        >
          {ocupado
            ? "Un momento…"
            : registrando
              ? "Crear cuenta"
              : "Entrar"}
        </button>
      </form>
    </div>
  );
}
