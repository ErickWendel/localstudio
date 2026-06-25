import { vi } from 'vitest';
import {
  BrowserModelSetupService,
  InMemoryModelSetupService,
  type ImageEditingModelLoader,
} from '../../../src/services/modelSetupService';

describe('InMemoryModelSetupService', () => {
  it('downloads required models in parallel and exposes progress', async () => {
    const service = new InMemoryModelSetupService();
    await service.downloadRequiredModels();

    const states = await service.getModelStates();
    expect(states.every((state) => state.status === 'ready')).toBe(true);
    expect(states).toHaveLength(1);
    expect(states[0]).toMatchObject({
      id: 'image-editing-models',
      label: 'Image Editing Models',
      description: 'Segmentation model for image editing.',
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
    ]);
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
    expect(loadImageEditingModel).not.toHaveBeenCalled();
  });
});
