import { vi } from 'vitest';
import type { ModelDownloadProgressDetails } from '../../../src/services/contracts/interfaces';
import { aiModelCatalog } from '../../../src/services/model-setup/aiModelCatalog';
import { modelSetupService } from '../../../src/services/model-setup/modelSetupService';
import type {
  ImageEditingModelLoader,
  ImageGenerationModelLoader,
  LanguageDetectionModelLoader,
  ModelCacheStorage,
  TextGenerationModelLoader,
} from '../../../src/services/model-setup/modelSetupService';
import { imageGenerationModel } from '../../../src/services/image-generation/imageGenerationModel';

describe('modelSetupService.InMemoryModelSetupService', () => {
  it('downloads required models in parallel and exposes progress', async () => {
    const service = new modelSetupService.InMemoryModelSetupService();
    await service.downloadRequiredModels();

    const states = await service.getModelStates();
    expect(
      states.filter((state) => state.required).every((state) => state.status === 'ready'),
    ).toBe(true);
    expect(states).toHaveLength(5);
    expect(states.find((state) => state.id === aiModelCatalog.GEMMA_LLM_MODEL_ID)).toMatchObject({
      label: aiModelCatalog.GEMMA_LLM_DISPLAY_NAME,
      required: false,
      status: 'needs-download',
    });
    expect(
      states.find((state) => state.id === aiModelCatalog.TRANSLATEGEMMA_MODEL_ID),
    ).toMatchObject({
      label: aiModelCatalog.TRANSLATEGEMMA_DISPLAY_NAME,
      required: false,
      status: 'needs-download',
    });
    expect(
      states.find((state) => state.id === aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID),
    ).toMatchObject({
      label: aiModelCatalog.LANGUAGE_DETECTION_DISPLAY_NAME,
      required: false,
      status: 'needs-download',
    });
    expect(states.find((state) => state.id === 'image-editing-models')).toMatchObject({
      id: 'image-editing-models',
      label: 'Image Editing Models',
      description: 'Segmentation model for image editing.',
    });
    expect(
      states.find((state) => state.id === imageGenerationModel.IMAGE_GENERATION_MODEL_ID),
    ).toMatchObject({
      id: imageGenerationModel.IMAGE_GENERATION_MODEL_ID,
      label: 'Image Generation Models',
      description: 'Text-to-image model for generated slide assets.',
      status: 'needs-download',
      required: false,
    });
  });
});

