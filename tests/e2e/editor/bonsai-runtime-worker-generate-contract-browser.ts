export type BonsaiRuntimeWorkerGenerateContractResult = {
  bonsaiBlobText: string;
  bonsaiGenerateProgress: number[];
  bonsaiGenerateRequests: string[];
  bonsaiSteps: string[];
};

export async function evaluateBonsaiRuntimeWorkerGenerateContract(): Promise<BonsaiRuntimeWorkerGenerateContractResult> {
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
          data: { id: request.id, progress: 60, type: 'progress' },
        } as MessageEvent<Response>);
        if (request.type !== 'generate') return;
        this.onmessage?.({
          data: { id: request.id, step: 1, totalSteps: request.options.steps, type: 'step' },
        } as MessageEvent<Response>);
        this.onmessage?.({
          data: {
            blob: new Blob([`image:${request.options.prompt}`], { type: 'image/png' }),
            id: request.id,
            type: 'result',
          },
        } as MessageEvent<Response>);
      });
    },
  };
  const bonsaiProgress: number[] = [];
  const bonsaiSteps: string[] = [];
  const bonsaiRuntime = new bonsaiImageRuntime.WorkerBackedBonsaiImageRuntime({
    createWorker: () => worker as unknown as Worker,
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

  return {
    bonsaiBlobText: await bonsaiBlob.text(),
    bonsaiGenerateProgress: bonsaiProgress,
    bonsaiGenerateRequests: requests.map((request) => request.type),
    bonsaiSteps,
  };
}
