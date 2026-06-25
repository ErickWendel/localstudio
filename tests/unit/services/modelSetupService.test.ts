import { InMemoryModelSetupService } from '../../../src/services/modelSetupService';

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
