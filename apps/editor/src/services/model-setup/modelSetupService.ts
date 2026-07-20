import type {
  ModelDownloadProgressDetails,
  ModelSetupService,
  ModelState,
} from '../contracts/interfaces';
import { aiModelCatalog } from './aiModelCatalog';
import { imageGenerationModel } from '../image-generation/imageGenerationModel';
import { bonsaiImageRuntime } from '../image-generation/bonsaiImageRuntime';
import { browserStorage } from '../browser/browserStorage';
import type { BrowserKeyValueStorage } from '../browser/browserStorage';
import { progress } from './progress';
import { TransformersRuntimeClient } from './transformersRuntimeClient';

const IMAGE_EDITING_MODEL_ID = 'image-editing-models';
const IMAGE_EDITING_TRANSFORMERS_MODEL_ID = 'Xenova/slimsam-77-uniform';
const IMAGE_EDITING_DISPLAY_NAME = 'SlimSAM 77M';

const IMAGE_EDITING_READY_KEY = 'ew-canvas-ai.model.image-editing-models.ready';

export interface ImageEditingModelLoader {
  loadImageEditingModel(options?: {
    onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
  }): Promise<void>;
  removeImageEditingModel?(): Promise<void>;
}

export interface ImageGenerationModelLoader {
  loadImageGenerationModel(options?: {
    onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
  }): Promise<void>;
}

