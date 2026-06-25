import type { Asset } from '../domain/model';
import type { ImageGenerationOptions, ImageGenerationService } from './interfaces';
import {
  DEFAULT_IMAGE_GENERATION_SIZE,
  DEFAULT_IMAGE_GENERATION_STEPS,
  IMAGE_GENERATION_TRANSFORMERS_MODEL_ID,
  TRANSFORMERS_CACHE_KEY,
} from './imageGenerationModels';

interface BonsaiImageRuntimeGenerateOptions {
  height: number;
  modelId: string;
  prompt: string;
  seed?: number;
  steps: number;
  width: number;
  onStep?: (step: number, totalSteps: number) => void;
}

export interface BonsaiImageRuntime {
  preload(modelId: string): Promise<void>;
  generate(options: BonsaiImageRuntimeGenerateOptions): Promise<Blob>;
}

interface BonsaiPipelineResult {
  toBlob?: () => Blob | Promise<Blob>;
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

interface BrowserImageGenerationServiceOptions {
  createId?: (prefix: string) => string;
  createObjectUrl?: (blob: Blob) => string;
  runtime?: BonsaiImageRuntime;
}

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

  preload(modelId: string): Promise<void> {
    return this.loadPipeline(modelId).then(() => undefined);
  }

  async generate(options: BonsaiImageRuntimeGenerateOptions): Promise<Blob> {
    const pipeline = await this.loadPipeline(options.modelId);
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

  private async loadPipeline(modelId: string): Promise<BonsaiPipeline> {
    this.pipelinePromise ??= import('@huggingface/transformers').then(async (module) => {
      module.env.useBrowserCache = true;
      module.env.cacheKey = TRANSFORMERS_CACHE_KEY;

      const pipelineFactory = (module as unknown as {
        pipeline?: (
          task: string,
          model: string,
          options: { device: 'webgpu' },
        ) => Promise<BonsaiPipeline>;
      }).pipeline;
      if (typeof pipelineFactory !== 'function') {
        throw new Error('Bonsai Image WebGPU runtime is unavailable in this browser build.');
      }
      return pipelineFactory('text-to-image', modelId, { device: 'webgpu' });
    });
    return this.pipelinePromise;
  }
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
