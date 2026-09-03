import { ID_BORRADOR, type InvoiceData } from "../types";
import {
  calcInvoiceTotals,
  calcItemTotals,
  formatCurrency,
  formatDateLong,
  formatNumber,
} from "../utils/calculations";
import { CLASES_CONTENIDO, aHtml } from "../utils/richText";
import LogoEmpresa from "./LogoEmpresa";

interface InvoicePreviewProps {
  data: InvoiceData;
}

const COMPANY = {
  nit: "900.227.153 - 9",
  tel: "(4) 448 3427",
  // La dirección se parte en dos líneas para que no se desborde en el
  // encabezado ni al imprimir.
  address: "Cr 34A Cl 30 · CC Premium Plaza",
  addressDetail: "Piso 4, Of. La Lonja LC 4450",
  city: "Medellín - Colombia",
  email: "comercial.digital@positivogroup.com",
};

const border = "border-slate-900";
const cell = `border ${border} px-2 py-1`;

export default function InvoicePreview({ data }: InvoicePreviewProps) {
  const totals = calcInvoiceTotals(data.items, data.ivaPorcentaje);
  const hasItems = data.items.some(
    (item) => item.nombreProducto || item.cantidad || item.precioUnitario,
  );
  // Las observaciones se guardan con formato (negrilla, viñetas, alineación).
  // `aHtml` acepta también el texto plano de las cotizaciones antiguas y deja
  // solo etiquetas de formato antes de pintarlas.
  const observacionesHtml = aHtml(data.observaciones);

  return (
    <table
      id="invoice-preview"
      // Todo el documento es una sola tabla, y no bloques sueltos, porque es
      // lo único que garantiza que las líneas verticales de cada sección caigan
      // exactamente en el mismo sitio. Cada fila ocupa las columnas que
      // necesita con colSpan, y los cortes siempre coinciden.
      className={`mx-auto w-full max-w-[900px] table-fixed border-collapse border ${border} bg-white text-[11px] leading-snug text-slate-900 shadow-lg print:shadow-none`}
    >
      <colgroup>
        <col style={{ width: "40%" }} />
        <col style={{ width: "15%" }} />
        <col style={{ width: "20%" }} />
        <col style={{ width: "25%" }} />
      </colgroup>

      <tbody>
        {/* Encabezado */}
        <tr className="break-inside-avoid">
          <td colSpan={3} className={`${cell} px-4 py-3 text-center align-middle`}>
            <p className="text-base font-bold uppercase tracking-wide">
              Cotización N.º {data.numeroFactura || "—"}
            </p>
            <div className="mt-2 space-y-0.5 text-slate-700">
              <p>NIT: {COMPANY.nit}</p>
              <p>Tel: {COMPANY.tel}</p>
              <p>{COMPANY.address}</p>
              <p>{COMPANY.addressDetail}</p>
              <p>{COMPANY.city}</p>
            </div>
          </td>
          <td className={`${cell} px-4 py-3 text-center align-middle`}>
            <LogoEmpresa className="mx-auto w-full max-w-[190px]" />
          </td>
        </tr>

        {/* Datos del cliente */}
        <tr className="break-inside-avoid">
          <td
            colSpan={4}
            className={`${cell} bg-slate-100 font-bold uppercase tracking-wide`}
          >
            Datos del cliente
          </td>
        </tr>
        <tr className="break-inside-avoid">
          <td colSpan={2} className={`${cell} space-y-1 px-3 py-2 align-top`}>
            <p>
              <span className="font-semibold">Razón Social: </span>
              {data.cliente.razonSocial || "—"}
            </p>
            <p>
              <span className="font-semibold">NIT: </span>
              {data.cliente.nit || "—"}
              <span className="ml-6 font-semibold">Contacto: </span>
              {data.cliente.contacto || "—"}
            </p>
            <p>
              <span className="font-semibold">Email: </span>
              {data.cliente.email ? (
                <span className="text-blue-700 underline">
                  {data.cliente.email}
                </span>
              ) : (
                "—"
              )}
            </p>
            {/* La marca es opcional: si no se diligenció no se muestra la
                línea, en vez de dejar un "Marca: —" que solo estorba. */}
            {(data.cliente.marca ?? "").trim() !== "" && (
              <p>
                <span className="font-semibold">Marca: </span>
                {data.cliente.marca}
              </p>
            )}
          </td>
          <td colSpan={2} className={`${cell} space-y-1 px-3 py-2 align-top`}>
            <p className="flex justify-between gap-2">
              <span className="font-semibold">FECHA:</span>
              <span className="text-right">
                {formatDateLong(data.fecha) || "—"}
              </span>
            </p>
            <p className="flex justify-between gap-2">
              <span className="font-semibold">Válida hasta:</span>
              <span className="text-right">
                {formatDateLong(data.validaHasta) || "—"}
              </span>
            </p>
            <p className="flex justify-between gap-2">
              <span className="font-semibold">Forma de Pago:</span>
              <span className="text-right">{data.formaPago || "—"}</span>
            </p>
          </td>
        </tr>

        {/* Productos */}
        <tr className="break-inside-avoid bg-slate-100 text-center font-bold uppercase">
          <td className={cell}>Nombre producto</td>
          <td className={cell}>Cantidad</td>
          <td className={cell}>Precio Unitario</td>
          <td className={cell}>
            Inversión Total
            <br />
            antes de IVA
          </td>
        </tr>

        {hasItems ? (
          data.items.map((item) => {
            const t = calcItemTotals(item, data.ivaPorcentaje);
            // El producto que se está capturando se ve igual, pero con un
            // fondo tenue: así se nota que todavía falta agregarlo.
            const enCaptura = item.id === ID_BORRADOR;
            return (
              <tr
                key={item.id}
                className={`break-inside-avoid ${enCaptura ? "bg-emerald-50/60" : ""}`}
              >
                <td className={`${cell} align-top`}>
                  <div className="font-semibold">
                    {item.nombreProducto || "—"}
                  </div>
                  {/* La descripción se edita con formato, igual que las
                      observaciones, y `aHtml` acepta también el texto plano
                      de los productos guardados antes. */}
                  {item.descripcionProducto.trim() !== "" && (
                    <div
                      className={`mt-1 font-normal text-slate-600 ${CLASES_CONTENIDO}`}
                      dangerouslySetInnerHTML={{
                        __html: aHtml(item.descripcionProducto),
                      }}
                    />
                  )}
                </td>
                {/* Un producto puede ir sin cantidad o sin precio (los
                    bonificados, por ejemplo). En ese caso la celda va con
                    raya en vez de un cero que parecería un error. */}
                <td className={`${cell} text-center align-top`}>
                  {item.cantidad > 0 ? formatNumber(item.cantidad) : "—"}
                </td>
                <td className={`${cell} text-right align-top`}>
                  {item.precioUnitario > 0
                    ? formatCurrency(item.precioUnitario)
                    : "—"}
                </td>
                <td className={`${cell} text-right align-top`}>
                  {t.inversionTotalAntesIva > 0
                    ? formatCurrency(t.inversionTotalAntesIva)
                    : "—"}
                </td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan={4} className={`${cell} py-6 text-center text-slate-400`}>
              Agrega productos en el formulario para verlos aquí
            </td>
          </tr>
        )}

        {/* IVA y total, en las dos últimas columnas */}
        <tr className="break-inside-avoid">
          <td colSpan={2} className={`${cell} border-x-0`} />
          <td className={`${cell} px-3 py-1.5`}>IVA {data.ivaPorcentaje}%</td>
          <td className={`${cell} px-3 py-1.5 text-right`}>
            {formatCurrency(totals.iva)}
          </td>
        </tr>
        <tr className="break-inside-avoid text-sm font-bold">
          <td colSpan={2} className={`${cell} border-x-0`} />
          <td className={`${cell} px-3 py-2`}>TOTAL</td>
          <td className={`${cell} px-3 py-2 text-right`}>
            {formatCurrency(totals.total)}
          </td>
        </tr>

        {/* Observaciones */}
        <tr className="break-inside-avoid">
          <td
            colSpan={4}
            className={`${cell} bg-slate-100 font-bold uppercase tracking-wide`}
          >
            Observaciones
          </td>
        </tr>
        <tr>
          <td colSpan={4} className={`${cell} px-3 py-2`}>
            {observacionesHtml ? (
              <div
                className={`${CLASES_CONTENIDO} [&_hr]:my-3 [&_hr]:border-slate-900`}
                dangerouslySetInnerHTML={{ __html: observacionesHtml }}
              />
            ) : (
              <p className="text-slate-400">—</p>
            )}
          </td>
        </tr>

        {/* Firma */}
        <tr className="break-inside-avoid">
          <td colSpan={2} className={`${cell} space-y-0.5 px-4 py-4 align-top`}>
            <p className="font-semibold">Positivo Group S.A.S.</p>
            <p>Ejecutiva Comercial</p>
            <p>Tel: {COMPANY.tel}</p>
            <p>Email: {COMPANY.email}</p>
          </td>
          <td colSpan={2} className={`${cell} p-0 align-top`}>
            <div
              className={`border-b ${border} px-2 py-1 text-center font-bold uppercase tracking-wide`}
            >
              Firma Aprobado
            </div>
            <div className="space-y-4 px-3 py-3 text-slate-500">
              <p className="border-b border-slate-300 pb-1">Nombre</p>
              <p className="border-b border-slate-300 pb-1">Cargo</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