export interface TextGenerationModelLoader {
  loadTextGenerationModel(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void>;
  removeTextGenerationModel?(modelId: string): Promise<void>;
  releaseTextGenerationModel?(modelId: string): Promise<void> | void;
}

export interface LanguageDetectionModelLoader {
  loadLanguageDetectionModel(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void>;
}

export interface ModelCacheStorage {
  deleteModelArtifacts(modelId: string): Promise<void>;
}

const initialStates: ModelState[] = [
  {
    id: aiModelCatalog.GEMMA_LLM_MODEL_ID,
    label: aiModelCatalog.GEMMA_LLM_DISPLAY_NAME,
    description: 'Browser-local LLM model for prompt-to-slides.',
    provider: 'transformers',
    status: 'needs-download',
    progress: 0,
    required: false,
  },
  {
    id: aiModelCatalog.TRANSLATEGEMMA_MODEL_ID,
    label: aiModelCatalog.TRANSLATEGEMMA_DISPLAY_NAME,
    description: 'Browser-local translation model.',
    provider: 'transformers',
    status: 'needs-download',
    progress: 0,
    required: false,
  },
  {
    id: aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID,
    label: aiModelCatalog.LANGUAGE_DETECTION_DISPLAY_NAME,
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
    id: imageGenerationModel.IMAGE_GENERATION_MODEL_ID,
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

function getReadyKey(id: string) {
  if (id === IMAGE_EDITING_MODEL_ID) return IMAGE_EDITING_READY_KEY;
  if (id === imageGenerationModel.IMAGE_GENERATION_MODEL_ID)
    return imageGenerationModel.IMAGE_GENERATION_READY_KEY;
  if (id === aiModelCatalog.GEMMA_LLM_MODEL_ID) return aiModelCatalog.GEMMA_LLM_READY_KEY;
  if (id === aiModelCatalog.TRANSLATEGEMMA_MODEL_ID) return aiModelCatalog.TRANSLATEGEMMA_READY_KEY;
  if (id === aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID)
    return aiModelCatalog.LANGUAGE_DETECTION_READY_KEY;
  return undefined;
}

class TransformersImageEditingModelLoader implements ImageEditingModelLoader {
  constructor(private readonly runtimeClient = new TransformersRuntimeClient()) {}

  async loadImageEditingModel(options?: {
    onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
  }): Promise<void> {
    await this.runtimeClient.preloadImageEditing(options);
  }

  async removeImageEditingModel(): Promise<void> {
    await this.runtimeClient.removeImageEditing();
  }
}

class TransformersImageGenerationModelLoader implements ImageGenerationModelLoader {
  async loadImageGenerationModel(options?: {
    onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
  }): Promise<void> {
    await new bonsaiImageRuntime.WorkerBackedBonsaiImageRuntime().preload(
      imageGenerationModel.IMAGE_GENERATION_TRANSFORMERS_MODEL_ID,
      options,
    );
  }
}

class TransformersTextGenerationModelLoader implements TextGenerationModelLoader {
  constructor(private readonly runtimeClient = new TransformersRuntimeClient()) {}

  async loadTextGenerationModel(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void> {
    await this.runtimeClient.preloadTextGeneration(modelId, options);
  }

  releaseTextGenerationModel(modelId: string): Promise<void> {
    return this.runtimeClient.releaseTextGeneration(modelId);
  }

  removeTextGenerationModel(modelId: string): Promise<void> {
    return this.runtimeClient.removeTextGeneration(modelId);
  }
}

class TransformersLanguageDetectionModelLoader implements LanguageDetectionModelLoader {
  constructor(private readonly runtimeClient = new TransformersRuntimeClient()) {}

  async loadLanguageDetectionModel(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void> {
    await this.runtimeClient.preloadLanguageDetection(modelId, options);
  }
}

function withoutProgressDetails(patch: Partial<ModelState>): Partial<ModelState> {
  if (patch.status === 'downloading') return patch;
  return {
    ...patch,
    estimatedRemainingMs: undefined,
    loadedBytes: undefined,
    totalBytes: undefined,
  };
}

class BrowserTransformersModelCache implements ModelCacheStorage {
  async deleteModelArtifacts(modelId: string): Promise<void> {
    if (typeof caches === 'undefined') return;

    const normalizedModelId = modelId.toLowerCase();
    const encodedModelId = encodeURIComponent(modelId).toLowerCase();
    const cache = await caches.open(imageGenerationModel.TRANSFORMERS_CACHE_KEY);
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

class BrowserModelSetupService implements ModelSetupService {
  private states: ModelState[];

  constructor(
    private readonly imageEditingModelLoader: ImageEditingModelLoader = new TransformersImageEditingModelLoader(),
    private readonly storage:
      | BrowserKeyValueStorage
      | undefined = browserStorage.getBrowserLocalStorage(),
    private readonly imageGenerationModelLoader: ImageGenerationModelLoader = new TransformersImageGenerationModelLoader(),
    private readonly textGenerationModelLoader: TextGenerationModelLoader = new TransformersTextGenerationModelLoader(),
    private readonly modelCacheStorage: ModelCacheStorage = new BrowserTransformersModelCache(),
    private readonly languageDetectionModelLoader: LanguageDetectionModelLoader = new TransformersLanguageDetectionModelLoader(),
  ) {
    const imageEditingModelReady = storage?.getItem(IMAGE_EDITING_READY_KEY) === 'true';
    const imageGenerationModelReady =
      storage?.getItem(imageGenerationModel.IMAGE_GENERATION_READY_KEY) === 'true';
    const gemmaLlmReady = storage?.getItem(aiModelCatalog.GEMMA_LLM_READY_KEY) === 'true';
    const translateGemmaReady =
      storage?.getItem(aiModelCatalog.TRANSLATEGEMMA_READY_KEY) === 'true';
    const languageDetectionReady =
      storage?.getItem(aiModelCatalog.LANGUAGE_DETECTION_READY_KEY) === 'true';
    this.states = initialStates.map((state) =>
      state.id === aiModelCatalog.GEMMA_LLM_MODEL_ID && gemmaLlmReady
        ? { ...state, status: 'ready', progress: 100 }
        : state.id === aiModelCatalog.TRANSLATEGEMMA_MODEL_ID && translateGemmaReady
          ? { ...state, status: 'ready', progress: 100 }
          : state.id === aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID && languageDetectionReady
            ? { ...state, status: 'ready', progress: 100 }
            : state.id === IMAGE_EDITING_MODEL_ID && imageEditingModelReady
              ? { ...state, status: 'ready', progress: 100 }
              : state.id === imageGenerationModel.IMAGE_GENERATION_MODEL_ID &&
                  imageGenerationModelReady
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

  async downloadModel(
    id: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<ModelState> {
    const current = this.states.find((state) => state.id === id);
    if (!current) throw new Error(`Unknown model: ${id}`);
    if (current.status === 'ready') return { ...current };

    const startedAt = Date.now();
    this.setModelState(id, { status: 'downloading', progress: 10, error: undefined });
    const reportProgress = progress.createMonotonicProgressReporter(
      (progress, details) => {
        const nextDetails = this.withRemainingTime(startedAt, details);
        this.setModelState(id, {
          status: 'downloading',
          progress,
          error: undefined,
          ...nextDetails,
        });
        options?.onProgress?.(progress, nextDetails);
      },
      { initial: 10, min: 10, max: 99 },
    );

    try {
      if (id === IMAGE_EDITING_MODEL_ID) {
        await this.imageEditingModelLoader.loadImageEditingModel({
          onProgress: reportProgress,
        });
        this.storage?.setItem(IMAGE_EDITING_READY_KEY, 'true');
      }
      if (id === imageGenerationModel.IMAGE_GENERATION_MODEL_ID) {
        await this.imageGenerationModelLoader.loadImageGenerationModel({
          onProgress: reportProgress,
        });
        this.storage?.setItem(imageGenerationModel.IMAGE_GENERATION_READY_KEY, 'true');
      }
      if (id === aiModelCatalog.GEMMA_LLM_MODEL_ID) {
        await this.textGenerationModelLoader.loadTextGenerationModel(
          aiModelCatalog.GEMMA_LLM_TRANSFORMERS_MODEL_ID,
          {
            onProgress: reportProgress,
          },
        );
        await this.textGenerationModelLoader.releaseTextGenerationModel?.(
          aiModelCatalog.GEMMA_LLM_TRANSFORMERS_MODEL_ID,
        );
        this.storage?.setItem(aiModelCatalog.GEMMA_LLM_READY_KEY, 'true');
      }
      if (id === aiModelCatalog.TRANSLATEGEMMA_MODEL_ID) {
        await this.textGenerationModelLoader.loadTextGenerationModel(
          aiModelCatalog.TRANSLATEGEMMA_TRANSFORMERS_MODEL_ID,
          {
            onProgress: reportProgress,
          },
        );
        await this.textGenerationModelLoader.releaseTextGenerationModel?.(
          aiModelCatalog.TRANSLATEGEMMA_TRANSFORMERS_MODEL_ID,
        );
        this.storage?.setItem(aiModelCatalog.TRANSLATEGEMMA_READY_KEY, 'true');
      }
      if (id === aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID) {
        await this.languageDetectionModelLoader.loadLanguageDetectionModel(
          aiModelCatalog.LANGUAGE_DETECTION_TRANSFORMERS_MODEL_ID,
          {
            onProgress: reportProgress,
          },
        );
        this.storage?.setItem(aiModelCatalog.LANGUAGE_DETECTION_READY_KEY, 'true');
      }
      options?.onProgress?.(100);
      return this.setModelState(id, { status: 'ready', progress: 100, error: undefined });
    } catch (error) {
      if (id === IMAGE_EDITING_MODEL_ID) this.storage?.setItem(IMAGE_EDITING_READY_KEY, 'false');
      if (id === imageGenerationModel.IMAGE_GENERATION_MODEL_ID)
        this.storage?.setItem(imageGenerationModel.IMAGE_GENERATION_READY_KEY, 'false');
      if (id === aiModelCatalog.GEMMA_LLM_MODEL_ID)
        this.storage?.setItem(aiModelCatalog.GEMMA_LLM_READY_KEY, 'false');
      if (id === aiModelCatalog.TRANSLATEGEMMA_MODEL_ID)
        this.storage?.setItem(aiModelCatalog.TRANSLATEGEMMA_READY_KEY, 'false');
      if (id === aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID)
        this.storage?.setItem(aiModelCatalog.LANGUAGE_DETECTION_READY_KEY, 'false');
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

    if (id === aiModelCatalog.GEMMA_LLM_MODEL_ID) {
      await this.textGenerationModelLoader.removeTextGenerationModel?.(
        aiModelCatalog.GEMMA_LLM_TRANSFORMERS_MODEL_ID,
      );
      await this.modelCacheStorage.deleteModelArtifacts(
        aiModelCatalog.GEMMA_LLM_TRANSFORMERS_MODEL_ID,
      );
    }
    if (id === aiModelCatalog.TRANSLATEGEMMA_MODEL_ID) {
      await this.textGenerationModelLoader.removeTextGenerationModel?.(
        aiModelCatalog.TRANSLATEGEMMA_TRANSFORMERS_MODEL_ID,
      );
      await this.modelCacheStorage.deleteModelArtifacts(
        aiModelCatalog.TRANSLATEGEMMA_TRANSFORMERS_MODEL_ID,
      );
    }
    if (id === IMAGE_EDITING_MODEL_ID) {
      await this.imageEditingModelLoader.removeImageEditingModel?.();
      await this.modelCacheStorage.deleteModelArtifacts(IMAGE_EDITING_TRANSFORMERS_MODEL_ID);
    }
    if (id === imageGenerationModel.IMAGE_GENERATION_MODEL_ID) {
      await this.modelCacheStorage.deleteModelArtifacts(
        imageGenerationModel.IMAGE_GENERATION_TRANSFORMERS_MODEL_ID,
      );
    }
    return this.setModelState(id, { status: 'needs-download', progress: 0, error: undefined });
  }

  private setModelState(id: string, patch: Partial<ModelState>) {
    this.states = this.states.map((state) =>
      state.id === id ? { ...state, ...withoutProgressDetails(patch) } : state,
    );
    return { ...this.states.find((state) => state.id === id)! };
  }

  private withRemainingTime(
    startedAt: number,
    details: ModelDownloadProgressDetails | undefined,
  ): ModelDownloadProgressDetails | undefined {
    if (!details) return undefined;
    const estimatedRemainingMs = progress.estimateRemainingMs({
      elapsedMs: Date.now() - startedAt,
      loadedBytes: details.loadedBytes,
      totalBytes: details.totalBytes,
    });
    return {
      ...details,
      estimatedRemainingMs,
    };
  }
}

class InMemoryModelSetupService implements ModelSetupService {
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

  downloadModel(
    id: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<ModelState> {
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
      state.id === id
        ? { ...state, status: 'needs-download', progress: 0, error: undefined }
        : state,
    );
    return Promise.resolve({ ...this.states.find((state) => state.id === id)! });
  }
}

export const modelSetupService = {
  IMAGE_EDITING_MODEL_ID,
  IMAGE_EDITING_TRANSFORMERS_MODEL_ID,
  IMAGE_EDITING_DISPLAY_NAME,
  TransformersImageEditingModelLoader,
  TransformersImageGenerationModelLoader,
  TransformersTextGenerationModelLoader,
  TransformersLanguageDetectionModelLoader,
  BrowserTransformersModelCache,
  BrowserModelSetupService,
  InMemoryModelSetupService,
};
