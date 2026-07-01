import type { Asset } from '../../domain/documents/model';
import { bonsaiImageRuntime } from './bonsaiImageRuntime';
import type { BonsaiImageRuntime } from './bonsaiImageRuntime';
import type { ImageGenerationOptions, ImageGenerationService } from '../contracts/interfaces';
import { imageGenerationModel } from './imageGenerationModel';
import { createPrefixedId } from '../ids/idUtils';

interface BrowserImageGenerationServiceOptions {
  createId?: (prefix: string) => string;
  createObjectUrl?: (blob: Blob) => string;
  runtime?: BonsaiImageRuntime;
}

function sanitizeImageName(prompt: string) {
  const safeName = prompt.trim().replace(/\s+/g, ' ').slice(0, 48);
  return `${safeName || 'Generated image'}.png`;
}

export class BrowserImageGenerationService implements ImageGenerationService {
  private readonly runtime: BonsaiImageRuntime;

  constructor(private readonly options: BrowserImageGenerationServiceOptions = {}) {
    this.runtime = options.runtime ?? new bonsaiImageRuntime.WorkerBackedBonsaiImageRuntime();
  }

  async generateImage(prompt: string, options: ImageGenerationOptions = {}): Promise<Asset> {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) throw new Error('Enter a prompt before generating an image.');

    const steps = options.steps ?? imageGenerationModel.DEFAULT_IMAGE_GENERATION_STEPS;
    const blob = await this.runtime.generate({
      modelId: imageGenerationModel.IMAGE_GENERATION_TRANSFORMERS_MODEL_ID,
      prompt: trimmedPrompt,
      height: options.height ?? imageGenerationModel.DEFAULT_IMAGE_GENERATION_SIZE,
      width: options.width ?? imageGenerationModel.DEFAULT_IMAGE_GENERATION_SIZE,
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
      id: this.options.createId?.('asset-generated-image') ?? createPrefixedId('asset-generated-image'),
      type: 'image',
      name: sanitizeImageName(trimmedPrompt),
      mimeType: blob.type || 'image/png',
      objectUrl: this.options.createObjectUrl?.(blob) ?? URL.createObjectURL(blob),
    };
  }
}
