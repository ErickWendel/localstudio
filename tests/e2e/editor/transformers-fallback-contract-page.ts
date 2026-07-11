import { type Page } from '@playwright/test';

import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { evaluateTransformersFallbackImageContract } from './transformers-fallback-image-contract-browser';
import { evaluateTransformersFallbackLanguageContract } from './transformers-fallback-language-contract-browser';
import { evaluateTransformersFallbackTextContract } from './transformers-fallback-text-contract-browser';
import { evaluateTransformersFallbackWrapperContract } from './transformers-fallback-wrapper-contract-browser';

export const transformersFallbackContractPage = {
  async runFallbackImageContract(page: Page, baseURL: string) {
    await modelRuntimeContractPage.gotoReady(page, baseURL);
    return page.evaluate(evaluateTransformersFallbackImageContract);
  },
  async runFallbackLanguageContract(page: Page, baseURL: string) {
    await modelRuntimeContractPage.gotoReady(page, baseURL);
    return page.evaluate(evaluateTransformersFallbackLanguageContract);
  },
  async runFallbackTextContract(page: Page, baseURL: string) {
    await modelRuntimeContractPage.gotoReady(page, baseURL);
    return page.evaluate(evaluateTransformersFallbackTextContract);
  },
  async runFallbackWrapperContract(page: Page, baseURL: string) {
    await modelRuntimeContractPage.gotoReady(page, baseURL);
    return page.evaluate(evaluateTransformersFallbackWrapperContract);
  },
  async runFallbackAndWrapperContract(page: Page, baseURL: string) {
    const text = await this.runFallbackTextContract(page, baseURL);
    const language = await this.runFallbackLanguageContract(page, baseURL);
    const image = await this.runFallbackImageContract(page, baseURL);
    const wrapper = await this.runFallbackWrapperContract(page, baseURL);

    return {
      fallbackCalls: [...text.calls, ...language.calls, ...image.calls, ...wrapper.calls],
      fallbackLanguage: language.language,
      fallbackSegmentationScore: image.segmentationScore,
      fallbackText: text.text,
      runtimeLanguage: wrapper.language,
      runtimeText: wrapper.text,
    };
  },
};
