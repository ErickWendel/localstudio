import type { ModelSetupService, ModelState } from './interfaces';
import {
  GEMMA_LLM_DISPLAY_NAME,
  GEMMA_LLM_MODEL_ID,
  GEMMA_LLM_READY_KEY,
  GEMMA_LLM_TRANSFORMERS_MODEL_ID,
  LANGUAGE_DETECTION_DISPLAY_NAME,
  LANGUAGE_DETECTION_MODEL_ID,
  LANGUAGE_DETECTION_READY_KEY,
  LANGUAGE_DETECTION_TRANSFORMERS_MODEL_ID,
  TRANSLATEGEMMA_DISPLAY_NAME,
  TRANSLATEGEMMA_MODEL_ID,
  TRANSLATEGEMMA_READY_KEY,
  TRANSLATEGEMMA_TRANSFORMERS_MODEL_ID,
} from './aiModelIds';
import {
  IMAGE_GENERATION_MODEL_ID,
  IMAGE_GENERATION_READY_KEY,
  IMAGE_GENERATION_TRANSFORMERS_MODEL_ID,
  TRANSFORMERS_CACHE_KEY,
} from './imageGenerationModels';
import { BrowserBonsaiImageRuntime } from './bonsaiImageRuntime';
import { createMonotonicProgressReporter, createTransformersProgressCallback } from './progress';

export const IMAGE_EDITING_MODEL_ID = 'image-editing-models';
export const IMAGE_EDITING_TRANSFORMERS_MODEL_ID = 'Xenova/slimsam-77-uniform';
export const IMAGE_EDITING_DISPLAY_NAME = 'SlimSAM 77M';

const IMAGE_EDITING_READY_KEY = 'ew-canvas-ai.model.image-editing-models.ready';

interface ModelStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface ImageEditingModelLoader {
  loadImageEditingModel(): Promise<void>;
}

export interface ImageGenerationModelLoader {
  loadImageGenerationModel(options?: { onProgress?: (progress: number) => void }): Promise<void>;
}

