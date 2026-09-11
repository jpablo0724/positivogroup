import { useCallback, useEffect, useState } from "react";
import Sidebar, { type View } from "./components/Sidebar";
import InvoiceForm from "./components/InvoiceForm";
import InvoicePreview from "./components/InvoicePreview";
import ListadoCotizaciones from "./components/ListadoCotizaciones";
import CatalogoProductos from "./components/CatalogoProductos";
import AdminUsuarios from "./components/AdminUsuarios";
import Informes from "./components/Informes";
import ModalContrasena from "./components/ModalContrasena";
import ModalPerfil from "./components/ModalPerfil";
import VistaImpresion from "./components/VistaImpresion";
import ModalEnviarClientify from "./components/ModalEnviarClientify";
import CotizacionPublica from "./components/CotizacionPublica";
import PantallaAcceso from "./components/PantallaAcceso";
import AvisoDatosLocales from "./components/AvisoDatosLocales";
import {
  ID_BORRADOR,
  type CotizacionGuardada,
  type CreadorFirma,
  type InvoiceData,
  type InvoiceItem,
} from "./types";
import { todayIso } from "./utils/calculations";
import { apartarNumero, numeroProvisional } from "./utils/invoiceNumber";
import { SinSesion } from "./utils/api";
import { nombreCompleto, salir, sesionActual, type UsuarioPublico } from "./utils/auth";
import {
  eliminarCotizacion,
  guardarCotizacion,
  listarCotizaciones,
  listarEquipo,
  reasignarCotizacion,
  registrarEnvioClientify,
  type MiembroEquipo,
} from "./utils/cotizacionesGuardadas";
import {
  datosLocalesPendientes,
  type DatosLocales,
} from "./utils/migracion";
import { listarProductos, type Producto } from "./utils/catalogo";

function cotizacionEnBlanco(numeroFactura: string): InvoiceData {
  return {
    numeroFactura,
    fecha: todayIso(),
    validaHasta: "",
    formaPago: "",
    ivaPorcentaje: 19,
    observaciones: "",
    cliente: { razonSocial: "", nit: "", email: "", contacto: "" },
    items: [],
  };
}

/** Testigo del enlace público si la dirección es /c/<testigo>, o null. */
function testigoPublico(): string | null {
  const coincide = /^\/c\/([A-Za-z0-9_-]+)\/?$/.exec(window.location.pathname);
  return coincide ? coincide[1] : null;
}

