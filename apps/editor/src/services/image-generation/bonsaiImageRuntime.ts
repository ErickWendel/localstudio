import type { ModelDownloadProgressDetails } from '../contracts/interfaces';

export interface BonsaiImageRuntimeGenerateOptions {
  height: number;
  modelId: string;
  onLoadProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
  prompt: string;
  seed?: number;
  steps: number;
  width: number;
  onStep?: (step: number, totalSteps: number) => void;
}

export interface BonsaiImageRuntime {
  preload(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void>;
  generate(options: BonsaiImageRuntimeGenerateOptions): Promise<Blob>;
}

export type BonsaiImageWorkerRequest =
  | {
      id: string;
      modelId: string;
      type: 'preload';
    }
  | {
      id: string;
      options: Omit<BonsaiImageRuntimeGenerateOptions, 'onLoadProgress' | 'onStep'>;
      type: 'generate';
    };

export type BonsaiImageWorkerResponse =
  | {
      details?: ModelDownloadProgressDetails;
      id: string;
      progress: number;
      type: 'progress';
    }
  | {
      id: string;
      step: number;
      totalSteps: number;
      type: 'step';
    }
  | {
      blob?: Blob;
      id: string;
      type: 'result';
    }
  | {
      id: string;
      message: string;
      type: 'error';
    };

interface WorkerBackedBonsaiImageRuntimeOptions {
  createWorker?: () => Worker;
  fallbackRuntime?: BonsaiImageRuntime;
}

interface PendingWorkerRequest {
  onLoadProgress?: ((progress: number, details?: ModelDownloadProgressDetails) => void) | undefined;
  onStep?: ((step: number, totalSteps: number) => void) | undefined;
  reject: (error: Error) => void;
  resolve: (blob?: Blob) => void;
}

class WorkerBackedBonsaiImageRuntime implements BonsaiImageRuntime {
  private fallbackRuntime: BonsaiImageRuntime | undefined;
  private pendingRequests = new Map<string, PendingWorkerRequest>();
  private worker: Worker | undefined;

  constructor(private readonly options: WorkerBackedBonsaiImageRuntimeOptions = {}) {}

  preload(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void> {
    if (this.fallbackRuntime) return this.fallbackRuntime.preload(modelId, options);
    return this.request(
      {
        id: createRequestId(),
        modelId,
        type: 'preload',
      },
      { onLoadProgress: options?.onProgress },
    ).then(() => undefined);
  }

  async generate(options: BonsaiImageRuntimeGenerateOptions): Promise<Blob> {
    if (this.fallbackRuntime) return this.fallbackRuntime.generate(options);
    const { onLoadProgress, onStep, ...workerOptions } = options;
    const blob = await this.request(
      {
        id: createRequestId(),
        options: workerOptions,
        type: 'generate',
      },
      { onLoadProgress, onStep },
    );
    if (!blob) throw new Error('Bonsai image worker did not return an image.');
    return blob;
  }

  private request(
    request: BonsaiImageWorkerRequest,
    handlers: Pick<PendingWorkerRequest, 'onLoadProgress' | 'onStep'> = {},
  ) {
    const worker = this.getWorker();
    if (!worker) {
      return this.executeFallbackRequest(request, handlers);
    }

    return new Promise<Blob | undefined>((resolve, reject) => {
      this.pendingRequests.set(request.id, {
        ...handlers,
        reject,
        resolve,
      });
      worker.postMessage(request);
    });
  }

  private getWorker() {
    if (this.worker) return this.worker;
    try {
      const worker = this.options.createWorker?.() ?? createDefaultBonsaiWorker();
      worker.onmessage = (event: MessageEvent<BonsaiImageWorkerResponse>) => {
        this.handleWorkerResponse(event.data);
      };
      worker.onerror = (event) => {
        const message = event instanceof ErrorEvent ? event.message : 'Bonsai image worker failed.';
        this.rejectAllPending(message);
      };
      this.worker = worker;
      return worker;
    } catch {
      this.fallbackRuntime = this.getFallbackRuntime();
      return undefined;
    }
  }

  private getFallbackRuntime() {
    if (!this.options.fallbackRuntime) {
      throw new Error('Web workers are required for browser image generation.');
    }
    this.fallbackRuntime ??= this.options.fallbackRuntime;
    return this.fallbackRuntime;
  }

  private handleWorkerResponse(response: BonsaiImageWorkerResponse) {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;
    if (response.type === 'progress') {
      pending.onLoadProgress?.(response.progress, response.details);
      return;
    }
    if (response.type === 'step') {
      pending.onStep?.(response.step, response.totalSteps);
      return;
    }
    this.pendingRequests.delete(response.id);
    if (response.type === 'error') {
      pending.reject(new Error(response.message));
      return;
    }
    pending.resolve(response.blob);
  }

  private rejectAllPending(message: string) {
    for (const [id, pending] of this.pendingRequests) {
      this.pendingRequests.delete(id);
      pending.reject(new Error(message));
    }
  }

  private executeFallbackRequest(
    request: BonsaiImageWorkerRequest,
    handlers: Pick<PendingWorkerRequest, 'onLoadProgress' | 'onStep'> = {},
  ): Promise<Blob | undefined> {
    const fallback = this.getFallbackRuntime();
    if (request.type === 'preload') {
      return fallback
        .preload(
          request.modelId,
          handlers.onLoadProgress ? { onProgress: handlers.onLoadProgress } : undefined,
        )
        .then(() => undefined);
    }
    return fallback.generate({
      ...request.options,
      ...(handlers.onLoadProgress ? { onLoadProgress: handlers.onLoadProgress } : {}),
      ...(handlers.onStep ? { onStep: handlers.onStep } : {}),
    });
  }
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `bonsai-request-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function createDefaultBonsaiWorker() {
  if (typeof Worker === 'undefined') throw new Error('Web workers are not available.');
  return new Worker(new URL('./bonsaiImageRuntime.worker.ts', import.meta.url), {
    type: 'module',
  });
}

export const bonsaiImageRuntime = {
  WorkerBackedBonsaiImageRuntime,
};
