import { type Page } from '@playwright/test';

import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { evaluateTransformersRuntimeImageContract } from './transformers-runtime-image-contract-browser';
import { evaluateTransformersRuntimeLanguageContract } from './transformers-runtime-language-contract-browser';
import { evaluateTransformersRuntimeTextContract } from './transformers-runtime-text-contract-browser';

export const transformersRuntimeContractPage = {
  async runImageEditingWorkerContract(page: Page, baseURL: string) {
    await modelRuntimeContractPage.gotoReady(page, baseURL);
    return page.evaluate(evaluateTransformersRuntimeImageContract);
  },
  async runLanguageWorkerContract(page: Page, baseURL: string) {
    await modelRuntimeContractPage.gotoReady(page, baseURL);
    return page.evaluate(evaluateTransformersRuntimeLanguageContract);
  },
  async runTextWorkerContract(page: Page, baseURL: string) {
    await modelRuntimeContractPage.gotoReady(page, baseURL);
    return page.evaluate(evaluateTransformersRuntimeTextContract);
  },
  async runWorkerBranchContract(page: Page, baseURL: string) {
    const text = await this.runTextWorkerContract(page, baseURL);
    const language = await this.runLanguageWorkerContract(page, baseURL);
    const image = await this.runImageEditingWorkerContract(page, baseURL);

    return {
      detectedLanguage: language.detectedLanguage,
      generatedText: text.generatedText,
      segmentationScore: image.segmentationScore,
      workerProgressEvents: [
        ...text.progressEvents,
        ...language.progressEvents,
        ...image.progressEvents,
      ],
      workerRequests: [...text.requests, ...language.requests, ...image.requests],
    };
  },
};
