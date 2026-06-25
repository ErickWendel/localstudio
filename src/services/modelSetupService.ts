import type { ModelSetupService, ModelState } from './interfaces';
import {
  IMAGE_GENERATION_MODEL_ID,
  IMAGE_GENERATION_READY_KEY,
  IMAGE_GENERATION_TRANSFORMERS_MODEL_ID,
  TRANSFORMERS_CACHE_KEY,
} from './imageGenerationModels';
import { BrowserBonsaiImageRuntime } from './bonsaiImageRuntime';

export const IMAGE_EDITING_MODEL_ID = 'image-editing-models';
export const IMAGE_EDITING_TRANSFORMERS_MODEL_ID = 'Xenova/slimsam-77-uniform';

const IMAGE_EDITING_READY_KEY = 'ew-canvas-ai.model.image-editing-models.ready';

interface ModelStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ImageEditingModelLoader {
  loadImageEditingModel(): Promise<void>;
}

export interface ImageGenerationModelLoader {
  loadImageGenerationModel(options?: { onProgress?: (progress: number) => void }): Promise<void>;
}

const initialStates: ModelState[] = [
  {
    id: IMAGE_EDITING_MODEL_ID,
    label: 'Image Editing Models',
    description: 'Segmentation model for image editing.',
    provider: 'transformers',
    status: 'needs-download',
    progress: 0,
    required: true,
  },
  {
    id: IMAGE_GENERATION_MODEL_ID,
    label: 'Image Generation Models',
    description: 'Bonsai Image WebGPU text-to-image model.',
    provider: 'transformers',
    status: 'needs-download',
    progress: 0,
    required: false,
  },
];

function cloneStates(states: ModelState[]) {
  return states.map((state) => ({ ...state }));
}

function getBrowserStorage(): ModelStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}

export class TransformersImageEditingModelLoader implements ImageEditingModelLoader {
  async loadImageEditingModel(): Promise<void> {
    const { AutoProcessor, SamModel, env } = await import('@huggingface/transformers');

    env.useBrowserCache = true;
    env.cacheKey = TRANSFORMERS_CACHE_KEY;

    await Promise.all([
      SamModel.from_pretrained(IMAGE_EDITING_TRANSFORMERS_MODEL_ID, {
        dtype: 'fp16',
        device: 'webgpu',
      }),
      AutoProcessor.from_pretrained(IMAGE_EDITING_TRANSFORMERS_MODEL_ID),
    ]);
  }
}

export class TransformersImageGenerationModelLoader implements ImageGenerationModelLoader {
  async loadImageGenerationModel(options?: { onProgress?: (progress: number) => void }): Promise<void> {
    await new BrowserBonsaiImageRuntime().preload(IMAGE_GENERATION_TRANSFORMERS_MODEL_ID, options);
  }
}

export class BrowserModelSetupService implements ModelSetupService {
  private states: ModelState[];

  constructor(
    private readonly imageEditingModelLoader: ImageEditingModelLoader = new TransformersImageEditingModelLoader(),
    private readonly storage: ModelStorage | undefined = getBrowserStorage(),
    private readonly imageGenerationModelLoader: ImageGenerationModelLoader = new TransformersImageGenerationModelLoader(),
  ) {
    const imageEditingModelReady = storage?.getItem(IMAGE_EDITING_READY_KEY) === 'true';
    const imageGenerationModelReady = storage?.getItem(IMAGE_GENERATION_READY_KEY) === 'true';
    this.states = initialStates.map((state) =>
      state.id === IMAGE_EDITING_MODEL_ID && imageEditingModelReady
        ? { ...state, status: 'ready', progress: 100 }
        : state.id === IMAGE_GENERATION_MODEL_ID && imageGenerationModelReady
          ? { ...state, status: 'ready', progress: 100 }
        : { ...state },
    );
  }

  getModelStates(): Promise<ModelState[]> {
    return Promise.resolve(cloneStates(this.states));
  }

  async downloadRequiredModels(): Promise<ModelState[]> {
    await Promise.all(
      this.states.filter((state) => state.required).map((state) => this.downloadModel(state.id)),
    );
    return this.getModelStates();
  }

  async downloadModel(id: string, options?: { onProgress?: (progress: number) => void }): Promise<ModelState> {
    const current = this.states.find((state) => state.id === id);
    if (!current) throw new Error(`Unknown model: ${id}`);
    if (current.status === 'ready') return { ...current };

    this.setModelState(id, { status: 'downloading', progress: 10, error: undefined });

    try {
      if (id === IMAGE_EDITING_MODEL_ID) {
        await this.imageEditingModelLoader.loadImageEditingModel();
        this.storage?.setItem(IMAGE_EDITING_READY_KEY, 'true');
      }
      if (id === IMAGE_GENERATION_MODEL_ID) {
        await this.imageGenerationModelLoader.loadImageGenerationModel({
          onProgress: (progress) => {
            const boundedProgress = Math.max(10, Math.min(99, Math.round(progress)));
            this.setModelState(id, { status: 'downloading', progress: boundedProgress, error: undefined });
            options?.onProgress?.(boundedProgress);
          },
        });
        this.storage?.setItem(IMAGE_GENERATION_READY_KEY, 'true');
      }
      options?.onProgress?.(100);
      return this.setModelState(id, { status: 'ready', progress: 100, error: undefined });
    } catch (error) {
      if (id === IMAGE_EDITING_MODEL_ID) this.storage?.setItem(IMAGE_EDITING_READY_KEY, 'false');
      if (id === IMAGE_GENERATION_MODEL_ID) this.storage?.setItem(IMAGE_GENERATION_READY_KEY, 'false');
      const message = error instanceof Error ? error.message : 'Model download failed.';
      return this.setModelState(id, { status: 'failed', progress: 0, error: message });
    }
  }

  private setModelState(id: string, patch: Partial<ModelState>) {
    this.states = this.states.map((state) => (state.id === id ? { ...state, ...patch } : state));
    return { ...this.states.find((state) => state.id === id)! };
  }
}

export class InMemoryModelSetupService implements ModelSetupService {
  private states = cloneStates(initialStates);

  getModelStates(): Promise<ModelState[]> {
    return Promise.resolve(cloneStates(this.states));
  }

  async downloadRequiredModels(): Promise<ModelState[]> {
    await Promise.all(
      this.states.filter((state) => state.required).map((state) => this.downloadModel(state.id)),
    );
    return this.getModelStates();
  }

  downloadModel(id: string, options?: { onProgress?: (progress: number) => void }): Promise<ModelState> {
    const current = this.states.find((state) => state.id === id);
    if (!current) throw new Error(`Unknown model: ${id}`);

    options?.onProgress?.(100);
    this.states = this.states.map((state) =>
      state.id === id ? { ...state, status: 'ready', progress: 100, error: undefined } : state,
    );
    return Promise.resolve({ ...this.states.find((state) => state.id === id)! });
  }
}
