import { vi } from 'vitest';
import {
  BrowserModelSetupService,
  InMemoryModelSetupService,
  type ImageEditingModelLoader,
  type ImageGenerationModelLoader,
} from '../../../src/services/modelSetupService';
import { IMAGE_GENERATION_MODEL_ID } from '../../../src/services/imageGenerationModels';

describe('InMemoryModelSetupService', () => {
  it('downloads required models in parallel and exposes progress', async () => {
    const service = new InMemoryModelSetupService();
    await service.downloadRequiredModels();

    const states = await service.getModelStates();
    expect(states.filter((state) => state.required).every((state) => state.status === 'ready')).toBe(true);
    expect(states).toHaveLength(2);
    expect(states[0]).toMatchObject({
      id: 'image-editing-models',
      label: 'Image Editing Models',
      description: 'Segmentation model for image editing.',
    });
    expect(states[1]).toMatchObject({
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
    await expect(service.getModelStates()).resolves.toEqual([
      expect.objectContaining({ id: 'image-editing-models', status: 'ready', progress: 100 }),
      expect.objectContaining({ id: IMAGE_GENERATION_MODEL_ID, status: 'needs-download', progress: 0 }),
    ]);
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

    expect(states[0]).toMatchObject({ status: 'ready', progress: 100 });
    expect(states[1]).toMatchObject({ status: 'needs-download', progress: 0 });
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

    expect(states[1]).toMatchObject({ id: IMAGE_GENERATION_MODEL_ID, status: 'ready', progress: 100 });
    expect(loadImageGenerationModel).not.toHaveBeenCalled();
  });
});
