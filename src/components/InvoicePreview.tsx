import type { InvoiceData } from "../types";
import PositivoLogo from "./PositivoLogo";
import {
  calcInvoiceTotals,
  calcItemTotals,
  formatCurrency,
  formatDateLong,
  formatNumber,
} from "../utils/calculations";

interface InvoicePreviewProps {
  data: InvoiceData;
}

const COMPANY = {
  nit: "900.227.153 - 9",
  tel: "(4) 448 3427",
  address: "Cra 43B No. 16 - 41 EDIFICIO STAFF Oficina 607",
  city: "Medellín - Colombia",
  email: "comercial.digital@positivogroup.com",
};

const border = "border-slate-900";
const cell = `border ${border} px-2 py-1`;

export default function InvoicePreview({ data }: InvoicePreviewProps) {
  const totals = calcInvoiceTotals(data.items, data.ivaPorcentaje);
  const totalCantidad = data.items.reduce((acc, i) => acc + i.cantidad, 0);
  const hasItems = data.items.some(
    (item) => item.nombreProducto || item.cantidad || item.precioUnitario,
  );
  const observacionesLineas = data.observaciones
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div
      id="invoice-preview"
      className="mx-auto w-full max-w-[900px] bg-white text-[11px] leading-snug text-slate-900 shadow-lg"
    >
      {/* Encabezado */}
      <div className={`flex break-inside-avoid border ${border}`}>
        <div className={`flex-1 border-r ${border} px-4 py-3 text-center`}>
          <p className="text-base font-bold uppercase tracking-wide">
            Cotización N.º {data.numeroFactura || "—"}
          </p>
          <div className="mt-2 space-y-0.5 text-slate-700">
            <p>NIT: {COMPANY.nit}</p>
            <p>Tel: {COMPANY.tel}</p>
            <p>{COMPANY.address}</p>
            <p>{COMPANY.city}</p>
          </div>
        </div>
        <div className="flex w-56 shrink-0 items-center justify-center px-4 py-3">
          <PositivoLogo showTagline />
        </div>
      </div>

      {/* Datos del cliente */}
      <div className={`break-inside-avoid border border-t-0 ${border}`}>
        <div
          className={`border-b ${border} bg-slate-100 px-2 py-1 font-bold uppercase tracking-wide`}
        >
          Datos del cliente
        </div>
        <div className="flex">
          <div className={`flex-1 space-y-1 border-r ${border} px-3 py-2`}>
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
          </div>
          <div className="w-64 shrink-0 space-y-1 px-3 py-2">
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
          </div>
        </div>
      </div>

      {/* Tabla de productos */}
      <table className={`w-full border-collapse border border-t-0 ${border}`}>
        <thead>
          <tr className="bg-slate-100 text-center font-bold uppercase">
            <th className={cell}>Nombre producto</th>
            <th className={cell}>Cantidad</th>
            <th className={cell}>Precio Unitario</th>
            <th className={cell}>
              Inversión Total
              <br />
              antes de IVA
            </th>
          </tr>
        </thead>
        <tbody>
          {hasItems ? (
            data.items.map((item) => {
              const t = calcItemTotals(item, data.ivaPorcentaje);
              return (
                <tr key={item.id}>
                  <td className={cell}>{item.nombreProducto || "—"}</td>
                  <td className={`${cell} text-center`}>
                    {formatNumber(item.cantidad)}
                  </td>
                  <td className={`${cell} text-right`}>
                    {formatCurrency(item.precioUnitario)}
                  </td>
                  <td className={`${cell} text-right`}>
                    {formatCurrency(t.inversionTotalAntesIva)}
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
          <tr className="bg-slate-50 font-bold">
            <td className={`${cell} text-right`}>SUBTOTAL</td>
            <td className={`${cell} text-center`}>
              {formatNumber(totalCantidad)}
            </td>
            <td className={cell}></td>
            <td className={`${cell} text-right`}>
              {formatCurrency(totals.subtotal)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* IVA / Total */}
      <div className={`flex break-inside-avoid justify-end border border-t-0 ${border}`}>
        <div className={`w-64 divide-y ${border} border-l`}>
          <div className="flex justify-between px-3 py-1.5">
            <span>IVA {data.ivaPorcentaje}%</span>
            <span>{formatCurrency(totals.iva)}</span>
          </div>
          <div className="flex justify-between px-3 py-2 text-sm font-bold">
            <span>TOTAL</span>
            <span>{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </div>

      {/* Observaciones */}
      <div className={`break-inside-avoid border border-t-0 ${border}`}>
        <div
          className={`border-b ${border} bg-slate-100 px-2 py-1 font-bold uppercase tracking-wide`}
        >
          Observaciones
        </div>
        <div className="px-3 py-2">
          {observacionesLineas.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4">
              {observacionesLineas.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400">—</p>
          )}
        </div>
      </div>

      {/* Firma */}
      <div
        className={`flex break-inside-avoid justify-between gap-6 border border-t-0 ${border} px-4 py-4`}
      >
        <div className="space-y-0.5">
          <p className="font-semibold">Positivo Group S.A.S.</p>
          <p>Ejecutiva Comercial</p>
          <p>Tel: {COMPANY.tel}</p>
          <p>Email: {COMPANY.email}</p>
        </div>
        <div className={`w-64 shrink-0 border ${border}`}>
          <div
            className={`border-b ${border} px-2 py-1 text-center font-bold uppercase tracking-wide`}
          >
            Firma Aprobado
          </div>
          <div className="space-y-4 px-2 py-3 text-slate-500">
            <p className="border-b border-slate-300 pb-1">Nombre</p>
            <p className="border-b border-slate-300 pb-1">Cargo</p>
          </div>
        </div>
      </div>
    </div>
  );
}
