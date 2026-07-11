export type TransformersRuntimeImageContractResult = {
  progressEvents: Array<{ details?: unknown; progress: number }>;
  requests: string[];
  segmentationScore: number;
};

export async function evaluateTransformersRuntimeImageContract(): Promise<TransformersRuntimeImageContractResult> {
  const { TransformersRuntimeClient } = (await import(
    '/editor/src/services/model-setup/transformersRuntimeClient.ts'
  )) as typeof import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient');

  type WorkerRequest =
    import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient').TransformersWorkerRequest;
  type WorkerResponse =
    import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient').TransformersWorkerResponse;

  class ImageEditingWorker {
    onerror: ((event: Event | ErrorEvent) => void) | null = null;
    onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
    requests: WorkerRequest[] = [];

    postMessage(request: WorkerRequest) {
      this.requests.push(request);
      queueMicrotask(() => {
        if (request.type === 'segment-background-removal') {
          this.onmessage?.({
            data: {
              id: request.id,
              result: {
                imageInput: { channels: 4, data: new Uint8Array([1, 2, 3, 255]), height: 1, width: 1 },
                subjectMask: { data: new Uint8Array([1]), height: 1, score: 0.87, width: 1 },
              },
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
  const worker = new ImageEditingWorker();
  const client = new TransformersRuntimeClient({ createWorker: () => worker as unknown as Worker });
  await client.preloadImageEditing({
    onProgress: (progress, details) => progressEvents.push({ details, progress }),
  });
  await client.prepareBackgroundRemoval('asset://image', {
    onProgress: (progress) => progressEvents.push({ progress }),
  });
  const segmentation = await client.segmentBackgroundRemoval('asset://image', [
    { positive: true, x: 0.25, y: 0.5 },
  ]);
  await client.removeImageEditing();

  return {
    progressEvents,
    requests: worker.requests.map((request) => request.type),
    segmentationScore: segmentation.subjectMask.score,
  };
}
