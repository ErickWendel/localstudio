/* eslint-disable @typescript-eslint/require-await */
import { type Page } from '@playwright/test';

import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import type { ModelRemovalContractResult } from './model-download-contract-types';

export const modelDownloadContractRemoval = {
  async run(page: Page, baseURL: string): Promise<ModelRemovalContractResult> {
    await modelRuntimeContractPage.gotoReady(page, baseURL);

    return page.evaluate(async () => {
      const [{ aiModelCatalog }, { imageGenerationModel }, { modelSetupService }] =
        (await Promise.all([
          import('/editor/src/services/model-setup/aiModelCatalog.ts'),
          import('/editor/src/services/image-generation/imageGenerationModel.ts'),
          import('/editor/src/services/model-setup/modelSetupService.ts'),
        ])) as [
          typeof import('../../../apps/editor/src/services/model-setup/aiModelCatalog'),
          typeof import('../../../apps/editor/src/services/image-generation/imageGenerationModel'),
          typeof import('../../../apps/editor/src/services/model-setup/modelSetupService'),
        ];

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
      const modelLoads: string[] = [];
      const browserSetup = new modelSetupService.BrowserModelSetupService(
        {
          loadImageEditingModel: async (options) => {
            modelLoads.push('image-editing');
            options?.onProgress?.(75, { loadedBytes: 3, totalBytes: 4 });
          },
          removeImageEditingModel: async () => {
            modelLoads.push('remove-image-editing');
          },
        },
        storage,
        {
          loadImageGenerationModel: async (options) => {
            modelLoads.push('image-generation');
            options?.onProgress?.(40, { loadedBytes: 2, totalBytes: 4 });
          },
        },
        {
          loadTextGenerationModel: async (modelId, options) => {
            modelLoads.push(`text:${modelId}`);
            options?.onProgress?.(55, { loadedBytes: 5, totalBytes: 10 });
          },
          releaseTextGenerationModel: async (modelId) => {
            modelLoads.push(`release:${modelId}`);
          },
          removeTextGenerationModel: async (modelId) => {
            modelLoads.push(`remove-text:${modelId}`);
          },
        },
        {
          deleteModelArtifacts: async (modelId) => {
            modelLoads.push(`delete:${modelId}`);
          },
        },
        {
          loadLanguageDetectionModel: async (modelId, options) => {
            modelLoads.push(`language:${modelId}`);
            options?.onProgress?.(65, { loadedBytes: 6, totalBytes: 10 });
          },
        },
      );

      await browserSetup.downloadModel(modelSetupService.IMAGE_EDITING_MODEL_ID);
      await browserSetup.downloadModel(imageGenerationModel.IMAGE_GENERATION_MODEL_ID);
      await browserSetup.downloadModel(aiModelCatalog.GEMMA_LLM_MODEL_ID);
      await browserSetup.downloadModel(aiModelCatalog.TRANSLATEGEMMA_MODEL_ID);
      const removedLlm = await browserSetup.removeModel(aiModelCatalog.GEMMA_LLM_MODEL_ID);
      const removedTranslation = await browserSetup.removeModel(
        aiModelCatalog.TRANSLATEGEMMA_MODEL_ID,
      );
      const removedImageEditing = await browserSetup.removeModel(
        modelSetupService.IMAGE_EDITING_MODEL_ID,
      );
      const removedImageGeneration = await browserSetup.removeModel(
        imageGenerationModel.IMAGE_GENERATION_MODEL_ID,
      );

      return {
        modelLoads,
        removedImageEditing,
        removedImageGeneration,
        removedLlm,
        removedTranslation,
      };
    });
  },
};
