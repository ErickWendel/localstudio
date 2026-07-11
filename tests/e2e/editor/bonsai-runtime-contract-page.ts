import { type Page } from '@playwright/test';

import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import {
  evaluateBonsaiRuntimeFallbackContract,
  type BonsaiRuntimeFallbackContractResult,
} from './bonsai-runtime-fallback-contract-browser';
import {
  evaluateBonsaiRuntimeWorkerGenerateContract,
  type BonsaiRuntimeWorkerGenerateContractResult,
} from './bonsai-runtime-worker-generate-contract-browser';
import {
  evaluateBonsaiRuntimeWorkerPreloadContract,
  type BonsaiRuntimeWorkerPreloadContractResult,
} from './bonsai-runtime-worker-preload-contract-browser';

type BonsaiRuntimeContractResult = BonsaiRuntimeFallbackContractResult &
  BonsaiRuntimeWorkerGenerateContractResult &
  BonsaiRuntimeWorkerPreloadContractResult & {
    bonsaiProgress: number[];
    bonsaiRequests: string[];
  };

export const bonsaiRuntimeContractPage = {
  async run(page: Page, baseURL: string): Promise<BonsaiRuntimeContractResult> {
    await modelRuntimeContractPage.gotoReady(page, baseURL);

    const [preloadResult, generateResult, fallbackResult] = await Promise.all([
      page.evaluate(evaluateBonsaiRuntimeWorkerPreloadContract),
      page.evaluate(evaluateBonsaiRuntimeWorkerGenerateContract),
      page.evaluate(evaluateBonsaiRuntimeFallbackContract),
    ]);
    return {
      ...generateResult,
      ...preloadResult,
      ...fallbackResult,
      bonsaiProgress: [
        ...preloadResult.bonsaiPreloadProgress,
        ...generateResult.bonsaiGenerateProgress,
      ],
      bonsaiRequests: [
        ...preloadResult.bonsaiPreloadRequests,
        ...generateResult.bonsaiGenerateRequests,
      ],
    };
  },
};
