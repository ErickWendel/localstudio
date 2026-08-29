import { describe, expect, it } from 'vitest';
import { pdfExportService } from '../../../src/services/exporting/pdfExportService';
import { pdfDocumentBuilder } from '../../../src/services/exporting/pdfDocumentBuilder';

const tinyPng = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVR4nGP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
  ),
  (character) => character.charCodeAt(0),
);

describe('pdfExportService', () => {
  it('creates one correctly sized PDF page for every rendered slide', async () => {
    const pages = [
      { bytes: tinyPng, heightPoints: 1080, widthPoints: 1920 },
      { bytes: tinyPng, heightPoints: 1080, widthPoints: 1920 },
    ];
    const terminate = vi.fn();
    class PdfWorkerStub {
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      postMessage(message: { pages: typeof pages }) {
        const bytes = pdfDocumentBuilder.createArrayBuffer(message.pages, (current, total) => {
          this.onmessage?.({ data: { current, total, type: 'progress' } } as MessageEvent);
        });
        this.onmessage?.({ data: { bytes, type: 'result' } } as MessageEvent);
      }
      terminate = terminate;
    }
    vi.stubGlobal('Worker', PdfWorkerStub);
    const onProgress = vi.fn();
    const blob = await pdfExportService.createBlob(pages, { onProgress });
    const contents = new TextDecoder('latin1').decode(await blob.arrayBuffer());

    expect(blob.type).toBe('application/pdf');
    expect(contents).toMatch(/^%PDF-/);
    expect(contents).toContain('/Count 2');
    expect(contents).toContain('/MediaBox [0 0 1920. 1080.]');
    expect(onProgress).toHaveBeenLastCalledWith(2, 2);
    expect(terminate).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
