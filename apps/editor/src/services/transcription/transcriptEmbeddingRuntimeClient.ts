import type { ModelDownloadProgressDetails } from '../contracts/interfaces';
import type { TranscriptEmbeddingPreset } from './transcriptionModelCatalog';

export type TranscriptEmbeddingWorkerRequest =
  | {
      id: string;
      preset: TranscriptEmbeddingPreset;
      type: 'preload';
    }
  | {
      id: string;
      preset: TranscriptEmbeddingPreset;
      texts: string[];
      type: 'embed';
    };

export type TranscriptEmbeddingWorkerResponse =
  | {
      details?: ModelDownloadProgressDetails;
      id: string;
      progress: number;
      type: 'progress';
    }
  | {
      embeddings?: number[][];
      id: string;
      type: 'result';
    }
  | {
      id: string;
      message: string;
      type: 'error';
    };

interface PendingEmbeddingRequest {
  onProgress?: ((progress: number, details?: ModelDownloadProgressDetails) => void) | undefined;
  reject: (error: Error) => void;
  resolve: (embeddings: number[][] | undefined) => void;
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `embedding-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultWorker() {
  return new Worker(new URL('./transcriptEmbeddingRuntime.worker.ts', import.meta.url), {
    type: 'module',
  });
}

function dotProduct(left: number[], right: number[]) {
  return left.reduce((total, value, index) => total + value * (right[index] ?? 0), 0);
}

export class TranscriptEmbeddingRuntimeClient {
  private pendingRequests = new Map<string, PendingEmbeddingRequest>();
  private worker: Worker | undefined;

  constructor(private readonly createWorker: () => Worker = createDefaultWorker) {}

  preload(
    preset: TranscriptEmbeddingPreset,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ) {
    return this.request({ id: createRequestId(), preset, type: 'preload' }, options).then(
      () => undefined,
    );
  }

  async embed(preset: TranscriptEmbeddingPreset, texts: string[]) {
    const embeddings = await this.request({ id: createRequestId(), preset, texts, type: 'embed' });
    return embeddings ?? [];
  }

  async search<TEntry extends { embedding: number[] }>(
    preset: TranscriptEmbeddingPreset,
    query: string,
    entries: TEntry[],
    limit = 4,
  ) {
    const [queryEmbedding] = await this.embed(preset, [query]);
    if (!queryEmbedding) return [];
    return entries
      .map((entry) => ({
        ...entry,
        score: dotProduct(queryEmbedding, entry.embedding),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  terminate() {
    this.worker?.terminate();
    this.worker = undefined;
  }

  private request(
    request: TranscriptEmbeddingWorkerRequest,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ) {
    return new Promise<number[][] | undefined>((resolve, reject) => {
      this.ensureWorker();
      this.pendingRequests.set(request.id, {
        onProgress: options?.onProgress,
        reject,
        resolve,
      });
      this.worker!.postMessage(request);
    });
  }

  private ensureWorker() {
    if (this.worker) return;
    this.worker = this.createWorker();
    this.worker.onmessage = (event: MessageEvent<TranscriptEmbeddingWorkerResponse>) => {
      const response = event.data;
      const pendingRequest = this.pendingRequests.get(response.id);
      if (!pendingRequest) return;
      if (response.type === 'progress') {
        pendingRequest.onProgress?.(response.progress, response.details);
        return;
      }
      this.pendingRequests.delete(response.id);
      if (response.type === 'error') {
        pendingRequest.reject(new Error(response.message));
        return;
      }
      pendingRequest.resolve(response.embeddings);
    };
  }
}
