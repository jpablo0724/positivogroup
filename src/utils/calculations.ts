import type { InvoiceItem } from "../types";

export interface ItemTotals {
  inversionTotalAntesIva: number;
  costoPorImpacto: number;
  subtotal: number;
  iva: number;
  total: number;
}

export function calcItemTotals(
  item: InvoiceItem,
  ivaPorcentaje: number,
): ItemTotals {
  const inversionTotalAntesIva = item.cantidad * item.precioUnitario;
  const costoPorImpacto =
    item.impactosPromedio15Dias > 0
      ? inversionTotalAntesIva / item.impactosPromedio15Dias
      : 0;
  const subtotal = inversionTotalAntesIva;
  const iva = subtotal * (ivaPorcentaje / 100);
  const total = subtotal + iva;

  return { inversionTotalAntesIva, costoPorImpacto, subtotal, iva, total };
}

export interface InvoiceTotals {
  subtotal: number;
  iva: number;
  total: number;
}

export function calcInvoiceTotals(
  items: InvoiceItem[],
  ivaPorcentaje: number,
): InvoiceTotals {
  return items.reduce(
    (acc, item) => {
      const { subtotal, iva, total } = calcItemTotals(item, ivaPorcentaje);
      return {
        subtotal: acc.subtotal + subtotal,
        iva: acc.iva + iva,
        total: acc.total + total,
      };
    },
    { subtotal: 0, iva: 0, total: 0 },
  );
}

export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "$ 0";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyPrecise(value: number): string {
  if (!Number.isFinite(value)) return "$ 0,0";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("es-CO").format(value);
}

export function formatDateLong(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
