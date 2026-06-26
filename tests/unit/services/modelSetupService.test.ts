import { vi } from 'vitest';
import { GEMMA_LLM_MODEL_ID, TRANSLATEGEMMA_MODEL_ID } from '../../../src/services/aiModelIds';
import {
  BrowserModelSetupService,
  InMemoryModelSetupService,
  type ImageEditingModelLoader,
  type ImageGenerationModelLoader,
  type TextGenerationModelLoader,
} from '../../../src/services/modelSetupService';
import { IMAGE_GENERATION_MODEL_ID } from '../../../src/services/imageGenerationModels';

describe('InMemoryModelSetupService', () => {
  it('downloads required models in parallel and exposes progress', async () => {
    const service = new InMemoryModelSetupService();
    await service.downloadRequiredModels();

    const states = await service.getModelStates();
    expect(states.filter((state) => state.required).every((state) => state.status === 'ready')).toBe(true);
    expect(states).toHaveLength(4);
    expect(states.find((state) => state.id === GEMMA_LLM_MODEL_ID)).toMatchObject({
      label: 'Gemma 4 WebGPU LLM',
      required: false,
      status: 'needs-download',
    });
    expect(states.find((state) => state.id === TRANSLATEGEMMA_MODEL_ID)).toMatchObject({
      label: 'TranslateGemma WebGPU',
      required: false,
      status: 'needs-download',
    });
    expect(states.find((state) => state.id === 'image-editing-models')).toMatchObject({
      id: 'image-editing-models',
      label: 'Image Editing Models',
      description: 'Segmentation model for image editing.',
    });
    expect(states.find((state) => state.id === IMAGE_GENERATION_MODEL_ID)).toMatchObject({
      id: IMAGE_GENERATION_MODEL_ID,
      label: 'Image Generation Models',
      description: 'Bonsai Image WebGPU text-to-image model.',
      status: 'needs-download',
      required: false,
    });
  });
});

describe('BrowserModelSetupService', () => {
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
    const loadImageEditingModel = vi.fn().mockResolvedValue(undefined);
    const loader: ImageEditingModelLoader = {
      loadImageEditingModel,
    };
    const storage = createStorage();
    const service = new BrowserModelSetupService(loader, storage);

    const state = await service.downloadModel('image-editing-models');

    expect(loadImageEditingModel).toHaveBeenCalledTimes(1);
    expect(state).toMatchObject({ status: 'ready', progress: 100 });
    const states = await service.getModelStates();
    expect(states.find((item) => item.id === 'image-editing-models')).toMatchObject({ status: 'ready', progress: 100 });
    expect(states.find((item) => item.id === IMAGE_GENERATION_MODEL_ID)).toMatchObject({
      status: 'needs-download',
      progress: 0,
    });
  });

  it('downloads image generation models independently', async () => {
    const loadImageEditingModel = vi.fn().mockResolvedValue(undefined);
    const loadImageGenerationModel = vi.fn((options?: { onProgress?: (progress: number) => void }) => {
      options?.onProgress?.(55);
      return Promise.resolve();
    });
    const imageEditingLoader: ImageEditingModelLoader = {
      loadImageEditingModel,
    };
    const imageGenerationLoader: ImageGenerationModelLoader = {
      loadImageGenerationModel,
    };
    const service = new BrowserModelSetupService(imageEditingLoader, createStorage(), imageGenerationLoader);

    const progress: number[] = [];
    const state = await service.downloadModel(IMAGE_GENERATION_MODEL_ID, {
      onProgress: (value) => progress.push(value),
    });

    expect(loadImageGenerationModel).toHaveBeenCalledTimes(1);
    expect(loadImageEditingModel).not.toHaveBeenCalled();
    expect(state).toMatchObject({ id: IMAGE_GENERATION_MODEL_ID, status: 'ready', progress: 100 });
    expect(progress).toEqual([55, 100]);
  });

  it('keeps text model progress monotonic when loaders report per-file progress', async () => {
    const loadImageEditingModel = vi.fn().mockResolvedValue(undefined);
    const loadImageGenerationModel = vi.fn().mockResolvedValue(undefined);
    const loadTextGenerationModel = vi.fn((_, options?: { onProgress?: (progress: number) => void }) => {
      options?.onProgress?.(8);
      options?.onProgress?.(18);
      options?.onProgress?.(10);
      options?.onProgress?.(55);
      return Promise.resolve();
    });
    const textGenerationLoader: TextGenerationModelLoader = {
      loadTextGenerationModel,
    };
    const service = new BrowserModelSetupService(
      { loadImageEditingModel },
      createStorage(),
      { loadImageGenerationModel },
      textGenerationLoader,
    );

    const progress: number[] = [];
    const state = await service.downloadModel(GEMMA_LLM_MODEL_ID, {
      onProgress: (value) => progress.push(value),
    });

    expect(state).toMatchObject({ id: GEMMA_LLM_MODEL_ID, status: 'ready', progress: 100 });
    expect(progress).toEqual([10, 18, 18, 55, 100]);
  });

  it('restores ready state from browser cache metadata', async () => {
    const loadImageEditingModel = vi.fn().mockResolvedValue(undefined);
    const loader: ImageEditingModelLoader = {
      loadImageEditingModel,
    };
    const service = new BrowserModelSetupService(
      loader,
      createStorage({ 'ew-canvas-ai.model.image-editing-models.ready': 'true' }),
    );

    const states = await service.getModelStates();

    expect(states.find((state) => state.id === 'image-editing-models')).toMatchObject({
      status: 'ready',
      progress: 100,
    });
    expect(states.find((state) => state.id === IMAGE_GENERATION_MODEL_ID)).toMatchObject({
      status: 'needs-download',
      progress: 0,
    });
    expect(loadImageEditingModel).not.toHaveBeenCalled();
  });

  it('restores image generation ready state from browser cache metadata', async () => {
    const loadImageEditingModel = vi.fn().mockResolvedValue(undefined);
    const loadImageGenerationModel = vi.fn().mockResolvedValue(undefined);
    const service = new BrowserModelSetupService(
      { loadImageEditingModel },
      createStorage({ 'ew-canvas-ai.model.image-generation-models.runtime-v1.ready': 'true' }),
      { loadImageGenerationModel },
    );

    const states = await service.getModelStates();

    expect(states.find((state) => state.id === IMAGE_GENERATION_MODEL_ID)).toMatchObject({
      id: IMAGE_GENERATION_MODEL_ID,
      status: 'ready',
      progress: 100,
    });
    expect(loadImageGenerationModel).not.toHaveBeenCalled();
  });

  it('removes cached model readiness metadata and marks the model downloadable again', async () => {
    const loadImageEditingModel = vi.fn().mockResolvedValue(undefined);
    const storage = createStorage({ 'localstudio.ai.model.translategemma-webgpu.ready': 'true' });
    const service = new BrowserModelSetupService({ loadImageEditingModel }, storage);

    const state = await service.removeModel(TRANSLATEGEMMA_MODEL_ID);

    expect(state).toMatchObject({
      id: TRANSLATEGEMMA_MODEL_ID,
      status: 'needs-download',
      progress: 0,
    });
    expect(storage.getItem('localstudio.ai.model.translategemma-webgpu.ready')).toBe('false');
  });
});