function App() {
  // La cotización que ve el cliente no pasa por el login: quien recibe el
  // enlace no tiene cuenta. Se resuelve antes que nada.
  const [testigo] = useState<string | null>(testigoPublico);
  // undefined = todavía se está preguntando al servidor; null = sin sesión.
  const [sinCuentas, setSinCuentas] = useState(false);
  const [usuario, setUsuario] = useState<UsuarioPublico | null | undefined>(
    undefined,
  );
  const [avisoAcceso, setAvisoAcceso] = useState<string | null>(null);
  const [modalContrasena, setModalContrasena] = useState(false);
  const [modalPerfil, setModalPerfil] = useState(false);
  // Cotización que se está viendo a página completa para guardarla en PDF.
  const [paraImprimir, setParaImprimir] = useState<InvoiceData | null>(null);
  // Quién la creó, para la firma del PDF. undefined = no se sabe (se cae a
  // los datos de la propia cuenta).
  const [paraImprimirCreadoPor, setParaImprimirCreadoPor] = useState<
    string | undefined
  >(undefined);
  // Cotización que se va a anotar en la ficha de la empresa en Clientify.
  const [paraClientify, setParaClientify] = useState<InvoiceData | null>(null);
  // Quién la creó, para que la nota en Clientify quede a su nombre.
  const [paraClientifyCreadoPor, setParaClientifyCreadoPor] = useState<
    string | undefined
  >(undefined);

  const [activeView, setActiveView] = useState<View>("crear-factura");
  const [invoice, setInvoice] = useState<InvoiceData>(() =>
    cotizacionEnBlanco(""),
  );
  // Quién creó la cotización que está en el formulario, para la firma en la
  // vista previa. undefined = es una cotización nueva: firma quien tiene la
  // sesión abierta.
  const [invoiceCreadoPor, setInvoiceCreadoPor] = useState<
    string | undefined
  >(undefined);
  // Mientras es false, el número que se muestra es provisional y se aparta de
  // verdad al guardar. Al abrir una cotización ya guardada pasa a true, para
  // que volver a guardarla la actualice en vez de consumir otro número.
  const [numeroAsignado, setNumeroAsignado] = useState(false);

  const [cotizaciones, setCotizaciones] = useState<CotizacionGuardada[]>([]);
  // Nombre, teléfono y correo de cada cuenta, para armar la firma de quien
  // creó cada cotización en el documento.
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  // Catálogo completo, compartido entre el formulario y la vista de productos.
  const [productos, setProductos] = useState<Producto[]>([]);
  // Productos tal como se ven en la cotización, incluyendo el que se está
  // capturando en el formulario y todavía no se ha agregado.
  const [itemsVistaPrevia, setItemsVistaPrevia] = useState<InvoiceItem[]>([]);
  const [pendientes, setPendientes] = useState<DatosLocales | null>(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardadoMensaje, setGuardadoMensaje] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Un 401 significa que la sesión venció: se vuelve a pedir el ingreso. */
  const manejarError = useCallback((err: unknown) => {
    if (err instanceof SinSesion) {
      setUsuario(null);
      setAvisoAcceso("Tu sesión venció. Vuelve a iniciar sesión.");
      return;
    }
    setError(err instanceof Error ? err.message : String(err));
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [lista, catalogo, numero, cuentas] = await Promise.all([
        listarCotizaciones(),
        listarProductos(),
        numeroProvisional(),
        listarEquipo(),
      ]);
      setCotizaciones(lista);
      setProductos(catalogo);
      setEquipo(cuentas);
      setInvoice(cotizacionEnBlanco(numero));
      setInvoiceCreadoPor(undefined);
      setNumeroAsignado(false);
      setPendientes(datosLocalesPendientes());
    } catch (err) {
      manejarError(err);
    } finally {
      setCargando(false);
    }
  }, [manejarError]);

  /**
   * Quién firma la cotización en el documento: se busca en el equipo por
   * correo y, si no se encuentra (cotización nueva, o de antes de que
   * existiera este dato), firma quien tiene la sesión abierta.
   */
  function resolverCreador(email: string | undefined): CreadorFirma | null {
    const correo = email ?? usuario?.email;
    if (!correo) return null;

    const miembro = equipo.find((m) => m.email === correo);
    if (miembro) {
      return {
        nombre: nombreCompleto(miembro),
        telefono: miembro.telefono,
        correo: miembro.email,
        cargo: miembro.cargo,
      };
    }

    if (usuario && correo === usuario.email) {
      return {
        nombre: nombreCompleto(usuario),
        telefono: usuario.telefono,
        correo: usuario.email,
        cargo: usuario.cargo,
      };
    }

    return { nombre: "", telefono: "", correo, cargo: "" };
  }

  // Al abrir la página se le pregunta al servidor si la cookie sigue valiendo.
  useEffect(() => {
    let cancelado = false;
    sesionActual().then((estado) => {
      if (cancelado) return;
      setUsuario(estado.usuario);
      setSinCuentas(estado.sinCuentas);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (usuario === undefined) return;
    if (usuario === null) {
      setCargando(false);
      return;
    }
    void cargar();
  }, [usuario, cargar]);

  // Red de seguridad además del reinicio en entrar(): si la cuenta pierde el
  // permiso de la vista en la que está (por ejemplo, otro administrador se lo
  // quita mientras la tiene abierta), no debe quedar viendo una pantalla en
  // blanco. Crear cotización no pide permiso, así que siempre es válida.
  useEffect(() => {
    if (!usuario) return;
    const permiso: Partial<Record<View, boolean>> = {
      "listado-cotizaciones": usuario.permisos.cotizaciones,
      "catalogo-productos": usuario.permisos.catalogo,
      "admin-usuarios": usuario.permisos.usuarios,
      informes: usuario.permisos.informes,
    };
    if (permiso[activeView] === false) setActiveView("crear-factura");
  }, [usuario, activeView]);

  function entrar(quien: UsuarioPublico) {
    setAvisoAcceso(null);
    setUsuario(quien);
    // Crear cotización no pide permiso, así que siempre es una vista válida.
    // Sin este reinicio, si la sesión anterior se quedó en una pantalla que la
    // cuenta que entra ahora no tiene permitida (Usuarios, Catálogo), el
    // contenido queda en blanco: el "activeView" no cambia solo al cambiar de
    // usuario, y ninguno de los bloques de más abajo tiene por qué renderizar.
    setActiveView("crear-factura");
  }

  async function handleSalir() {
    try {
      await salir();
    } catch {
      // Aunque falle la petición, en este navegador se cierra igual.
    }
    setUsuario(null);
    setAvisoAcceso(null);
    setCotizaciones([]);
    setProductos([]);
  }

  async function handleGuardar() {
    if (guardando) return;
    setGuardando(true);
    setError(null);

    try {
      // El número se aparta aquí, no al abrir el formulario, para no dejar
      // huecos en la secuencia cuando alguien entra y no guarda.
      const numeroFactura = numeroAsignado
        ? invoice.numeroFactura
        : await apartarNumero();

      // Lo que se ve en la cotización es lo que se guarda: si hay un producto
      // capturado sin agregar, entra igual, con un id definitivo.
      const items = itemsVistaPrevia.map((item) =>
        item.id === ID_BORRADOR ? { ...item, id: crypto.randomUUID() } : item,
      );

      const lista = await guardarCotizacion({
        ...invoice,
        numeroFactura,
        items,
      });
      setCotizaciones(lista);
      setGuardadoMensaje(true);
      setTimeout(() => setGuardadoMensaje(false), 2500);

      setInvoice(cotizacionEnBlanco(await numeroProvisional()));
      setInvoiceCreadoPor(undefined);
      setNumeroAsignado(false);
    } catch (err) {
      manejarError(err);
    } finally {
      setGuardando(false);
    }
  }

  function handleVer(cotizacion: CotizacionGuardada) {
    setInvoice(cotizacion.data);
    setInvoiceCreadoPor(cotizacion.creadoPor);
    setNumeroAsignado(true);
    setActiveView("crear-factura");
  }

  async function handleEliminar(numeroFactura: string) {
    try {
      setCotizaciones(await eliminarCotizacion(numeroFactura));
    } catch (err) {
      manejarError(err);
    }
  }

  async function handleReasignar(numeroFactura: string, nuevoDueno: string) {
    try {
      const actualizada = await reasignarCotizacion(numeroFactura, nuevoDueno);
      setCotizaciones((previas) => {
        // El backend ya no manda a esta cuenta el listado de cotizaciones
        // que dejó de ver, así que si no es administradora y la reasignó a
        // otra persona, aquí se quita de su lista sin esperar a un refresco.
        const sigueViendola =
          usuario?.admin ||
          actualizada.reasignadoA === usuario?.email ||
          (!actualizada.reasignadoA && actualizada.creadoPor === usuario?.email);
        if (!sigueViendola) {
          return previas.filter((c) => c.data.numeroFactura !== numeroFactura);
        }
        return previas.map((c) =>
          c.data.numeroFactura === numeroFactura ? actualizada : c,
        );
      });
    } catch (err) {
      manejarError(err);
    }
  }

  /**
   * Anota en el historial que se mandó a Clientify. Se llama después de que
   * la nota ya quedó guardada allá, así que un fallo aquí no debe verse como
   * un error del envío (que sí funcionó) — solo se registra en la consola.
   */
  async function handleEnviadaClientify(numeroFactura: string) {
    try {
      const actualizada = await registrarEnvioClientify(numeroFactura);
      setCotizaciones((previas) =>
        previas.map((c) =>
          c.data.numeroFactura === numeroFactura ? actualizada : c,
        ),
      );
    } catch (err) {
      console.error("No se pudo anotar el envío a Clientify en el historial", err);
    }
  }

  if (testigo) return <CotizacionPublica testigo={testigo} />;

  if (usuario === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-marca">
        <p className="text-sm text-slate-400">Cargando…</p>
      </div>
    );
  }

  if (usuario === null) {
    return (
      <PantallaAcceso
        onEntrar={entrar}
        aviso={avisoAcceso}
        sinCuentas={sinCuentas}
      />
    );
  }

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Cargando cotizaciones…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-100 print:block">
      <div className="print:hidden">
        <Sidebar
          activeView={activeView}
          onNavigate={setActiveView}
          usuario={usuario}
          onSalir={handleSalir}
          onAbrirPerfil={() => setModalPerfil(true)}
        />
      </div>

      {activeView === "crear-factura" && (
        <main className="flex flex-1 flex-col overflow-hidden print:block print:overflow-visible">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5 print:hidden">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Crear cotización
              </h1>
              <p className="text-sm text-slate-500">
                {numeroAsignado
                  ? `Editando la cotización ${invoice.numeroFactura}.`
                  : `Se guardará como ${invoice.numeroFactura || "…"} (el número se aparta al guardar).`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {guardadoMensaje && (
                <span className="text-sm font-medium text-emerald-600">
                  Cotización guardada
                </span>
              )}
              <button
                type="button"
                onClick={handleGuardar}
                disabled={guardando}
                className="boton-accion rounded-md px-4 py-2 text-sm font-semibold shadow-sm"
              >
                {guardando ? "Guardando…" : "Guardar cotización"}
              </button>
            </div>
          </header>

          {error && (
            <p className="border-b border-red-200 bg-red-50 px-8 py-2 text-sm text-red-700 print:hidden">
              {error}
            </p>
          )}

          {pendientes && (
            <AvisoDatosLocales
              datos={pendientes}
              onListo={() => {
                setPendientes(null);
                void cargar();
              }}
              onError={manejarError}
            />
          )}

          <div className="flex flex-1 gap-6 overflow-auto p-6 print:block print:overflow-visible print:gap-0 print:p-0">
            <div className="w-[440px] shrink-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:hidden">
              <InvoiceForm
                // Al cambiar de cotización (guardar una nueva, o abrir una
                // guardada) el formulario arranca limpio.
                key={invoice.numeroFactura}
                data={invoice}
                onChange={setInvoice}
                productos={productos}
                onProductosChange={setProductos}
                onVistaPreviaChange={setItemsVistaPrevia}
                onError={manejarError}
                puedeCrearProducto={usuario.rol === "admin"}
              />
            </div>

            <div className="flex-1 overflow-auto rounded-xl bg-slate-200/60 p-6 print:overflow-visible print:bg-transparent print:p-0">
              <InvoicePreview
                data={{ ...invoice, items: itemsVistaPrevia }}
                creador={resolverCreador(invoiceCreadoPor)}
              />
            </div>
          </div>
        </main>
      )}

      {activeView === "listado-cotizaciones" && usuario.permisos.cotizaciones && (
        <main className="flex flex-1 flex-col overflow-hidden">
          <header className="border-b border-slate-200 bg-white px-8 py-5">
            <h1 className="text-xl font-semibold text-slate-900">
              Listado de Cotizaciones
            </h1>
            <p className="text-sm text-slate-500">
              Cotizaciones guardadas por todo el equipo.
            </p>
          </header>

          {error && (
            <p className="border-b border-red-200 bg-red-50 px-8 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <ListadoCotizaciones
            cotizaciones={cotizaciones}
            usuarioActual={usuario}
            onVer={handleVer}
            onVerPdf={(c) => {
              setParaImprimir(c.data);
              setParaImprimirCreadoPor(c.creadoPor);
            }}
            onEnviarClientify={(c) => {
              setParaClientify(c.data);
              setParaClientifyCreadoPor(c.creadoPor);
            }}
            onEliminar={handleEliminar}
            onReasignar={handleReasignar}
          />
        </main>
      )}

      {activeView === "admin-usuarios" && usuario.permisos.usuarios && (
        <main className="flex flex-1 flex-col overflow-hidden">
          <header className="border-b border-slate-200 bg-white px-8 py-5">
            <h1 className="text-xl font-semibold text-slate-900">Usuarios</h1>
            <p className="text-sm text-slate-500">
              Quién tiene acceso al sistema. Puedes restablecer contraseñas y
              quitarle el acceso a quien ya no deba entrar.
            </p>
          </header>

          {error && (
            <p className="border-b border-red-200 bg-red-50 px-8 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <AdminUsuarios yo={usuario} onError={manejarError} />
        </main>
      )}

      {activeView === "catalogo-productos" && usuario.permisos.catalogo && (
        <main className="flex flex-1 flex-col overflow-hidden">
          <header className="border-b border-slate-200 bg-white px-8 py-5">
            <h1 className="text-xl font-semibold text-slate-900">
              Catálogo de Productos
            </h1>
            <p className="text-sm text-slate-500">
              Los productos y sus observaciones, guardados en la base de datos.
              Lo que cambies aquí lo ve todo el equipo.
            </p>
          </header>

          {error && (
            <p className="border-b border-red-200 bg-red-50 px-8 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <CatalogoProductos
            productos={productos}
            onProductosChange={setProductos}
            onError={manejarError}
          />
        </main>
      )}

      {activeView === "informes" && usuario.permisos.informes && (
        <main className="flex flex-1 flex-col overflow-hidden">
          <header className="border-b border-slate-200 bg-white px-8 py-5">
            <h1 className="text-xl font-semibold text-slate-900">Informes</h1>
            <p className="text-sm text-slate-500">
              Contactos de Clientify por campaña, tipo, estado y estado de
              gestión.
            </p>
          </header>

          {error && (
            <p className="border-b border-red-200 bg-red-50 px-8 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Informes onError={manejarError} />
        </main>
      )}

      {modalContrasena && (
        <ModalContrasena onCerrar={() => setModalContrasena(false)} />
      )}

      {modalPerfil && usuario && (
        <ModalPerfil
          usuario={usuario}
          onCerrar={() => setModalPerfil(false)}
          onGuardado={setUsuario}
          onCambiarContrasena={() => {
            setModalPerfil(false);
            setModalContrasena(true);
          }}
        />
      )}

      {paraImprimir && (
        <VistaImpresion
          data={paraImprimir}
          creador={resolverCreador(paraImprimirCreadoPor)}
          onCerrar={() => {
            setParaImprimir(null);
            setParaImprimirCreadoPor(undefined);
          }}
          imprimirAlAbrir
        />
      )}

      {paraClientify && (
        <ModalEnviarClientify
          data={paraClientify}
          creador={resolverCreador(paraClientifyCreadoPor)}
          onCerrar={() => {
            setParaClientify(null);
            setParaClientifyCreadoPor(undefined);
          }}
          onEnviada={handleEnviadaClientify}
        />
      )}
    </div>
  );
}

export default App;
