import { describe, expect, it } from 'vitest';
import { pdfExportService } from '../../../src/services/exporting/pdfExportService';

const tinyPng = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVR4nGP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
  ),
  (character) => character.charCodeAt(0),
);

describe('pdfExportService', () => {
  it('creates one correctly sized PDF page for every rendered slide', async () => {
    const blob = pdfExportService.createBlob([
      { bytes: tinyPng, heightPoints: 1080, widthPoints: 1920 },
      { bytes: tinyPng, heightPoints: 1080, widthPoints: 1920 },
    ]);
    const contents = new TextDecoder('latin1').decode(await blob.arrayBuffer());

    expect(blob.type).toBe('application/pdf');
    expect(contents).toMatch(/^%PDF-/);
    expect(contents).toContain('/Count 2');
    expect(contents).toContain('/MediaBox [0 0 1920. 1080.]');
  });
});
