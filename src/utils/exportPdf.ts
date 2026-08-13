import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

export function sanitizeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}

export async function exportElementToPdf(
  elementId: string,
  filename: string,
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`No se encontró el elemento #${elementId} para exportar`);
  }

  const canvas = await html2canvas(element, {
    scale: 1.5,
    backgroundColor: "#ffffff",
    useCORS: true,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // Tolerancia de 2mm para que un sobrante mínimo por redondeo no genere
  // una página extra casi en blanco.
  const totalPages = Math.max(1, Math.ceil((imgHeight - 2) / pageHeight));

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();
    const position = -page * pageHeight;
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
  }

  pdf.save(filename);
}
