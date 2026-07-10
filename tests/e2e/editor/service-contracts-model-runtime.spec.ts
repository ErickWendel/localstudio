/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/require-await */
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes model setup, transformers runtime, and Bonsai worker branches in the browser runtime', async ({
  page,
}) => {
  await page.goto(new URL('/editor/?newProject=1', serviceContractsSupport.getServer().baseURL).toString());
  await page.waitForLoadState('networkidle');

  const result = await page.evaluate(async () => {
    const [
      { aiModelCatalog },
      { bonsaiImageRuntime },
      { imageGenerationModel },
      { modelSetupService },
      { TransformersRuntimeClient },
      { webGpuLanguageDetectionRuntime },
      { webGpuTextGenerationRuntime },
    ] = (await Promise.all([
      import('/editor/src/services/model-setup/aiModelCatalog.ts'),
      import('/editor/src/services/image-generation/bonsaiImageRuntime.ts'),
      import('/editor/src/services/image-generation/imageGenerationModel.ts'),
      import('/editor/src/services/model-setup/modelSetupService.ts'),
      import('/editor/src/services/model-setup/transformersRuntimeClient.ts'),
      import('/editor/src/services/translation/webGpuLanguageDetectionRuntime.ts'),
      import('/editor/src/services/prompting/webGpuTextGenerationRuntime.ts'),
    ])) as [
      typeof import('../../../apps/editor/src/services/model-setup/aiModelCatalog'),
      typeof import('../../../apps/editor/src/services/image-generation/bonsaiImageRuntime'),
      typeof import('../../../apps/editor/src/services/image-generation/imageGenerationModel'),
      typeof import('../../../apps/editor/src/services/model-setup/modelSetupService'),
      typeof import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient'),
      typeof import('../../../apps/editor/src/services/translation/webGpuLanguageDetectionRuntime'),
      typeof import('../../../apps/editor/src/services/prompting/webGpuTextGenerationRuntime'),
    ];

    type WorkerMessageHandler<TResponse> = (event: MessageEvent<TResponse>) => void;

    class ScriptedWorker<TRequest extends { id: string; type: string }, TResponse> {
      onerror: ((event: Event | ErrorEvent) => void) | null = null;
      onmessage: WorkerMessageHandler<TResponse> | null = null;
      requests: TRequest[] = [];

      constructor(private readonly respond: (request: TRequest) => TResponse[]) {}

      postMessage(request: TRequest) {
        this.requests.push(request);
        queueMicrotask(() => {
          for (const response of this.respond(request)) {
            this.onmessage?.({ data: response } as MessageEvent<TResponse>);
          }
        });
      }

      fail(message: string) {
        this.onerror?.(new ErrorEvent('error', { message }));
      }
    }

    const workerProgressEvents: Array<{ details?: unknown; progress: number }> = [];
    const transformersWorker = new ScriptedWorker<
      import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient').TransformersWorkerRequest,
      import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient').TransformersWorkerResponse
    >((request) => {
      if (request.type === 'generate-text') {
        return [
          { id: request.id, progress: 35, type: 'progress' },
          { id: request.id, result: `generated:${String(request.prompt)}`, type: 'result' },
        ];
      }
      if (request.type === 'detect-language') {
        return [
          {
            id: request.id,
            result: { language: request.text.includes('hola') ? 'es' : 'en', score: 0.92 },
            type: 'result',
          },
        ];
      }
      if (request.type === 'segment-background-removal') {
        return [
          {
            id: request.id,
            result: {
              imageInput: { channels: 4, data: new Uint8Array([1, 2, 3, 255]), height: 1, width: 1 },
              subjectMask: { data: new Uint8Array([1]), height: 1, score: 0.87, width: 1 },
            },
            type: 'result',
          },
        ];
      }
      return [
        {
          details: { loadedBytes: 5, totalBytes: 10 },
          id: request.id,
          progress: 50,
          type: 'progress',
        },
        { id: request.id, type: 'result' },
      ];
    });
    const transformersClient = new TransformersRuntimeClient({
      createWorker: () => transformersWorker as unknown as Worker,
    });
    await transformersClient.preloadTextGeneration('llm-model', {
      onProgress: (progress, details) => workerProgressEvents.push({ details, progress }),
    });
    const generatedText = await transformersClient.generateText('llm-model', 'hello');
    await transformersClient.releaseTextGeneration('llm-model');
    await transformersClient.removeTextGeneration('llm-model');
    await transformersClient.preloadLanguageDetection('language-model', {
      onProgress: (progress, details) => workerProgressEvents.push({ details, progress }),
    });
    const detectedLanguage = await transformersClient.detectLanguage('language-model', 'hola mundo');
    await transformersClient.preloadImageEditing({
      onProgress: (progress, details) => workerProgressEvents.push({ details, progress }),
    });
    await transformersClient.prepareBackgroundRemoval('asset://image', {
      onProgress: (progress) => workerProgressEvents.push({ progress }),
    });
    const segmentation = await transformersClient.segmentBackgroundRemoval('asset://image', [
      { positive: true, x: 0.25, y: 0.5 },
    ]);
    await transformersClient.removeImageEditing();

    const fallbackCalls: string[] = [];
    const fallbackClient = new TransformersRuntimeClient({
      createWorker: () => {
        throw new Error('worker unavailable');
      },
      fallbackOperations: {
        detectLanguage: async (_modelId, text) => {
          fallbackCalls.push(`detect:${text}`);
          return { language: 'pt', score: 0.77 };
        },
        generateText: async (_modelId, prompt) => {
          fallbackCalls.push(`generate:${String(prompt)}`);
          return 'fallback text';
        },
        preloadImageEditing: async (options) => {
          fallbackCalls.push('preload-image-editing');
          options?.onProgress?.(100);
        },
        removeImageEditing: async () => {
          fallbackCalls.push('remove-image-editing');
        },
        preloadLanguageDetection: async (modelId, options) => {
          fallbackCalls.push(`preload-language:${modelId}`);
          options?.onProgress?.(100);
        },
        preloadTextGeneration: async (modelId, options) => {
          fallbackCalls.push(`preload-text:${modelId}`);
          options?.onProgress?.(100);
        },
        prepareBackgroundRemoval: async (objectUrl, options) => {
          fallbackCalls.push(`prepare:${objectUrl}`);
          options?.onProgress?.(100);
        },
        releaseTextGeneration: async (modelId) => {
          fallbackCalls.push(`release:${modelId}`);
        },
        removeTextGeneration: async (modelId) => {
          fallbackCalls.push(`remove:${modelId}`);
        },
        segmentBackgroundRemoval: async (objectUrl, points) => {
          fallbackCalls.push(`segment:${objectUrl}:${points.length}`);
          return {
            imageInput: { channels: 4, data: new Uint8Array([1, 2, 3, 255]), height: 1, width: 1 },
            subjectMask: { data: new Uint8Array([1]), height: 1, score: 1, width: 1 },
          };
        },
      },
    });
    await fallbackClient.preloadTextGeneration('fallback-llm');
    const fallbackText = await fallbackClient.generateText('fallback-llm', 'fallback prompt');
    await fallbackClient.releaseTextGeneration('fallback-llm');
    await fallbackClient.removeTextGeneration('fallback-llm');
    await fallbackClient.preloadLanguageDetection('fallback-lang');
    const fallbackLanguage = await fallbackClient.detectLanguage('fallback-lang', 'olá');
    await fallbackClient.preloadImageEditing();
    await fallbackClient.prepareBackgroundRemoval('asset://fallback');
    const fallbackSegmentation = await fallbackClient.segmentBackgroundRemoval('asset://fallback', [
      { positive: false, x: 0.1, y: 0.2 },
    ]);
    await fallbackClient.removeImageEditing();

    const textRuntime = new webGpuTextGenerationRuntime.TransformersTextGenerationRuntime(
      fallbackClient,
    );
    await textRuntime.loadTextGenerationModel('runtime-llm');
    await textRuntime.releaseTextGenerationModel('runtime-llm');
    const runtimeText = await textRuntime.generate('runtime-llm', 'runtime prompt');
    await textRuntime.removeTextGenerationModel('runtime-llm');

    const languageRuntime =
      new webGpuLanguageDetectionRuntime.TransformersLanguageDetectionRuntime(fallbackClient);
    await languageRuntime.loadLanguageDetectionModel('runtime-lang');
    const runtimeLanguage = await languageRuntime.detectLanguage('runtime-lang', 'runtime text');

    const bonsaiWorker = new ScriptedWorker<
      import('../../../apps/editor/src/services/image-generation/bonsaiImageRuntime').BonsaiImageWorkerRequest,
      import('../../../apps/editor/src/services/image-generation/bonsaiImageRuntime').BonsaiImageWorkerResponse
    >((request) => {
      if (request.type === 'generate') {
        return [
          { id: request.id, progress: 60, type: 'progress' },
          { id: request.id, step: 1, totalSteps: request.options.steps, type: 'step' },
          {
            blob: new Blob([`image:${request.options.prompt}`], { type: 'image/png' }),
            id: request.id,
            type: 'result',
          },
        ];
      }
      return [
        { details: { loadedBytes: 1, totalBytes: 2 }, id: request.id, progress: 50, type: 'progress' },
        { id: request.id, type: 'result' },
      ];
    });
    const bonsaiProgress: number[] = [];
    const bonsaiSteps: string[] = [];
    const bonsaiRuntime = new bonsaiImageRuntime.WorkerBackedBonsaiImageRuntime({
      createWorker: () => bonsaiWorker as unknown as Worker,
    });
    await bonsaiRuntime.preload('bonsai-model', {
      onProgress: (progress) => bonsaiProgress.push(progress),
    });
    const bonsaiBlob = await bonsaiRuntime.generate({
      height: 512,
      modelId: 'bonsai-model',
      onLoadProgress: (progress) => bonsaiProgress.push(progress),
      onStep: (step, total) => bonsaiSteps.push(`${step}/${total}`),
      prompt: 'coverage image',
      seed: 42,
      steps: 2,
      width: 512,
    });

    const fallbackBonsaiRuntime = new bonsaiImageRuntime.WorkerBackedBonsaiImageRuntime({
      createWorker: () => {
        throw new Error('image worker unavailable');
      },
      fallbackRuntime: {
        generate: async (options) => {
          options.onLoadProgress?.(100);
          options.onStep?.(options.steps, options.steps);
          return new Blob([options.prompt], { type: 'image/png' });
        },
        preload: async (_modelId, options) => {
          options?.onProgress?.(100);
        },
      },
    });
    await fallbackBonsaiRuntime.preload('fallback-bonsai');
    const fallbackBonsaiBlob = await fallbackBonsaiRuntime.generate({
      height: 256,
      modelId: 'fallback-bonsai',
      prompt: 'fallback image',
      steps: 1,
      width: 256,
    });

    const textExtractionErrors: string[] = [];
    const extractedNestedText = webGpuTextGenerationRuntime.extractGeneratedText([
      { generated_text: [{ content: 'nested assistant text' }] },
    ]);
    try {
      webGpuTextGenerationRuntime.extractGeneratedText([{ generated_text: [{ value: 1 }] }]);
    } catch (error) {
      textExtractionErrors.push(error instanceof Error ? error.message : String(error));
    }
    const detectedFromNested = webGpuLanguageDetectionRuntime.extractDetectedLanguage([
      [{ label: 'fr', score: 0.66 }],
    ]);
    try {
      webGpuLanguageDetectionRuntime.extractDetectedLanguage([{ score: 0.1 }]);
    } catch (error) {
      textExtractionErrors.push(error instanceof Error ? error.message : String(error));
    }

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
    const removedImageEditing = await browserSetup.removeModel(modelSetupService.IMAGE_EDITING_MODEL_ID);
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
      bonsaiBlobText: await bonsaiBlob.text(),
      bonsaiProgress,
      bonsaiRequests: bonsaiWorker.requests.map((request) => request.type),
      bonsaiSteps,
      detectedFromNested,
      detectedLanguage,
      extractedNestedText,
      failedState,
      fallbackBonsaiBlobText: await fallbackBonsaiBlob.text(),
      fallbackCalls,
      fallbackLanguage,
      fallbackSegmentationScore: fallbackSegmentation.subjectMask.score,
      fallbackText,
      generatedText,
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
      runtimeLanguage,
      runtimeText,
      segmentationScore: segmentation.subjectMask.score,
      storageWrites,
      textExtractionErrors,
      translationState,
      workerProgressEvents,
      workerRequests: transformersWorker.requests.map((request) => request.type),
    };
  });

  expect(result).toMatchObject({
    bonsaiBlobText: 'image:coverage image',
    bonsaiRequests: ['preload', 'generate'],
    bonsaiSteps: ['1/2'],
    detectedFromNested: { language: 'fr', score: 0.66 },
    detectedLanguage: { language: 'es', score: 0.92 },
    extractedNestedText: 'nested assistant text',
    failedState: { error: 'image editing failed', progress: 0, status: 'failed' },
    fallbackBonsaiBlobText: 'fallback image',
    fallbackLanguage: { language: 'pt', score: 0.77 },
    fallbackSegmentationScore: 1,
    fallbackText: 'fallback text',
    generatedText: 'generated:hello',
    imageEditingState: { progress: 100, status: 'ready' },
    imageGenerationState: { progress: 100, status: 'ready' },
    inMemoryRemoved: { progress: 0, status: 'needs-download' },
    languageState: { progress: 100, status: 'ready' },
    llmState: { progress: 100, status: 'ready' },
    removedImageEditing: { progress: 0, status: 'needs-download' },
    removedImageGeneration: { progress: 0, status: 'needs-download' },
    removedLlm: { progress: 0, status: 'needs-download' },
    removedTranslation: { progress: 0, status: 'needs-download' },
    runtimeLanguage: { language: 'pt', score: 0.77 },
    runtimeText: 'fallback text',
    segmentationScore: 0.87,
    translationState: { progress: 100, status: 'ready' },
    workerRequests: [
      'preload-text-generation',
      'generate-text',
      'release-text-generation',
      'remove-text-generation',
      'preload-language-detection',
      'detect-language',
      'preload-image-editing',
      'prepare-background-removal',
      'segment-background-removal',
      'remove-image-editing',
    ],
  });
  expect(result.bonsaiProgress).toContain(60);
  expect(result.fallbackCalls).toEqual(
    expect.arrayContaining([
      'preload-text:fallback-llm',
      'generate:fallback prompt',
      'release:fallback-llm',
      'remove:fallback-llm',
      'preload-language:fallback-lang',
      'detect:olá',
      'preload-image-editing',
      'prepare:asset://fallback',
      'segment:asset://fallback:1',
      'remove-image-editing',
    ]),
  );
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
  expect(result.textExtractionErrors).toEqual([
    'WebGPU text generation did not return text.',
    'Language detection model did not return a language label.',
  ]);
  expect(result.workerProgressEvents).toEqual(
    expect.arrayContaining([expect.objectContaining({ progress: 50 })]),
  );
});
