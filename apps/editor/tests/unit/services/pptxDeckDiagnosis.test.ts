import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { BrowserPptxImportService } from '../../../src/services/importing/pptx/pptxImportService';
import { pptxImportFidelity } from '../../../src/services/importing/pptx/pptxImportFidelity';
import { pptxPackage } from '../../../src/services/importing/pptx/pptxPackage';
import { pptxZip } from '../../../src/services/importing/pptx/pptxZip';

const deckPath =
  '/Users/erickwendel/Downloads/talks-localstudio/El-secreto-para-procesar-terabytes-de-datos-en-JavaScript-platziconf-07092024.pptx';

describe('Platziconf PPTX import fidelity', () => {
  it.skipIf(!existsSync(deckPath))(
    'imports referenced media, posters, custom geometry, TIFF, and text',
    async () => {
      const bytes = await readFile(deckPath);
      const file = new File([bytes], 'platziconf.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      const packageDocument = await pptxPackage.create(await pptxZip.readPackage(file));
      const project = await new BrowserPptxImportService().importPowerPoint({ file });
      const report = await pptxImportFidelity.audit(packageDocument, project);

      expect(project.pages).toHaveLength(74);
      expect(report.gaps, JSON.stringify(report.gaps.slice(0, 12), null, 2)).toEqual([]);
    },
    120000,
  );
});
