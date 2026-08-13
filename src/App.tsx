import { useRef, useState } from "react";
import Sidebar, { type View } from "./components/Sidebar";
import InvoiceForm from "./components/InvoiceForm";
import InvoicePreview from "./components/InvoicePreview";
import { OBSERVACIONES_DEFAULT, type InvoiceData } from "./types";
import { todayIso } from "./utils/calculations";
import { nextInvoiceNumber } from "./utils/invoiceNumber";

function createInitialInvoice(): InvoiceData {
  return {
    numeroFactura: nextInvoiceNumber(),
    fecha: todayIso(),
    validaHasta: "",
    formaPago: "",
    ivaPorcentaje: 19,
    observaciones: OBSERVACIONES_DEFAULT,
    cliente: {
      razonSocial: "Positivo Group",
      nit: "",
      email: "",
      contacto: "",
    },
    items: [
      {
        id: crypto.randomUUID(),
        descripcionProducto: "",
        cantidad: 0,
        precioUnitario: 0,
      },
    ],
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
                Crear factura
              </h1>
              <p className="text-sm text-slate-500">
                Completa el formulario y la factura se genera automáticamente
                a la derecha.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
            >
              Imprimir / Guardar PDF
            </button>
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
    </div>
  );
}

export default App;
