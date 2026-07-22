export type TranscriptEmbeddingContractResult = {
  embedTexts: string[];
  errorMessage: string;
  ignoredUnknownResponse: true;
  preloadProgress: number[];
  searchIds: string[];
  terminated: boolean;
};

export async function evaluateTranscriptEmbeddingContract(): Promise<TranscriptEmbeddingContractResult> {
  const [{ TranscriptEmbeddingRuntimeClient }, { transcriptionModelCatalog }] =
    (await Promise.all([
      import('/editor/src/services/transcription/transcriptEmbeddingRuntimeClient.ts'),
      import('/editor/src/services/transcription/transcriptionModelCatalog.ts'),
    ])) as [
      typeof import('../../../apps/editor/src/services/transcription/transcriptEmbeddingRuntimeClient'),
      typeof import('../../../apps/editor/src/services/transcription/transcriptionModelCatalog'),
    ];

  const preset = transcriptionModelCatalog.getEmbeddingPreset('default-minilm');
  const preloadProgress: number[] = [];
  const embedTexts: string[] = [];
  let terminated = false;

  class ContractWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;

    postMessage(message: { id: string; texts?: string[]; type: string }) {
      if (message.type === 'preload') {
        this.onmessage?.(
          new MessageEvent('message', {
            data: {
              details: { loadedBytes: 25, totalBytes: 100 },
              id: message.id,
              progress: 25,
              type: 'progress',
            },
          }),
        );
        this.onmessage?.(
          new MessageEvent('message', {
            data: { embeddings: undefined, id: message.id, type: 'result' },
          }),
        );
        return;
      }
      if (message.type === 'embed') {
        embedTexts.push(...(message.texts ?? []));
        if (message.texts?.includes('fail')) {
          this.onmessage?.(
            new MessageEvent('message', {
              data: { id: message.id, message: 'embedding failed', type: 'error' },
            }),
          );
          return;
        }
        const embeddings = (message.texts ?? []).map((text) =>
          text.includes('alpha') || text.includes('query') ? [1, 0] : [0, 1],
        );
        this.onmessage?.(
          new MessageEvent('message', {
            data: { id: 'unknown-request', progress: 99, type: 'progress' },
          }),
        );
        this.onmessage?.(
          new MessageEvent('message', {
            data: { embeddings, id: message.id, type: 'result' },
          }),
        );
      }
    }

    terminate() {
      terminated = true;
      this.onmessage = null;
    }
  }

  const client = new TranscriptEmbeddingRuntimeClient(
    () => new ContractWorker() as unknown as Worker,
  );
  await client.preload(preset, { onProgress: (progress) => preloadProgress.push(progress) });
  const searchResults = await client.search(
    preset,
    'query alpha',
    [
      { embedding: [0, 1], id: 'beta' },
      { embedding: [1, 0], id: 'alpha' },
    ],
    1,
  );
  let errorMessage = 'missing-error';
  try {
    await client.embed(preset, ['fail']);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }
  client.terminate();

  return {
    embedTexts,
    errorMessage,
    ignoredUnknownResponse: true,
    preloadProgress,
    searchIds: searchResults.map((result) => result.id),
    terminated,
  };
}
