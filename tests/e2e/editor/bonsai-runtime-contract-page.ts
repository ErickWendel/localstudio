import { type Page } from '@playwright/test';

import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { evaluateBonsaiRuntimeFallbackContract, type BonsaiRuntimeFallbackContractResult } from './bonsai-runtime-fallback-contract-browser';
import { evaluateBonsaiRuntimeWorkerContract, type BonsaiRuntimeWorkerContractResult } from './bonsai-runtime-worker-contract-browser';

type BonsaiRuntimeContractResult = BonsaiRuntimeFallbackContractResult &
  BonsaiRuntimeWorkerContractResult;

export const bonsaiRuntimeContractPage = {
  async run(page: Page, baseURL: string): Promise<BonsaiRuntimeContractResult> {
    await modelRuntimeContractPage.gotoReady(page, baseURL);

    const [workerResult, fallbackResult] = await Promise.all([
      page.evaluate(evaluateBonsaiRuntimeWorkerContract),
      page.evaluate(evaluateBonsaiRuntimeFallbackContract),
    ]);
    return { ...workerResult, ...fallbackResult };
  },
};
