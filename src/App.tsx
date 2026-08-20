import { useRef, useState } from "react";
import Sidebar, { type View } from "./components/Sidebar";
import InvoiceForm from "./components/InvoiceForm";
import InvoicePreview from "./components/InvoicePreview";
import ListadoCotizaciones from "./components/ListadoCotizaciones";
import type { CotizacionGuardada, InvoiceData } from "./types";
import { todayIso } from "./utils/calculations";
import { nextInvoiceNumber } from "./utils/invoiceNumber";
import {
  eliminarCotizacion,
  guardarCotizacion,
  listarCotizaciones,
} from "./utils/cotizacionesGuardadas";

function createInitialInvoice(): InvoiceData {
  return {
    numeroFactura: nextInvoiceNumber(),
    fecha: todayIso(),
    validaHasta: "",
    formaPago: "",
    ivaPorcentaje: 19,
    observaciones: "",
    cliente: {
      razonSocial: "",
      nit: "",
      email: "",
      contacto: "",
    },
    items: [],
  };
}

function App() {
  const [activeView, setActiveView] = useState<View>("crear-factura");

  // Ref (no useState lazy initializer) para que StrictMode no dispare
  // nextInvoiceNumber() dos veces y salte números de la secuencia.
  const initialInvoiceRef = useRef<InvoiceData | null>(null);
  if (initialInvoiceRef.current === null) {
    initialInvoiceRef.current = createInitialInvoice();
  }
  const [invoice, setInvoice] = useState<InvoiceData>(
    initialInvoiceRef.current,
  );

  const [cotizaciones, setCotizaciones] = useState<CotizacionGuardada[]>(() =>
    listarCotizaciones(),
  );
  const [guardadoMensaje, setGuardadoMensaje] = useState(false);

  function handleGuardar() {
    setCotizaciones(guardarCotizacion(invoice));
    setGuardadoMensaje(true);
    setTimeout(() => setGuardadoMensaje(false), 2000);
    setInvoice(createInitialInvoice());
  }

  function handleVer(cotizacion: CotizacionGuardada) {
    setInvoice(cotizacion.data);
    setActiveView("crear-factura");
  }

  function handleEliminar(numeroFactura: string) {
    setCotizaciones(eliminarCotizacion(numeroFactura));
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
                Completa el formulario y la cotización se genera
                automáticamente a la derecha.
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
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
              >
                Guardar cotización
              </button>
            </div>
          </header>

          <div className="flex flex-1 gap-6 overflow-auto p-6 print:block print:overflow-visible print:gap-0 print:p-0">
            <div className="w-[440px] shrink-0 rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:hidden">
              <InvoiceForm data={invoice} onChange={setInvoice} />
            </div>

            <div className="flex-1 overflow-auto rounded-xl bg-slate-200/60 p-6 print:overflow-visible print:bg-transparent print:p-0">
              <InvoicePreview data={invoice} />
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
              Cotizaciones guardadas con el botón "Guardar cotización".
            </p>
          </header>

          <ListadoCotizaciones
            cotizaciones={cotizaciones}
            onVer={handleVer}
            onEliminar={handleEliminar}
          />
        </main>
      )}
    </div>
  );
}

export default App;
