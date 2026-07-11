import { type Page } from '@playwright/test';

import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { runModelFailureContractInBrowser } from './model-download-contract-browser-failure';
import type { ModelFailureContractResult } from './model-download-contract-types';

export const modelDownloadContractFailure = {
  async run(page: Page, baseURL: string): Promise<ModelFailureContractResult> {
    await modelRuntimeContractPage.gotoReady(page, baseURL);

    return page.evaluate(runModelFailureContractInBrowser);
  },
};
