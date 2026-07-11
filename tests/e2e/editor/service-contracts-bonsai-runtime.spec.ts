/* eslint-disable @typescript-eslint/require-await */
import { expect, test } from '../support/journey-test';
import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { serviceContractsSupport } from './service-contracts-support';

test('executes Bonsai image runtime worker and fallback branches in the browser runtime', async ({
  page,
}) => {
  await modelRuntimeContractPage.gotoReady(page, serviceContractsSupport.getServer().baseURL);

  const result = await page.evaluate(async () => {
    const { bonsaiImageRuntime } = (await import(
      '/editor/src/services/image-generation/bonsaiImageRuntime.ts'
    )) as typeof import('../../../apps/editor/src/services/image-generation/bonsaiImageRuntime');

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
    }

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

    return {
      bonsaiBlobText: await bonsaiBlob.text(),
      bonsaiProgress,
      bonsaiRequests: bonsaiWorker.requests.map((request) => request.type),
      bonsaiSteps,
      fallbackBonsaiBlobText: await fallbackBonsaiBlob.text(),
    };
  });

  expect(result).toMatchObject({
    bonsaiBlobText: 'image:coverage image',
    bonsaiRequests: ['preload', 'generate'],
    bonsaiSteps: ['1/2'],
    fallbackBonsaiBlobText: 'fallback image',
  });
  expect(result.bonsaiProgress).toContain(60);
});
