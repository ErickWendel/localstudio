import { jsPDF } from 'jspdf';

export interface PdfExportPage {
  bytes: Uint8Array;
  heightPoints: number;
  widthPoints: number;
}

function getPageFormat(page: PdfExportPage): [number, number] {
  return [page.widthPoints, page.heightPoints];
}

export const pdfExportService = {
  createBlob(pages: PdfExportPage[]) {
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
        document.addPage(
          format,
          page.widthPoints >= page.heightPoints ? 'landscape' : 'portrait',
        );
      }
      document.addImage(page.bytes, 'PNG', 0, 0, format[0], format[1], undefined, 'FAST');
    });

    return document.output('blob');
  },
};
