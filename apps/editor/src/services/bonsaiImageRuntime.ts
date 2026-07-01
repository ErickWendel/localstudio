export interface BonsaiImageRuntimeGenerateOptions {
  height: number;
  modelId: string;
  onLoadProgress?: (progress: number) => void;
  prompt: string;
  seed?: number;
  steps: number;
  width: number;
  onStep?: (step: number, totalSteps: number) => void;
}

export interface BonsaiImageRuntime {
  preload(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void>;
  generate(options: BonsaiImageRuntimeGenerateOptions): Promise<Blob>;
}

interface BonsaiPipelineResult {
  toBlob?: () => Blob | Promise<Blob>;
}

export interface BonsaiRuntimeProgress {
  component?: string;
  fromCache?: boolean;
  loaded?: number;
  phase?: string;
  total?: number;
}

interface BonsaiPipeline {
  generate(options: {
    callback_on_step_end?: (_pipeline: unknown, step: number) => void;
    guidance_scale: 1;
    height: number;
    num_inference_steps: number;
    prompt: string;
    seed?: number;
    width: number;
  }): Promise<BonsaiPipelineResult | Blob>;
}

interface BonsaiPipelineConstructor {
  from_pretrained(
    modelId: string,
    options?: {
      cacheName?: string;
      onProgress?: (progress: BonsaiRuntimeProgress) => void;
      signal?: AbortSignal;
    },
  ): Promise<BonsaiPipeline>;
}

interface BonsaiRuntimeModule {
  BonsaiImagePipeline: BonsaiPipelineConstructor;
}

interface BrowserBonsaiImageRuntimeOptions {
  cacheName?: string;
  importRuntime?: () => Promise<BonsaiRuntimeModule>;
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
  onLoadProgress?: ((progress: number) => void) | undefined;
  onStep?: ((step: number, totalSteps: number) => void) | undefined;
  reject: (error: Error) => void;
  resolve: (blob?: Blob) => void;
}

const BONSAI_RUNTIME_CACHE_NAME = 'localstudio-ai-bonsai-image-runtime-v1';
const LEGACY_BONSAI_MODEL_CACHE_NAME = 'localstudio-ai-bonsai-image-models-v1';
const BONSAI_COMPONENT_TOTALS: Record<string, number> = {
  text_encoder: 1_700_000_000,
  transformer: 1_300_000_000,
  vae: 95_000_000,
};

async function resultToBlob(result: BonsaiPipelineResult | Blob) {
  if (result instanceof Blob) return result;
  if (typeof result.toBlob === 'function') {
    return await result.toBlob();
  }
  throw new Error('Bonsai Image WebGPU did not return a PNG blob.');
}

async function deleteLegacyBonsaiModelCache() {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(LEGACY_BONSAI_MODEL_CACHE_NAME);
  } catch {
    // Best-effort cleanup only. The old cache is not used by the Bonsai runtime.
  }
}

function createBonsaiRuntimeProgressController(onProgress: (progress: number) => void) {
  const componentProgress = new Map<string, { loaded: number; total: number }>();
  let estimateTimer: ReturnType<typeof setInterval> | undefined;
  let lastProgress = -1;

  const emitProgress = (progress: number) => {
    const nextProgress = Math.max(0, Math.min(100, Math.round(progress)));
    if (nextProgress <= lastProgress) return;
    lastProgress = nextProgress;
    onProgress(nextProgress);
  };

  const reportComponentProgress = () => {
    const total = Object.values(BONSAI_COMPONENT_TOTALS).reduce((sum, value) => sum + value, 0);
    const loaded = Object.entries(BONSAI_COMPONENT_TOTALS).reduce((sum, [component, fallbackTotal]) => {
      const progress = componentProgress.get(component);
      return sum + Math.min(progress?.loaded ?? 0, progress?.total ?? fallbackTotal);
    }, 0);
    emitProgress((loaded / total) * 100);
  };

  const reportRuntimeProgress = (progress: BonsaiRuntimeProgress) => {
    if (progress.phase === 'init') emitProgress(3);

    if (progress.phase === 'open' && progress.component) {
      const componentFloor: Record<string, number> = {
        text_encoder: 12,
        transformer: 45,
        vae: 85,
      };
      emitProgress(componentFloor[progress.component] ?? 10);
    }

    if (progress.component) {
      const fallbackTotal = BONSAI_COMPONENT_TOTALS[progress.component] ?? progress.total ?? 1;
      componentProgress.set(progress.component, {
        loaded: Math.max(0, progress.loaded ?? 0),
        total: Math.max(1, progress.total ?? fallbackTotal),
      });
      reportComponentProgress();
      return;
    }

    if (Number.isFinite(progress.loaded) && Number.isFinite(progress.total) && (progress.total ?? 0) > 0) {
      emitProgress(((progress.loaded ?? 0) / (progress.total ?? 1)) * 100);
    }
  };

  const startEstimate = () => {
    emitProgress(3);
    estimateTimer = setInterval(() => {
      if (lastProgress >= 92) return;
      const increment = lastProgress < 35 ? 2 : lastProgress < 70 ? 1 : 0.5;
      emitProgress(Math.min(92, lastProgress + increment));
    }, 1_500);
  };

  const stopEstimate = () => {
    if (estimateTimer === undefined) return;
    clearInterval(estimateTimer);
    estimateTimer = undefined;
  };

  return {
    reportRuntimeProgress,
    startEstimate,
    stopEstimate,
    complete: () => {
      stopEstimate();
      emitProgress(100);
    },
  };
}

