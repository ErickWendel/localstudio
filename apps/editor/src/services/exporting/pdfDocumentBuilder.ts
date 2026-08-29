import { jsPDF } from 'jspdf';
import type { PdfExportPage } from './pdfExportService';

function getPageFormat(page: PdfExportPage): [number, number] {
  return [page.widthPoints, page.heightPoints];
}

function createArrayBuffer(
  pages: PdfExportPage[],
  onProgress?: (current: number, total: number) => void,
) {
  const firstPage = pages[0];
  if (!firstPage) throw new Error('A PDF export needs at least one slide.');
  const firstFormat = getPageFormat(firstPage);
  const document = new jsPDF({
    compress: true,
    format: firstFormat,
    orientation: firstPage.widthPoints >= firstPage.heightPoints ? 'landscape' : 'portrait',
    unit: 'pt',
  });
  pages.forEach((page, index) => {
    const format = getPageFormat(page);
    if (index > 0) {
      document.addPage(format, page.widthPoints >= page.heightPoints ? 'landscape' : 'portrait');
    }
    document.addImage(page.bytes, 'PNG', 0, 0, format[0], format[1], undefined, 'FAST');
    onProgress?.(index + 1, pages.length);
  });
  return document.output('arraybuffer');
}

export const pdfDocumentBuilder = { createArrayBuffer };
