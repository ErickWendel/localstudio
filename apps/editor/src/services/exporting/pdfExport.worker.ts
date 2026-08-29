import { pdfDocumentBuilder } from './pdfDocumentBuilder';
import type {
  PdfExportWorkerRequest,
  PdfExportWorkerResponse,
} from './pdfExportWorkerProtocol';

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
