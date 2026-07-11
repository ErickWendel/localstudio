/* eslint-disable @typescript-eslint/no-base-to-string */
import { expect, test } from '../support/journey-test';
import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { serviceContractsSupport } from './service-contracts-support';

test('executes Transformers runtime worker branches in the browser runtime', async ({ page }) => {
  await modelRuntimeContractPage.gotoReady(page, serviceContractsSupport.getServer().baseURL);

  const result = await page.evaluate(async () => {
    const { TransformersRuntimeClient } = (await import(
      '/editor/src/services/model-setup/transformersRuntimeClient.ts'
    )) as typeof import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient');

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

    return {
      detectedLanguage,
      generatedText,
      segmentationScore: segmentation.subjectMask.score,
      workerProgressEvents,
      workerRequests: transformersWorker.requests.map((request) => request.type),
    };
  });

  expect(result).toMatchObject({
    detectedLanguage: { language: 'es', score: 0.92 },
    generatedText: 'generated:hello',
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
  expect(result.workerProgressEvents).toEqual(
    expect.arrayContaining([expect.objectContaining({ progress: 50 })]),
  );
});
