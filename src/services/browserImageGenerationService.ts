import type { Asset } from '../domain/model';
import type { ImageGenerationOptions, ImageGenerationService } from './interfaces';
import {
  DEFAULT_IMAGE_GENERATION_SIZE,
  DEFAULT_IMAGE_GENERATION_STEPS,
  IMAGE_GENERATION_TRANSFORMERS_MODEL_ID,
} from './imageGenerationModels';

interface BonsaiImageRuntimeGenerateOptions {
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

interface BonsaiRuntimeProgress {
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

interface BrowserImageGenerationServiceOptions {
  createId?: (prefix: string) => string;
  createObjectUrl?: (blob: Blob) => string;
  runtime?: BonsaiImageRuntime;
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

function defaultCreateId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}`;
}

function sanitizeImageName(prompt: string) {
  const safeName = prompt.trim().replace(/\s+/g, ' ').slice(0, 48);
  return `${safeName || 'Generated image'}.png`;
}

async function resultToBlob(result: BonsaiPipelineResult | Blob) {
  if (result instanceof Blob) return result;
  if (typeof result.toBlob === 'function') {
    return await result.toBlob();
  }
  throw new Error('Bonsai Image WebGPU did not return a PNG blob.');
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
      const preloadOptions: {
        cacheName: string;
        onProgress?: (progress: BonsaiRuntimeProgress) => void;
      } = {
        cacheName: this.options.cacheName ?? BONSAI_RUNTIME_CACHE_NAME,
      };
      if (options.onProgress) {
        preloadOptions.onProgress = createBonsaiRuntimeProgressReporter(options.onProgress);
      }
      const pipeline = await module.BonsaiImagePipeline.from_pretrained(modelId, preloadOptions);
      void deleteLegacyBonsaiModelCache();
      return pipeline;
    });
    return this.pipelinePromise;
  }

  private async importRuntimeModule() {
    if (this.options.importRuntime) return this.options.importRuntime();
    const runtimeUrl = '/vendor/bonsai-image-webgpu-runtime.js';
    return (await import(/* @vite-ignore */ runtimeUrl)) as BonsaiRuntimeModule;
  }
}

async function deleteLegacyBonsaiModelCache() {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(LEGACY_BONSAI_MODEL_CACHE_NAME);
  } catch {
    // Best-effort cleanup only. The old cache is not used by the Bonsai runtime.
  }
}

function createBonsaiRuntimeProgressReporter(onProgress: (progress: number) => void) {
  const componentProgress = new Map<string, { loaded: number; total: number }>();
  let lastProgress = -1;
  const report = () => {
    const total = Object.values(BONSAI_COMPONENT_TOTALS).reduce((sum, value) => sum + value, 0);
    const loaded = Object.entries(BONSAI_COMPONENT_TOTALS).reduce((sum, [component, fallbackTotal]) => {
      const progress = componentProgress.get(component);
      return sum + Math.min(progress?.loaded ?? 0, progress?.total ?? fallbackTotal);
    }, 0);
    const nextProgress = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
    if (nextProgress <= lastProgress) return;
    lastProgress = nextProgress;
    onProgress(nextProgress);
  };

  return (progress: BonsaiRuntimeProgress) => {
    if (progress.phase === 'init') {
      onProgress(1);
      return;
    }
    if (!progress.component) return;
    const fallbackTotal = BONSAI_COMPONENT_TOTALS[progress.component] ?? progress.total ?? 1;
    componentProgress.set(progress.component, {
      loaded: Math.max(0, progress.loaded ?? 0),
      total: Math.max(1, progress.total ?? fallbackTotal),
    });
    report();
  };
}

export class BrowserImageGenerationService implements ImageGenerationService {
  private readonly runtime: BonsaiImageRuntime;

  constructor(private readonly options: BrowserImageGenerationServiceOptions = {}) {
    this.runtime = options.runtime ?? new BrowserBonsaiImageRuntime();
  }

  async generateImage(prompt: string, options: ImageGenerationOptions = {}): Promise<Asset> {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) throw new Error('Enter a prompt before generating an image.');

    const steps = options.steps ?? DEFAULT_IMAGE_GENERATION_STEPS;
    const blob = await this.runtime.generate({
      modelId: IMAGE_GENERATION_TRANSFORMERS_MODEL_ID,
      prompt: trimmedPrompt,
      height: options.height ?? DEFAULT_IMAGE_GENERATION_SIZE,
      width: options.width ?? DEFAULT_IMAGE_GENERATION_SIZE,
      steps,
      ...(options.seed !== undefined ? { seed: options.seed } : {}),
      onLoadProgress: (progress) => {
        options.onProgress?.({
          label: 'Preparing image model',
          progress: Math.max(1, Math.min(99, Math.round(progress))),
        });
      },
      onStep: (step, totalSteps) => {
        options.onProgress?.({
          label: `Generating image ${step}/${totalSteps}`,
          progress: Math.round((step / totalSteps) * 100),
        });
      },
    });

    return {
      id: this.options.createId?.('asset-generated-image') ?? defaultCreateId('asset-generated-image'),
      type: 'image',
      name: sanitizeImageName(trimmedPrompt),
      mimeType: blob.type || 'image/png',
      objectUrl: this.options.createObjectUrl?.(blob) ?? URL.createObjectURL(blob),
    };
  }
}
