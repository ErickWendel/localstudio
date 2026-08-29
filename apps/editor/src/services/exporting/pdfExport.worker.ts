import type { PdfExportPage } from './pdfExportService';
import { pdfDocumentBuilder } from './pdfDocumentBuilder';

interface PdfExportWorkerRequest {
  pages: PdfExportPage[];
  type: 'create-pdf';
}

type PdfExportWorkerResponse =
  | { current: number; total: number; type: 'progress' }
  | { bytes: ArrayBuffer; type: 'result' }
  | { message: string; type: 'error' };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<PdfExportWorkerRequest>) => void) | null;
  postMessage(message: PdfExportWorkerResponse, transfer?: Transferable[]): void;
};

workerScope.onmessage = (event) => {
  try {
    const bytes = pdfDocumentBuilder.createArrayBuffer(event.data.pages, (current, total) => {
      workerScope.postMessage({
        current,
        total,
        type: 'progress',
      } satisfies PdfExportWorkerResponse);
    });
    workerScope.postMessage({ bytes, type: 'result' }, [bytes]);
  } catch (error) {
    workerScope.postMessage({
      message: error instanceof Error ? error.message : 'PDF export failed.',
      type: 'error',
    } satisfies PdfExportWorkerResponse);
  }
};
