/* eslint-disable @typescript-eslint/no-base-to-string */
export type TransformersRuntimeTextContractResult = {
  generatedText: string;
  progressEvents: Array<{ details?: unknown; progress: number }>;
  requests: string[];
};

export async function evaluateTransformersRuntimeTextContract(): Promise<TransformersRuntimeTextContractResult> {
  const { TransformersRuntimeClient } = (await import(
    '/editor/src/services/model-setup/transformersRuntimeClient.ts'
  )) as typeof import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient');

  type WorkerRequest =
    import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient').TransformersWorkerRequest;
  type WorkerResponse =
    import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient').TransformersWorkerResponse;

  class TextWorker {
    onerror: ((event: Event | ErrorEvent) => void) | null = null;
    onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
    requests: WorkerRequest[] = [];

    postMessage(request: WorkerRequest) {
      this.requests.push(request);
      queueMicrotask(() => {
        if (request.type === 'generate-text') {
          this.onmessage?.({ data: { id: request.id, progress: 35, type: 'progress' } } as MessageEvent<WorkerResponse>);
          this.onmessage?.({
            data: { id: request.id, result: `generated:${String(request.prompt)}`, type: 'result' },
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
  const worker = new TextWorker();
  const client = new TransformersRuntimeClient({ createWorker: () => worker as unknown as Worker });
  await client.preloadTextGeneration('llm-model', {
    onProgress: (progress, details) => progressEvents.push({ details, progress }),
  });
  const generatedText = await client.generateText('llm-model', 'hello');
  await client.releaseTextGeneration('llm-model');
  await client.removeTextGeneration('llm-model');

  return {
    generatedText,
    progressEvents,
    requests: worker.requests.map((request) => request.type),
  };
}
