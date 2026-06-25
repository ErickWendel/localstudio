import type { Asset } from '../domain/model';
import { BrowserBonsaiImageRuntime, type BonsaiImageRuntime } from './bonsaiImageRuntime';
import type { ImageGenerationOptions, ImageGenerationService } from './interfaces';
import {
  DEFAULT_IMAGE_GENERATION_SIZE,
  DEFAULT_IMAGE_GENERATION_STEPS,
  IMAGE_GENERATION_TRANSFORMERS_MODEL_ID,
} from './imageGenerationModels';

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
