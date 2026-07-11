import { type Page } from '@playwright/test';

import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { runModelRemovalContractInBrowser } from './model-download-contract-browser-removal';
import type { ModelRemovalContractResult } from './model-download-contract-types';

export const modelDownloadContractRemoval = {
  async run(page: Page, baseURL: string): Promise<ModelRemovalContractResult> {
    await modelRuntimeContractPage.gotoReady(page, baseURL);

    return page.evaluate(runModelRemovalContractInBrowser);
  },
};
