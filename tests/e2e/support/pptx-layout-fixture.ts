import { writeFile } from 'node:fs/promises';
import type { TestInfo } from '@playwright/test';
import { createStoredPptxFile } from '../../../apps/editor/tests/unit/services/pptxTestZip';
import { pptxLayoutPackageParts } from './pptx-layout-package-parts';

export async function createLayoutPptxFixture(testInfo: TestInfo) {
  const filePath = testInfo.outputPath('localstudio-e2e-import-layouts.pptx');
  const pptx = createStoredPptxFile(
    pptxLayoutPackageParts,
    'localstudio-e2e-import-layouts.pptx',
  );
  await writeFile(filePath, Buffer.from(await pptx.arrayBuffer()));
  return filePath;
}
