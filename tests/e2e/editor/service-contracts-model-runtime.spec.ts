/* eslint-disable @typescript-eslint/require-await */
import { expect, test } from '../support/journey-test';
import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { serviceContractsSupport } from './service-contracts-support';

test('executes model setup service branches in the browser runtime', async ({ page }) => {
  await modelRuntimeContractPage.gotoReady(page, serviceContractsSupport.getServer().baseURL);

  const result = await page.evaluate(async () => {
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

    const readyStorage = new Map<string, string>([
      [aiModelCatalog.GEMMA_LLM_READY_KEY, 'true'],
      [aiModelCatalog.TRANSLATEGEMMA_READY_KEY, 'true'],
      [aiModelCatalog.LANGUAGE_DETECTION_READY_KEY, 'true'],
      [imageGenerationModel.IMAGE_GENERATION_READY_KEY, 'true'],
    ]);
    const storageWrites: string[] = [];
    const storage = {
      getItem: (key: string) => readyStorage.get(key) ?? null,
      removeItem: (key: string) => {
        storageWrites.push(`remove:${key}`);
        readyStorage.delete(key);
      },
      setItem: (key: string, value: string) => {
        storageWrites.push(`${key}:${value}`);
        readyStorage.set(key, value);
      },
    };
    const readySetup = new modelSetupService.BrowserModelSetupService(
      undefined,
      storage,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    const initiallyReady = (await readySetup.getModelStates()).filter(
      (state) => state.status === 'ready',
    ).length;
    readyStorage.clear();

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
    const imageEditingState = await browserSetup.downloadModel(
      modelSetupService.IMAGE_EDITING_MODEL_ID,
    );
    const imageGenerationState = await browserSetup.downloadModel(
      imageGenerationModel.IMAGE_GENERATION_MODEL_ID,
    );
    const llmState = await browserSetup.downloadModel(aiModelCatalog.GEMMA_LLM_MODEL_ID);
    const translationState = await browserSetup.downloadModel(aiModelCatalog.TRANSLATEGEMMA_MODEL_ID);
    const languageState = await browserSetup.downloadModel(aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID);
    await browserSetup.downloadRequiredModels();
    const removedLlm = await browserSetup.removeModel(aiModelCatalog.GEMMA_LLM_MODEL_ID);
    const removedTranslation = await browserSetup.removeModel(aiModelCatalog.TRANSLATEGEMMA_MODEL_ID);
    const removedImageEditing = await browserSetup.removeModel(
      modelSetupService.IMAGE_EDITING_MODEL_ID,
    );
    const removedImageGeneration = await browserSetup.removeModel(
      imageGenerationModel.IMAGE_GENERATION_MODEL_ID,
    );

    const failingSetup = new modelSetupService.BrowserModelSetupService(
      {
        loadImageEditingModel: async () => {
          throw new Error('image editing failed');
        },
      },
      storage,
    );
    const failedState = await failingSetup.downloadModel(modelSetupService.IMAGE_EDITING_MODEL_ID);

    const inMemorySetup = new modelSetupService.InMemoryModelSetupService();
    const inMemoryRequired = await inMemorySetup.downloadRequiredModels();
    const inMemoryRemoved = await inMemorySetup.removeModel(modelSetupService.IMAGE_EDITING_MODEL_ID);

    return {
      failedState,
      imageEditingState,
      imageGenerationState,
      initiallyReady,
      inMemoryReadyCount: inMemoryRequired.filter((state) => state.status === 'ready').length,
      inMemoryRemoved,
      languageState,
      llmState,
      modelLoads,
      removedImageEditing,
      removedImageGeneration,
      removedLlm,
      removedTranslation,
      storageWrites,
      translationState,
    };
  });

  expect(result).toMatchObject({
    failedState: { error: 'image editing failed', progress: 0, status: 'failed' },
    imageEditingState: { progress: 100, status: 'ready' },
    imageGenerationState: { progress: 100, status: 'ready' },
    inMemoryRemoved: { progress: 0, status: 'needs-download' },
    languageState: { progress: 100, status: 'ready' },
    llmState: { progress: 100, status: 'ready' },
    removedImageEditing: { progress: 0, status: 'needs-download' },
    removedImageGeneration: { progress: 0, status: 'needs-download' },
    removedLlm: { progress: 0, status: 'needs-download' },
    removedTranslation: { progress: 0, status: 'needs-download' },
    translationState: { progress: 100, status: 'ready' },
  });
  expect(result.initiallyReady).toBeGreaterThanOrEqual(4);
  expect(result.inMemoryReadyCount).toBeGreaterThan(0);
  expect(result.modelLoads).toEqual(
    expect.arrayContaining([
      'image-editing',
      'image-generation',
      'remove-image-editing',
      expect.stringMatching(/^delete:/),
    ]),
  );
  expect(result.storageWrites).toEqual(expect.arrayContaining([expect.stringMatching(/:true$/)]));
});
