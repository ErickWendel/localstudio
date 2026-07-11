export type BonsaiRuntimeWorkerPreloadContractResult = {
  bonsaiPreloadProgress: number[];
  bonsaiPreloadRequests: string[];
};

export async function evaluateBonsaiRuntimeWorkerPreloadContract(): Promise<BonsaiRuntimeWorkerPreloadContractResult> {
  const { bonsaiImageRuntime } = (await import(
    '/editor/src/services/image-generation/bonsaiImageRuntime.ts'
  )) as typeof import('../../../apps/editor/src/services/image-generation/bonsaiImageRuntime');

  type Request =
    import('../../../apps/editor/src/services/image-generation/bonsaiImageRuntime').BonsaiImageWorkerRequest;
  type Response =
    import('../../../apps/editor/src/services/image-generation/bonsaiImageRuntime').BonsaiImageWorkerResponse;

  const requests: Request[] = [];
  const worker = {
    onerror: null as ((event: Event | ErrorEvent) => void) | null,
    onmessage: null as ((event: MessageEvent<Response>) => void) | null,
    postMessage(request: Request) {
      requests.push(request);
      queueMicrotask(() => {
        this.onmessage?.({
          data: {
            details: { loadedBytes: 1, totalBytes: 2 },
            id: request.id,
            progress: 50,
            type: 'progress',
          },
        } as MessageEvent<Response>);
        this.onmessage?.({
          data: { id: request.id, type: 'result' },
        } as MessageEvent<Response>);
      });
    },
  };
  const bonsaiProgress: number[] = [];
  const bonsaiRuntime = new bonsaiImageRuntime.WorkerBackedBonsaiImageRuntime({
    createWorker: () => worker as unknown as Worker,
  });
  await bonsaiRuntime.preload('bonsai-model', {
    onProgress: (progress) => bonsaiProgress.push(progress),
  });

  return {
    bonsaiPreloadProgress: bonsaiProgress,
    bonsaiPreloadRequests: requests.map((request) => request.type),
  };
}
