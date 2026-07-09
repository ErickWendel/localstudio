import type { ModelDownloadProgressDetails } from '../contracts/interfaces';
import type { BonsaiImageRuntime, BonsaiImageRuntimeGenerateOptions } from './bonsaiImageRuntime';

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

function createBonsaiRuntimeProgressController(
  onProgress: (progress: number, details?: ModelDownloadProgressDetails) => void,
) {
  const componentProgress = new Map<string, { loaded: number; total: number }>();
  let estimateTimer: ReturnType<typeof setInterval> | undefined;
  let lastProgress = -1;

  const emitProgress = (progress: number, details?: ModelDownloadProgressDetails) => {
    const nextProgress = Math.max(0, Math.min(100, Math.round(progress)));
    if (nextProgress <= lastProgress) return;
    lastProgress = nextProgress;
    onProgress(nextProgress, details);
  };

  const getCompleteComponentDetails = () => {
    const expectedComponents = Object.keys(BONSAI_COMPONENT_TOTALS);
    if (!expectedComponents.every((component) => componentProgress.has(component))) return undefined;

    const loadedBytes = expectedComponents.reduce((sum, component) => {
      const progress = componentProgress.get(component);
      return sum + Math.min(progress?.loaded ?? 0, progress?.total ?? 0);
    }, 0);
    const totalBytes = expectedComponents.reduce((sum, component) => {
      const progress = componentProgress.get(component);
      return sum + (progress?.total ?? 0);
    }, 0);

    return totalBytes > 0 ? { loadedBytes, totalBytes } : undefined;
  };

  const reportComponentProgress = () => {
    const total = Object.values(BONSAI_COMPONENT_TOTALS).reduce((sum, value) => sum + value, 0);
    const loaded = Object.entries(BONSAI_COMPONENT_TOTALS).reduce(
      (sum, [component, fallbackTotal]) => {
        const progress = componentProgress.get(component);
        return sum + Math.min(progress?.loaded ?? 0, progress?.total ?? fallbackTotal);
      },
      0,
    );
    emitProgress((loaded / total) * 100, getCompleteComponentDetails());
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

    if (
      progress.component &&
      Number.isFinite(progress.loaded) &&
      Number.isFinite(progress.total) &&
      (progress.total ?? 0) > 0
    ) {
      const fallbackTotal = BONSAI_COMPONENT_TOTALS[progress.component] ?? progress.total ?? 1;
      componentProgress.set(progress.component, {
        loaded: Math.max(0, progress.loaded ?? 0),
        total: Math.max(1, progress.total ?? fallbackTotal),
      });
      reportComponentProgress();
      return;
    }

    if (
      Number.isFinite(progress.loaded) &&
      Number.isFinite(progress.total) &&
      (progress.total ?? 0) > 0
    ) {
      emitProgress(((progress.loaded ?? 0) / (progress.total ?? 1)) * 100, {
        loadedBytes: Math.max(0, progress.loaded ?? 0),
        totalBytes: Math.max(1, progress.total ?? 1),
      });
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

class BrowserBonsaiImageRuntime implements BonsaiImageRuntime {
  private pipelinePromise: Promise<BonsaiPipeline> | undefined;

  constructor(private readonly options: BrowserBonsaiImageRuntimeOptions = {}) {}

  async preload(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void> {
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
    options: {
      onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
    } = {},
  ): Promise<BonsaiPipeline> {
    this.pipelinePromise ??= this.importRuntimeModule().then(async (module) => {
      const progressReporter = options.onProgress
        ? createBonsaiRuntimeProgressController(options.onProgress)
        : undefined;
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
      : ((await import('../../vendor/bonsai-image-webgpu-runtime.js')) as BonsaiRuntimeModule);
  }
}

export const directBonsaiImageRuntime = {
  BrowserBonsaiImageRuntime,
};
