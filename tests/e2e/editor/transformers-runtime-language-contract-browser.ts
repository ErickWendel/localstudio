export type TransformersRuntimeLanguageContractResult = {
  detectedLanguage: unknown;
  progressEvents: Array<{ details?: unknown; progress: number }>;
  requests: string[];
};

export async function evaluateTransformersRuntimeLanguageContract(): Promise<TransformersRuntimeLanguageContractResult> {
  const { TransformersRuntimeClient } = (await import(
    '/editor/src/services/model-setup/transformersRuntimeClient.ts'
  )) as typeof import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient');

  type WorkerRequest =
    import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient').TransformersWorkerRequest;
  type WorkerResponse =
    import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient').TransformersWorkerResponse;

  class LanguageWorker {
    onerror: ((event: Event | ErrorEvent) => void) | null = null;
    onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
    requests: WorkerRequest[] = [];

    postMessage(request: WorkerRequest) {
      this.requests.push(request);
      queueMicrotask(() => {
        if (request.type === 'detect-language') {
          this.onmessage?.({
            data: {
              id: request.id,
              result: { language: request.text.includes('hola') ? 'es' : 'en', score: 0.92 },
              type: 'result',
            },
          } as MessageEvent<WorkerResponse>);
          return;
        }
        this.onmessage?.({
          data: {
            details: { loadedBytes: 5, totalBytes: 10 },
            id: request.id,
            progress: 50,
            type: 'progress',
          },
        } as MessageEvent<WorkerResponse>);
        this.onmessage?.({ data: { id: request.id, type: 'result' } } as MessageEvent<WorkerResponse>);
      });
    }
  }

  const progressEvents: Array<{ details?: unknown; progress: number }> = [];
  const worker = new LanguageWorker();
  const client = new TransformersRuntimeClient({ createWorker: () => worker as unknown as Worker });
  await client.preloadLanguageDetection('language-model', {
    onProgress: (progress, details) => progressEvents.push({ details, progress }),
  });
  const detectedLanguage = await client.detectLanguage('language-model', 'hola mundo');

  return {
    detectedLanguage,
    progressEvents,
    requests: worker.requests.map((request) => request.type),
  };
}