describe('modelSetupService.BrowserModelSetupService', () => {
  function createStorage(seed: Record<string, string> = {}) {
    const values = new Map(Object.entries(seed));
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
  }

  it('downloads and marks the image editing model as browser cached', async () => {
    const loadImageEditingModel = vi.fn(
      (options?: {
        onProgress?: (
          progress: number,
          details?: { loadedBytes?: number; totalBytes?: number },
        ) => void;
      }) => {
        options?.onProgress?.(64, {
          loadedBytes: 120_000_000,
          totalBytes: 190_000_000,
        });
        return Promise.resolve();
      },
    );
    const loader: ImageEditingModelLoader = {
      loadImageEditingModel,
    };
    const storage = createStorage();
    const service = new modelSetupService.BrowserModelSetupService(loader, storage);

    const progressDetails: Array<ModelDownloadProgressDetails | undefined> = [];
    const state = await service.downloadModel('image-editing-models', {
      onProgress: (_value, details) => progressDetails.push(details),
    });

    expect(loadImageEditingModel).toHaveBeenCalledWith(expect.any(Object));
    expect(state).toMatchObject({ status: 'ready', progress: 100 });
    const states = await service.getModelStates();
    expect(states.find((item) => item.id === 'image-editing-models')).toMatchObject({
      status: 'ready',
      progress: 100,
    });
    expect(
      states.find((item) => item.id === imageGenerationModel.IMAGE_GENERATION_MODEL_ID),
    ).toMatchObject({
      status: 'needs-download',
      progress: 0,
    });
    expect(progressDetails[0]).toMatchObject({
      loadedBytes: 120_000_000,
      totalBytes: 190_000_000,
    });
  });

  it('downloads image generation models independently', async () => {
    const loadImageEditingModel = vi.fn().mockResolvedValue(undefined);
    const loadImageGenerationModel = vi.fn(
      (options?: { onProgress?: (progress: number) => void }) => {
        options?.onProgress?.(55);
        return Promise.resolve();
      },
    );
    const imageEditingLoader: ImageEditingModelLoader = {
      loadImageEditingModel,
    };
    const imageGenerationLoader: ImageGenerationModelLoader = {
      loadImageGenerationModel,
    };
    const service = new modelSetupService.BrowserModelSetupService(
      imageEditingLoader,
      createStorage(),
      imageGenerationLoader,
    );

    const progress: number[] = [];
    const state = await service.downloadModel(imageGenerationModel.IMAGE_GENERATION_MODEL_ID, {
      onProgress: (value) => progress.push(value),
    });

    expect(loadImageGenerationModel).toHaveBeenCalledTimes(1);
    expect(loadImageEditingModel).not.toHaveBeenCalled();
    expect(state).toMatchObject({
      id: imageGenerationModel.IMAGE_GENERATION_MODEL_ID,
      status: 'ready',
      progress: 100,
    });
    expect(progress).toEqual([55, 100]);
  });

  it('adds remaining time details to byte-aware model download progress', async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValueOnce(0).mockReturnValueOnce(60_000);
    const loadImageEditingModel = vi.fn().mockResolvedValue(undefined);
    const loadImageGenerationModel = vi.fn(
      (options?: {
        onProgress?: (
          progress: number,
          details?: { loadedBytes?: number; totalBytes?: number },
        ) => void;
      }) => {
        options?.onProgress?.(64, {
          loadedBytes: 1_200_000_000,
          totalBytes: 3_800_000_000,
        });
        return Promise.resolve();
      },
    );
    const service = new modelSetupService.BrowserModelSetupService(
      { loadImageEditingModel },
      createStorage(),
      { loadImageGenerationModel },
    );

    const progressDetails: Array<ModelDownloadProgressDetails | undefined> = [];
    await service.downloadModel(imageGenerationModel.IMAGE_GENERATION_MODEL_ID, {
      onProgress: (_value, details) => progressDetails.push(details),
    });

    expect(progressDetails[0]).toMatchObject({
      loadedBytes: 1_200_000_000,
      totalBytes: 3_800_000_000,
      estimatedRemainingMs: 130_000,
    });
    expect(loadImageGenerationModel).toHaveBeenCalledTimes(1);
    now.mockRestore();
  });

  it('keeps text model progress monotonic when loaders report per-file progress', async () => {
    const loadImageEditingModel = vi.fn().mockResolvedValue(undefined);
    const loadImageGenerationModel = vi.fn().mockResolvedValue(undefined);
    const loadTextGenerationModel = vi.fn(
      (_, options?: { onProgress?: (progress: number) => void }) => {
        options?.onProgress?.(8);
        options?.onProgress?.(18);
        options?.onProgress?.(10);
        options?.onProgress?.(55);
        return Promise.resolve();
      },
    );
    const textGenerationLoader: TextGenerationModelLoader = {
      loadTextGenerationModel,
    };
    const service = new modelSetupService.BrowserModelSetupService(
      { loadImageEditingModel },
      createStorage(),
      { loadImageGenerationModel },
      textGenerationLoader,
    );

    const progress: number[] = [];
    const state = await service.downloadModel(aiModelCatalog.GEMMA_LLM_MODEL_ID, {
      onProgress: (value) => progress.push(value),
    });

    expect(state).toMatchObject({
      id: aiModelCatalog.GEMMA_LLM_MODEL_ID,
      status: 'ready',
      progress: 100,
    });
    expect(progress).toEqual([10, 18, 18, 55, 100]);
  });

  it('releases text generation pipelines after warming the browser cache', async () => {
    const loadImageEditingModel = vi.fn().mockResolvedValue(undefined);
    const loadImageGenerationModel = vi.fn().mockResolvedValue(undefined);
    const loadTextGenerationModel = vi.fn().mockResolvedValue(undefined);
    const releaseTextGenerationModel = vi.fn().mockResolvedValue(undefined);
    const textGenerationLoader: TextGenerationModelLoader & {
      releaseTextGenerationModel: (modelId: string) => Promise<void>;
    } = {
      loadTextGenerationModel,
      releaseTextGenerationModel,
    };
    const service = new modelSetupService.BrowserModelSetupService(
      { loadImageEditingModel },
      createStorage(),
      { loadImageGenerationModel },
      textGenerationLoader,
    );

    await service.downloadModel(aiModelCatalog.GEMMA_LLM_MODEL_ID);

    expect(loadTextGenerationModel).toHaveBeenCalledWith(
      aiModelCatalog.GEMMA_LLM_TRANSFORMERS_MODEL_ID,
      expect.any(Object),
    );
    expect(releaseTextGenerationModel).toHaveBeenCalledWith(
      aiModelCatalog.GEMMA_LLM_TRANSFORMERS_MODEL_ID,
    );
  });

  it('downloads the language detection model independently', async () => {
    const loadImageEditingModel = vi.fn().mockResolvedValue(undefined);
    const loadImageGenerationModel = vi.fn().mockResolvedValue(undefined);
    const loadTextGenerationModel = vi.fn().mockResolvedValue(undefined);
    const loadLanguageDetectionModel = vi.fn(
      (_, options?: { onProgress?: (progress: number) => void }) => {
        options?.onProgress?.(42);
        return Promise.resolve();
      },
    );
    const languageDetectionLoader: LanguageDetectionModelLoader = {
      loadLanguageDetectionModel,
    };
    const service = new modelSetupService.BrowserModelSetupService(
      { loadImageEditingModel },
      createStorage(),
      { loadImageGenerationModel },
      { loadTextGenerationModel },
      undefined,
      languageDetectionLoader,
    );

    const progress: number[] = [];
    const state = await service.downloadModel(aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID, {
      onProgress: (value) => progress.push(value),
    });

    expect(state).toMatchObject({
      id: aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID,
      status: 'ready',
      progress: 100,
    });
    expect(progress).toEqual([42, 100]);
    expect(loadLanguageDetectionModel).toHaveBeenCalledTimes(1);
    expect(loadTextGenerationModel).not.toHaveBeenCalled();
  });

  it('restores ready state from browser cache metadata', async () => {
    const loadImageEditingModel = vi.fn().mockResolvedValue(undefined);
    const loader: ImageEditingModelLoader = {
      loadImageEditingModel,
    };
    const service = new modelSetupService.BrowserModelSetupService(
      loader,
      createStorage({ 'ew-canvas-ai.model.image-editing-models.ready': 'true' }),
    );

    const states = await service.getModelStates();

    expect(states.find((state) => state.id === 'image-editing-models')).toMatchObject({
      status: 'ready',
      progress: 100,
    });
    expect(
      states.find((state) => state.id === imageGenerationModel.IMAGE_GENERATION_MODEL_ID),
    ).toMatchObject({
      status: 'needs-download',
      progress: 0,
    });
    expect(loadImageEditingModel).not.toHaveBeenCalled();
  });

  it('restores image generation ready state from browser cache metadata', async () => {
    const loadImageEditingModel = vi.fn().mockResolvedValue(undefined);
    const loadImageGenerationModel = vi.fn().mockResolvedValue(undefined);
    const service = new modelSetupService.BrowserModelSetupService(
      { loadImageEditingModel },
      createStorage({ 'ew-canvas-ai.model.image-generation-models.runtime-v1.ready': 'true' }),
      { loadImageGenerationModel },
    );

    const states = await service.getModelStates();

    expect(
      states.find((state) => state.id === imageGenerationModel.IMAGE_GENERATION_MODEL_ID),
    ).toMatchObject({
      id: imageGenerationModel.IMAGE_GENERATION_MODEL_ID,
      status: 'ready',
      progress: 100,
    });
    expect(loadImageGenerationModel).not.toHaveBeenCalled();
  });

  it('removes cached model readiness metadata and marks the model downloadable again', async () => {
    const loadImageEditingModel = vi.fn().mockResolvedValue(undefined);
    const storage = createStorage({ 'localstudio.ai.model.translategemma-webgpu.ready': 'true' });
    const removeTextGenerationModel = vi.fn().mockResolvedValue(undefined);
    const deleteModelArtifacts = vi.fn().mockResolvedValue(undefined);
    const textGenerationLoader: TextGenerationModelLoader = {
      loadTextGenerationModel: vi.fn().mockResolvedValue(undefined),
      removeTextGenerationModel,
    };
    const modelCacheStorage: ModelCacheStorage = {
      deleteModelArtifacts,
    };
    const service = new modelSetupService.BrowserModelSetupService(
      { loadImageEditingModel },
      storage,
      undefined,
      textGenerationLoader,
      modelCacheStorage,
    );

    const state = await service.removeModel(aiModelCatalog.TRANSLATEGEMMA_MODEL_ID);

    expect(state).toMatchObject({
      id: aiModelCatalog.TRANSLATEGEMMA_MODEL_ID,
      status: 'needs-download',
      progress: 0,
    });
    expect(storage.getItem('localstudio.ai.model.translategemma-webgpu.ready')).toBe('false');
    expect(removeTextGenerationModel).toHaveBeenCalledWith(
      'onnx-community/translategemma-text-4b-it-ONNX',
    );
    expect(deleteModelArtifacts).toHaveBeenCalledWith(
      'onnx-community/translategemma-text-4b-it-ONNX',
    );
  });

  it('releases image editing runtime state when removing the image editing model', async () => {
    const removeImageEditingModel = vi.fn().mockResolvedValue(undefined);
    const deleteModelArtifacts = vi.fn().mockResolvedValue(undefined);
    const imageEditingLoader: ImageEditingModelLoader & {
      removeImageEditingModel: () => Promise<void>;
    } = {
      loadImageEditingModel: vi.fn().mockResolvedValue(undefined),
      removeImageEditingModel,
    };
    const service = new modelSetupService.BrowserModelSetupService(
      imageEditingLoader,
      createStorage({ 'ew-canvas-ai.model.image-editing-models.ready': 'true' }),
      undefined,
      undefined,
      { deleteModelArtifacts },
    );

    await service.removeModel('image-editing-models');

    expect(removeImageEditingModel).toHaveBeenCalledTimes(1);
    expect(deleteModelArtifacts).toHaveBeenCalledWith('Xenova/slimsam-77-uniform');
  });

  it('removes matching Transformers.js cache entries for a model id', async () => {
    const deletedRequests: string[] = [];
    const cache = {
      keys: vi.fn(() =>
        Promise.resolve([
          new Request(
            'https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX/resolve/main/config.json',
          ),
          new Request(
            'https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX/resolve/main/onnx/model_q4.onnx',
          ),
          new Request(
            'https://huggingface.co/onnx-community/translategemma-text-4b-it-ONNX/resolve/main/config.json',
          ),
        ]),
      ),
      delete: vi.fn((request: Request) => {
        deletedRequests.push(request.url);
        return Promise.resolve(true);
      }),
    };
    vi.stubGlobal('caches', {
      open: vi.fn((cacheName: string) => {
        expect(cacheName).toBe(imageGenerationModel.TRANSFORMERS_CACHE_KEY);
        return Promise.resolve(cache);
      }),
    });

    await new modelSetupService.BrowserTransformersModelCache().deleteModelArtifacts(
      'onnx-community/gemma-4-E2B-it-ONNX',
    );

    expect(deletedRequests).toEqual([
      'https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX/resolve/main/config.json',
      'https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX/resolve/main/onnx/model_q4.onnx',
    ]);
  });

  it('restores language detection ready state from browser cache metadata', async () => {
    const service = new modelSetupService.BrowserModelSetupService(
      { loadImageEditingModel: vi.fn().mockResolvedValue(undefined) },
      createStorage({ 'localstudio.ai.model.language-detection-webgpu.ready': 'true' }),
    );

    const states = await service.getModelStates();

    expect(
      states.find((state) => state.id === aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID),
    ).toMatchObject({
      id: aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID,
      status: 'ready',
      progress: 100,
    });
  });
});