export class BrowserBonsaiImageRuntime implements BonsaiImageRuntime {
  private pipelinePromise: Promise<BonsaiPipeline> | undefined;

  constructor(private readonly options: BrowserBonsaiImageRuntimeOptions = {}) {}

  async preload(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void> {
    await this.loadPipeline(modelId, options?.onProgress ? { onProgress: options.onProgress } : {});
  }

  async generate(options: BonsaiImageRuntimeGenerateOptions): Promise<Blob> {
    const pipeline = await this.loadPipeline(
      options.modelId,
      options.onLoadProgress ? { onProgress: options.onLoadProgress } : {},
    );
    const result = await pipeline.generate({
      prompt: options.prompt,
      height: options.height,
      width: options.width,
      guidance_scale: 1,
      num_inference_steps: options.steps,
      ...(options.seed !== undefined ? { seed: options.seed } : {}),
      callback_on_step_end: (_pipeline, step) => {
        options.onStep?.(step + 1, options.steps);
      },
    });
    return resultToBlob(result);
  }

  private async loadPipeline(
    modelId: string,
    options: { onProgress?: (progress: number) => void } = {},
  ): Promise<BonsaiPipeline> {
    this.pipelinePromise ??= this.importRuntimeModule().then(async (module) => {
      const progressReporter = options.onProgress ? createBonsaiRuntimeProgressController(options.onProgress) : undefined;
      const preloadOptions: {
        cacheName: string;
        onProgress?: (progress: BonsaiRuntimeProgress) => void;
      } = {
        cacheName: this.options.cacheName ?? BONSAI_RUNTIME_CACHE_NAME,
      };
      if (progressReporter) {
        preloadOptions.onProgress = progressReporter.reportRuntimeProgress;
        progressReporter.startEstimate();
      }
      try {
        const pipeline = await module.BonsaiImagePipeline.from_pretrained(modelId, preloadOptions);
        progressReporter?.complete();
        void deleteLegacyBonsaiModelCache();
        return pipeline;
      } catch (error) {
        progressReporter?.stopEstimate();
        throw error;
      }
    });
    return this.pipelinePromise;
  }

  private async importRuntimeModule() {
    return this.options.importRuntime
      ? this.options.importRuntime()
      : ((await import('../vendor/bonsai-image-webgpu-runtime.js')) as BonsaiRuntimeModule);
  }
}

export class WorkerBackedBonsaiImageRuntime implements BonsaiImageRuntime {
  private fallbackRuntime: BonsaiImageRuntime | undefined;
  private pendingRequests = new Map<string, PendingWorkerRequest>();
  private worker: Worker | undefined;

  constructor(private readonly options: WorkerBackedBonsaiImageRuntimeOptions = {}) {}

  preload(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void> {
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
      pending.onLoadProgress?.(response.progress);
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
      return fallback.preload(
        request.modelId,
        handlers.onLoadProgress ? { onProgress: handlers.onLoadProgress } : undefined,
      ).then(() => undefined);
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
