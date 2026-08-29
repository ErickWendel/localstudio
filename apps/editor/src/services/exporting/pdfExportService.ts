import type {
  PdfExportPage,
  PdfExportWorkerRequest,
  PdfExportWorkerResponse,
} from './pdfExportWorkerProtocol';

export type { PdfExportPage } from './pdfExportWorkerProtocol';

function createPdfWorker() {
  if (typeof Worker === 'undefined') throw new Error('Web workers are required for PDF export.');
  return new Worker(new URL('./pdfExport.worker.ts', import.meta.url), { type: 'module' });
}

export const pdfExportService = {
  createBlob(
    pages: PdfExportPage[],
    options: { onProgress?: (current: number, total: number) => void } = {},
  ) {
    if (!pages.length) return Promise.reject(new Error('A PDF export needs at least one slide.'));
    return new Promise<Blob>((resolve, reject) => {
      let worker: Worker;
      try {
        worker = createPdfWorker();
      } catch (error) {
        reject(error instanceof Error ? error : new Error('PDF export worker is unavailable.'));
        return;
      }
      worker.onmessage = (event: MessageEvent<PdfExportWorkerResponse>) => {
        const response = event.data;
        if (response.type === 'progress') {
          options.onProgress?.(response.current, response.total);
          return;
        }
        worker.terminate();
        if (response.type === 'error') {
          reject(new Error(response.message));
          return;
        }
        resolve(new Blob([response.bytes], { type: 'application/pdf' }));
      };
      worker.onerror = (event) => {
        worker.terminate();
        reject(new Error(event.message || 'PDF export worker failed.'));
      };
      try {
        const transfer = [
          ...new Set(
            pages
              .map((page) => page.bytes.buffer)
              .filter((buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer),
          ),
        ];
        worker.postMessage({ pages, type: 'create-pdf' } satisfies PdfExportWorkerRequest, transfer);
      } catch (error) {
        worker.terminate();
        reject(error instanceof Error ? error : new Error('PDF export could not be started.'));
      }
    });
  },
};
