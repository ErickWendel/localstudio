import { type Page } from '@playwright/test';

import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { evaluateTransformersRuntimeWorkerContract } from './transformers-runtime-worker-contract-browser';

export const transformersRuntimeContractPage = {
  async runWorkerBranchContract(page: Page, baseURL: string) {
    await modelRuntimeContractPage.gotoReady(page, baseURL);
    return page.evaluate(evaluateTransformersRuntimeWorkerContract);
  },
};
