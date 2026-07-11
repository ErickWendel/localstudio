/* eslint-disable @typescript-eslint/require-await */
import { type Page } from '@playwright/test';

import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import type { ModelFailureContractResult } from './model-download-contract-types';

export const modelDownloadContractFailure = {
  async run(page: Page, baseURL: string): Promise<ModelFailureContractResult> {
    await modelRuntimeContractPage.gotoReady(page, baseURL);

    return page.evaluate(async () => {
      const { modelSetupService } = (await import(
        '/editor/src/services/model-setup/modelSetupService.ts'
      )) as typeof import('../../../apps/editor/src/services/model-setup/modelSetupService');
      const readyStorage = new Map<string, string>();
      const storage = {
        getItem: (key: string) => readyStorage.get(key) ?? null,
        removeItem: (key: string) => {
          readyStorage.delete(key);
        },
        setItem: (key: string, value: string) => {
          readyStorage.set(key, value);
        },
      };
      const failingSetup = new modelSetupService.BrowserModelSetupService(
        {
          loadImageEditingModel: async () => {
            throw new Error('image editing failed');
          },
        },
        storage,
      );
      const failedState = await failingSetup.downloadModel(modelSetupService.IMAGE_EDITING_MODEL_ID);

      return { failedState };
    });
  },
};
