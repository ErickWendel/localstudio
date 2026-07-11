import { type Page } from '@playwright/test';

import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { evaluateTransformersFallbackContract } from './transformers-fallback-contract-browser';

export const transformersFallbackContractPage = {
  async runFallbackAndWrapperContract(page: Page, baseURL: string) {
    await modelRuntimeContractPage.gotoReady(page, baseURL);
    return page.evaluate(evaluateTransformersFallbackContract);
  },
};
