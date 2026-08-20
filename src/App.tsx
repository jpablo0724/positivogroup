import { useCallback, useEffect, useState } from "react";
import Sidebar, { type View } from "./components/Sidebar";
import InvoiceForm from "./components/InvoiceForm";
import InvoicePreview from "./components/InvoicePreview";
import ListadoCotizaciones from "./components/ListadoCotizaciones";
import CatalogoProductos from "./components/CatalogoProductos";
import PantallaAcceso from "./components/PantallaAcceso";
import AvisoDatosLocales from "./components/AvisoDatosLocales";
import {
  ID_BORRADOR,
  type CotizacionGuardada,
  type InvoiceData,
  type InvoiceItem,
} from "./types";
import { todayIso } from "./utils/calculations";
import { apartarNumero, numeroProvisional } from "./utils/invoiceNumber";
import {
  SinAcceso,
  guardarCodigo,
  leerCodigo,
  olvidarCodigo,
} from "./utils/api";
import {
  eliminarCotizacion,
  guardarCotizacion,
  listarCotizaciones,
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

function App() {
  const [codigo, setCodigo] = useState<string | null>(() => leerCodigo() || null);
  const [avisoAcceso, setAvisoAcceso] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<View>("crear-factura");
  const [invoice, setInvoice] = useState<InvoiceData>(() =>
    cotizacionEnBlanco(""),
  );
  // Mientras es false, el número que se muestra es provisional y se aparta de
  // verdad al guardar. Al abrir una cotización ya guardada pasa a true, para
  // que volver a guardarla la actualice en vez de consumir otro número.
  const [numeroAsignado, setNumeroAsignado] = useState(false);

  const [cotizaciones, setCotizaciones] = useState<CotizacionGuardada[]>([]);
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

  /** Un 401 significa que el código dejó de servir: se vuelve a pedir. */
  const manejarError = useCallback((err: unknown) => {
    if (err instanceof SinAcceso) {
      olvidarCodigo();
      setCodigo(null);
      setAvisoAcceso("El código de acceso cambió o dejó de ser válido.");
      return;
    }
    setError(err instanceof Error ? err.message : String(err));
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [lista, catalogo, numero] = await Promise.all([
        listarCotizaciones(),
        listarProductos(),
        numeroProvisional(),
      ]);
      setCotizaciones(lista);
      setProductos(catalogo);
      setInvoice(cotizacionEnBlanco(numero));
      setNumeroAsignado(false);
      setPendientes(datosLocalesPendientes());
    } catch (err) {
      manejarError(err);
    } finally {
      setCargando(false);
    }
  }, [manejarError]);

  useEffect(() => {
    if (codigo === null) {
      setCargando(false);
      return;
    }
    void cargar();
  }, [codigo, cargar]);

  function entrar(nuevoCodigo: string) {
    guardarCodigo(nuevoCodigo);
    setAvisoAcceso(null);
    setCodigo(nuevoCodigo);
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
      setNumeroAsignado(false);
    } catch (err) {
      manejarError(err);
    } finally {
      setGuardando(false);
    }
  }

  function handleVer(cotizacion: CotizacionGuardada) {
    setInvoice(cotizacion.data);
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

  if (codigo === null) {
    return <PantallaAcceso onEntrar={entrar} aviso={avisoAcceso} />;
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
        <Sidebar activeView={activeView} onNavigate={setActiveView} />
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
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
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
              />
            </div>

            <div className="flex-1 overflow-auto rounded-xl bg-slate-200/60 p-6 print:overflow-visible print:bg-transparent print:p-0">
              <InvoicePreview data={{ ...invoice, items: itemsVistaPrevia }} />
            </div>
          </div>
        </main>
      )}

      {activeView === "listado-cotizaciones" && (
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
            onVer={handleVer}
            onEliminar={handleEliminar}
          />
        </main>
      )}

      {activeView === "catalogo-productos" && (
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
    </div>
  );
}

export default App;
