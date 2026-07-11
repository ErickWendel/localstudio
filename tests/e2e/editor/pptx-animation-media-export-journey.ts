import { type Page, type TestInfo } from '@playwright/test';

import { pptxAnimationMediaExportFlow } from './pptx-animation-media-export-flow';
import { pptxShapeImageExportFlow } from './pptx-shape-image-export-flow';

export const pptxAnimationMediaExportJourney = {
  async runAnimationMediaExport(page: Page, baseURL: string): Promise<void> {
    await pptxAnimationMediaExportFlow.run(page, baseURL);
  },

  async runShapeImageExport(page: Page, baseURL: string, testInfo: TestInfo): Promise<void> {
    await pptxShapeImageExportFlow.run(page, baseURL, testInfo);
  },
};
