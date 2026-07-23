export type ModelReadinessContractResult = {
  cacheDeletedUrls: string[];
  downloadCalls: string[];
  failureState: string | undefined;
  initiallyReady: number;
  loaderCalls: string[];
  progressValues: number[];
  removedStates: string[];
  storageWrites: string[];
  unknownDownloadMessage: string;
  unknownRemoveMessage: string;
};

export async function evaluateModelReadinessContract(): Promise<ModelReadinessContractResult> {
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
  const setup = new modelSetupService.BrowserModelSetupService(
    undefined,
    {
      getItem: (key: string) => readyStorage.get(key) ?? null,
      removeItem: (key: string) => {
        readyStorage.delete(key);
        storageWrites.push(`remove:${key}`);
      },
      setItem: (key: string, value: string) => {
        readyStorage.set(key, value);
        storageWrites.push(`${key}:${value}`);
      },
    },
    undefined,
    undefined,
    undefined,
    undefined,
  );
  const initiallyReady = (await setup.getModelStates()).filter(
    (state) => state.status === 'ready',
  ).length;

  const loaderCalls: string[] = [];
  const textLoader = new modelSetupService.TransformersTextGenerationModelLoader({
    preloadTextGeneration: async (modelId, options) => {
      await Promise.resolve();
      loaderCalls.push(`preload-text:${modelId}`);
      options?.onProgress?.(73, { loadedBytes: 73, totalBytes: 100 });
    },
    releaseTextGeneration: async (modelId) => {
      await Promise.resolve();
      loaderCalls.push(`release-text:${modelId}`);
    },
    removeTextGeneration: async (modelId) => {
      await Promise.resolve();
      loaderCalls.push(`remove-text:${modelId}`);
    },
  });
  await textLoader.loadTextGenerationModel('contract-text-model', {
    onProgress: (progress) => loaderCalls.push(`text-progress:${progress}`),
  });
  await textLoader.releaseTextGenerationModel('contract-text-model');
  await textLoader.removeTextGenerationModel('contract-text-model');
  const languageLoader = new modelSetupService.TransformersLanguageDetectionModelLoader({
    preloadLanguageDetection: async (modelId, options) => {
      await Promise.resolve();
      loaderCalls.push(`preload-language:${modelId}`);
      options?.onProgress?.(64, { loadedBytes: 64, totalBytes: 100 });
    },
  });
  await languageLoader.loadLanguageDetectionModel('contract-language-model', {
    onProgress: (progress) => loaderCalls.push(`language-progress:${progress}`),
  });
  const imageEditingLoader = new modelSetupService.TransformersImageEditingModelLoader({
    preloadImageEditing: async () => {
      await Promise.resolve();
      loaderCalls.push('preload-image-editing');
    },
    removeImageEditing: async () => {
      await Promise.resolve();
      loaderCalls.push('remove-image-editing');
    },
  });
  await imageEditingLoader.removeImageEditingModel();

  const cacheDeletedUrls: string[] = [];
  const cacheStorage = new modelSetupService.BrowserTransformersModelCache();
  const originalCaches = globalThis.caches;
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: {
      open: async () => {
        await Promise.resolve();
        return {
          delete: async (request: Request) => {
            await Promise.resolve();
            cacheDeletedUrls.push(request.url);
            return true;
          },
          keys: async () => {
            await Promise.resolve();
            return [
              new Request(
                'https://models.example.test/onnx-community/gemma-4-E2B-it-ONNX/model.onnx',
              ),
              new Request('https://models.example.test/unrelated/model.onnx'),
            ];
          },
        };
      },
    },
  });
  try {
    await cacheStorage.deleteModelArtifacts('onnx-community/gemma-4-E2B-it-ONNX');
  } finally {
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: originalCaches,
    });
  }

  const downloadCalls: string[] = [];
  const progressValues: number[] = [];
  const removalCalls: string[] = [];
  const contractStorage = new Map<string, string>();
  const contractSetup = new modelSetupService.BrowserModelSetupService(
    {
      loadImageEditingModel: async (options) => {
        await Promise.resolve();
        downloadCalls.push('image-editing');
        options?.onProgress?.(44, { loadedBytes: 44, totalBytes: 100 });
      },
      removeImageEditingModel: async () => {
        await Promise.resolve();
        removalCalls.push('image-editing');
      },
    },
    {
      getItem: (key: string) => contractStorage.get(key) ?? null,
      removeItem: (key: string) => {
        contractStorage.delete(key);
        storageWrites.push(`contract-remove:${key}`);
      },
      setItem: (key: string, value: string) => {
        contractStorage.set(key, value);
        storageWrites.push(`contract:${key}:${value}`);
      },
    },
    {
      loadImageGenerationModel: async (options) => {
        await Promise.resolve();
        downloadCalls.push('image-generation');
        options?.onProgress?.(55, { loadedBytes: 55, totalBytes: 100 });
      },
    },
    {
      loadTextGenerationModel: async (modelId, options) => {
        await Promise.resolve();
        downloadCalls.push(`text:${modelId}`);
        options?.onProgress?.(66, { loadedBytes: 66, totalBytes: 100 });
        if (modelId === aiModelCatalog.TRANSLATEGEMMA_TRANSFORMERS_MODEL_ID) {
          throw new Error('translategemma failed');
        }
      },
      releaseTextGenerationModel: async (modelId) => {
        await Promise.resolve();
        downloadCalls.push(`release:${modelId}`);
      },
      removeTextGenerationModel: async (modelId) => {
        await Promise.resolve();
        removalCalls.push(`text:${modelId}`);
      },
    },
    {
      deleteModelArtifacts: async (modelId) => {
        await Promise.resolve();
        removalCalls.push(`cache:${modelId}`);
      },
    },
    {
      loadLanguageDetectionModel: async (modelId, options) => {
        await Promise.resolve();
        downloadCalls.push(`language:${modelId}`);
        options?.onProgress?.(77, { loadedBytes: 77, totalBytes: 100 });
      },
    },
  );
  await contractSetup.downloadModel(modelSetupService.IMAGE_EDITING_MODEL_ID, {
    onProgress: (progress) => progressValues.push(progress),
  });
  await contractSetup.downloadModel(imageGenerationModel.IMAGE_GENERATION_MODEL_ID, {
    onProgress: (progress) => progressValues.push(progress),
  });
  await contractSetup.downloadModel(aiModelCatalog.GEMMA_LLM_MODEL_ID, {
    onProgress: (progress) => progressValues.push(progress),
  });
  const failureState = (
    await contractSetup.downloadModel(aiModelCatalog.TRANSLATEGEMMA_MODEL_ID, {
      onProgress: (progress) => progressValues.push(progress),
    })
  ).error;
  await contractSetup.downloadModel(aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID, {
    onProgress: (progress) => progressValues.push(progress),
  });
  const removedStates = await Promise.all([
    contractSetup.removeModel(aiModelCatalog.GEMMA_LLM_MODEL_ID),
    contractSetup.removeModel(aiModelCatalog.TRANSLATEGEMMA_MODEL_ID),
    contractSetup.removeModel(modelSetupService.IMAGE_EDITING_MODEL_ID),
    contractSetup.removeModel(imageGenerationModel.IMAGE_GENERATION_MODEL_ID),
  ]);

  async function captureError(operation: () => Promise<unknown>) {
    try {
      await operation();
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    return 'missing-error';
  }

  return {
    cacheDeletedUrls,
    downloadCalls,
    failureState,
    initiallyReady,
    loaderCalls,
    progressValues,
    removedStates: removedStates.map((state) => state.status),
    storageWrites,
    unknownDownloadMessage: await captureError(() => contractSetup.downloadModel('missing-model')),
    unknownRemoveMessage: await captureError(() => contractSetup.removeModel('missing-model')),
  };
}