export interface TextGenerationModelLoader {
  loadTextGenerationModel(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void>;
  removeTextGenerationModel?(modelId: string): Promise<void>;
  releaseTextGenerationModel?(modelId: string): Promise<void> | void;
}

export interface LanguageDetectionModelLoader {
  loadLanguageDetectionModel(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void>;
}

export interface ModelCacheStorage {
  deleteModelArtifacts(modelId: string): Promise<void>;
}

const initialStates: ModelState[] = [
  {
    id: GEMMA_LLM_MODEL_ID,
    label: GEMMA_LLM_DISPLAY_NAME,
    description: 'Browser-local LLM model for prompt-to-slides.',
    provider: 'transformers',
    status: 'needs-download',
    progress: 0,
    required: false,
  },
  {
    id: TRANSLATEGEMMA_MODEL_ID,
    label: TRANSLATEGEMMA_DISPLAY_NAME,
    description: 'Browser-local translation model.',
    provider: 'transformers',
    status: 'needs-download',
    progress: 0,
    required: false,
  },
  {
    id: LANGUAGE_DETECTION_MODEL_ID,
    label: LANGUAGE_DETECTION_DISPLAY_NAME,
    description: 'Browser-local fallback detector for slide text language.',
    provider: 'transformers',
    status: 'needs-download',
    progress: 0,
    required: false,
  },
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
    description: 'Text-to-image model for generated slide assets.',
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

function getReadyKey(id: string) {
  if (id === IMAGE_EDITING_MODEL_ID) return IMAGE_EDITING_READY_KEY;
  if (id === IMAGE_GENERATION_MODEL_ID) return IMAGE_GENERATION_READY_KEY;
  if (id === GEMMA_LLM_MODEL_ID) return GEMMA_LLM_READY_KEY;
  if (id === TRANSLATEGEMMA_MODEL_ID) return TRANSLATEGEMMA_READY_KEY;
  if (id === LANGUAGE_DETECTION_MODEL_ID) return LANGUAGE_DETECTION_READY_KEY;
  return undefined;
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

export class TransformersTextGenerationModelLoader implements TextGenerationModelLoader {
  async loadTextGenerationModel(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void> {
    const { pipeline, env } = await import('@huggingface/transformers');

    env.useBrowserCache = true;
    env.cacheKey = TRANSFORMERS_CACHE_KEY;

    const textGeneration = await pipeline('text-generation', modelId, {
      dtype: 'q4',
      device: 'webgpu',
      progress_callback: createTransformersProgressCallback(options?.onProgress),
    });
    await (textGeneration as { dispose?: () => Promise<void> | void }).dispose?.();
  }
}

export class TransformersLanguageDetectionModelLoader implements LanguageDetectionModelLoader {
  async loadLanguageDetectionModel(
    modelId: string,
    options?: { onProgress?: (progress: number) => void },
  ): Promise<void> {
    const { pipeline, env } = await import('@huggingface/transformers');

    env.useBrowserCache = true;
    env.cacheKey = TRANSFORMERS_CACHE_KEY;

    const detector = await pipeline('text-classification', modelId, {
      device: 'webgpu',
      progress_callback: createTransformersProgressCallback(options?.onProgress),
    });
    await (detector as { dispose?: () => Promise<void> | void }).dispose?.();
  }
}

export class BrowserTransformersModelCache implements ModelCacheStorage {
  async deleteModelArtifacts(modelId: string): Promise<void> {
    if (typeof caches === 'undefined') return;

    const normalizedModelId = modelId.toLowerCase();
    const encodedModelId = encodeURIComponent(modelId).toLowerCase();
    const cache = await caches.open(TRANSFORMERS_CACHE_KEY);
    const requests = await cache.keys();
    await Promise.all(
      requests
        .filter((request) => {
          const url = request.url.toLowerCase();
          return url.includes(normalizedModelId) || url.includes(encodedModelId);
        })
        .map((request) => cache.delete(request)),
    );
  }
}

export class BrowserModelSetupService implements ModelSetupService {
  private states: ModelState[];

  constructor(
    private readonly imageEditingModelLoader: ImageEditingModelLoader = new TransformersImageEditingModelLoader(),
    private readonly storage: ModelStorage | undefined = getBrowserStorage(),
    private readonly imageGenerationModelLoader: ImageGenerationModelLoader = new TransformersImageGenerationModelLoader(),
    private readonly textGenerationModelLoader: TextGenerationModelLoader = new TransformersTextGenerationModelLoader(),
    private readonly modelCacheStorage: ModelCacheStorage = new BrowserTransformersModelCache(),
    private readonly languageDetectionModelLoader: LanguageDetectionModelLoader = new TransformersLanguageDetectionModelLoader(),
  ) {
    const imageEditingModelReady = storage?.getItem(IMAGE_EDITING_READY_KEY) === 'true';
    const imageGenerationModelReady = storage?.getItem(IMAGE_GENERATION_READY_KEY) === 'true';
    const gemmaLlmReady = storage?.getItem(GEMMA_LLM_READY_KEY) === 'true';
    const translateGemmaReady = storage?.getItem(TRANSLATEGEMMA_READY_KEY) === 'true';
    const languageDetectionReady = storage?.getItem(LANGUAGE_DETECTION_READY_KEY) === 'true';
    this.states = initialStates.map((state) =>
      state.id === GEMMA_LLM_MODEL_ID && gemmaLlmReady
        ? { ...state, status: 'ready', progress: 100 }
        : state.id === TRANSLATEGEMMA_MODEL_ID && translateGemmaReady
          ? { ...state, status: 'ready', progress: 100 }
        : state.id === LANGUAGE_DETECTION_MODEL_ID && languageDetectionReady
          ? { ...state, status: 'ready', progress: 100 }
        : state.id === IMAGE_EDITING_MODEL_ID && imageEditingModelReady
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
    const reportProgress = createMonotonicProgressReporter(
      (progress) => {
        this.setModelState(id, { status: 'downloading', progress, error: undefined });
        options?.onProgress?.(progress);
      },
      { initial: 10, min: 10, max: 99 },
    );

    try {
      if (id === IMAGE_EDITING_MODEL_ID) {
        await this.imageEditingModelLoader.loadImageEditingModel();
        this.storage?.setItem(IMAGE_EDITING_READY_KEY, 'true');
      }
      if (id === IMAGE_GENERATION_MODEL_ID) {
        await this.imageGenerationModelLoader.loadImageGenerationModel({
          onProgress: reportProgress,
        });
        this.storage?.setItem(IMAGE_GENERATION_READY_KEY, 'true');
      }
      if (id === GEMMA_LLM_MODEL_ID) {
        await this.textGenerationModelLoader.loadTextGenerationModel(GEMMA_LLM_TRANSFORMERS_MODEL_ID, {
          onProgress: reportProgress,
        });
        await this.textGenerationModelLoader.releaseTextGenerationModel?.(GEMMA_LLM_TRANSFORMERS_MODEL_ID);
        this.storage?.setItem(GEMMA_LLM_READY_KEY, 'true');
      }
      if (id === TRANSLATEGEMMA_MODEL_ID) {
        await this.textGenerationModelLoader.loadTextGenerationModel(TRANSLATEGEMMA_TRANSFORMERS_MODEL_ID, {
          onProgress: reportProgress,
        });
        await this.textGenerationModelLoader.releaseTextGenerationModel?.(TRANSLATEGEMMA_TRANSFORMERS_MODEL_ID);
        this.storage?.setItem(TRANSLATEGEMMA_READY_KEY, 'true');
      }
      if (id === LANGUAGE_DETECTION_MODEL_ID) {
        await this.languageDetectionModelLoader.loadLanguageDetectionModel(LANGUAGE_DETECTION_TRANSFORMERS_MODEL_ID, {
          onProgress: reportProgress,
        });
        this.storage?.setItem(LANGUAGE_DETECTION_READY_KEY, 'true');
      }
      options?.onProgress?.(100);
      return this.setModelState(id, { status: 'ready', progress: 100, error: undefined });
    } catch (error) {
      if (id === IMAGE_EDITING_MODEL_ID) this.storage?.setItem(IMAGE_EDITING_READY_KEY, 'false');
      if (id === IMAGE_GENERATION_MODEL_ID) this.storage?.setItem(IMAGE_GENERATION_READY_KEY, 'false');
      if (id === GEMMA_LLM_MODEL_ID) this.storage?.setItem(GEMMA_LLM_READY_KEY, 'false');
      if (id === TRANSLATEGEMMA_MODEL_ID) this.storage?.setItem(TRANSLATEGEMMA_READY_KEY, 'false');
      if (id === LANGUAGE_DETECTION_MODEL_ID) this.storage?.setItem(LANGUAGE_DETECTION_READY_KEY, 'false');
      const message = error instanceof Error ? error.message : 'Model download failed.';
      return this.setModelState(id, { status: 'failed', progress: 0, error: message });
    }
  }

  async removeModel(id: string): Promise<ModelState> {
    const current = this.states.find((state) => state.id === id);
    if (!current) throw new Error(`Unknown model: ${id}`);

    const readyKey = getReadyKey(id);
    if (readyKey) {
      this.storage?.removeItem?.(readyKey);
      this.storage?.setItem(readyKey, 'false');
    }

    if (id === GEMMA_LLM_MODEL_ID) {
      await this.textGenerationModelLoader.removeTextGenerationModel?.(GEMMA_LLM_TRANSFORMERS_MODEL_ID);
      await this.modelCacheStorage.deleteModelArtifacts(GEMMA_LLM_TRANSFORMERS_MODEL_ID);
    }
    if (id === TRANSLATEGEMMA_MODEL_ID) {
      await this.textGenerationModelLoader.removeTextGenerationModel?.(TRANSLATEGEMMA_TRANSFORMERS_MODEL_ID);
      await this.modelCacheStorage.deleteModelArtifacts(TRANSLATEGEMMA_TRANSFORMERS_MODEL_ID);
    }
    if (id === IMAGE_EDITING_MODEL_ID) {
      await this.modelCacheStorage.deleteModelArtifacts(IMAGE_EDITING_TRANSFORMERS_MODEL_ID);
    }
    if (id === IMAGE_GENERATION_MODEL_ID) {
      await this.modelCacheStorage.deleteModelArtifacts(IMAGE_GENERATION_TRANSFORMERS_MODEL_ID);
    }

    return this.setModelState(id, { status: 'needs-download', progress: 0, error: undefined });
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

  removeModel(id: string): Promise<ModelState> {
    const current = this.states.find((state) => state.id === id);
    if (!current) throw new Error(`Unknown model: ${id}`);

    this.states = this.states.map((state) =>
      state.id === id ? { ...state, status: 'needs-download', progress: 0, error: undefined } : state,
    );
    return Promise.resolve({ ...this.states.find((state) => state.id === id)! });
  }
}
