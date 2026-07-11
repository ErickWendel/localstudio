/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/require-await */
import { expect, test } from '../support/journey-test';
import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { serviceContractsSupport } from './service-contracts-support';

test('executes Transformers runtime worker and fallback branches in the browser runtime', async ({
  page,
}) => {
  await modelRuntimeContractPage.gotoReady(page, serviceContractsSupport.getServer().baseURL);

  const result = await page.evaluate(async () => {
    const [
      { TransformersRuntimeClient },
      { webGpuLanguageDetectionRuntime },
      { webGpuTextGenerationRuntime },
    ] = (await Promise.all([
      import('/editor/src/services/model-setup/transformersRuntimeClient.ts'),
      import('/editor/src/services/translation/webGpuLanguageDetectionRuntime.ts'),
      import('/editor/src/services/prompting/webGpuTextGenerationRuntime.ts'),
    ])) as [
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

    return {
      detectedFromNested,
      detectedLanguage,
      extractedNestedText,
      fallbackCalls,
      fallbackLanguage,
      fallbackSegmentationScore: fallbackSegmentation.subjectMask.score,
      fallbackText,
      generatedText,
      runtimeLanguage,
      runtimeText,
      segmentationScore: segmentation.subjectMask.score,
      textExtractionErrors,
      workerProgressEvents,
      workerRequests: transformersWorker.requests.map((request) => request.type),
    };
  });

  expect(result).toMatchObject({
    detectedFromNested: { language: 'fr', score: 0.66 },
    detectedLanguage: { language: 'es', score: 0.92 },
    extractedNestedText: 'nested assistant text',
    fallbackLanguage: { language: 'pt', score: 0.77 },
    fallbackSegmentationScore: 1,
    fallbackText: 'fallback text',
    generatedText: 'generated:hello',
    runtimeLanguage: { language: 'pt', score: 0.77 },
    runtimeText: 'fallback text',
    segmentationScore: 0.87,
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
  expect(result.textExtractionErrors).toEqual([
    'WebGPU text generation did not return text.',
    'Language detection model did not return a language label.',
  ]);
  expect(result.workerProgressEvents).toEqual(
    expect.arrayContaining([expect.objectContaining({ progress: 50 })]),
  );
});
