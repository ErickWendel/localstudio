import { type Page } from '@playwright/test';

import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { runModelDownloadContractInBrowser } from './model-download-contract-browser-download';
import type { ModelDownloadContractResult } from './model-download-contract-types';

export const modelDownloadContractDownload = {
  async run(page: Page, baseURL: string): Promise<ModelDownloadContractResult> {
    await modelRuntimeContractPage.gotoReady(page, baseURL);

    return page.evaluate(runModelDownloadContractInBrowser);
  },
};
