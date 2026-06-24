import { InMemoryModelSetupService } from './modelSetupService';

describe('InMemoryModelSetupService', () => {
  it('downloads required models in parallel and exposes progress', async () => {
    const service = new InMemoryModelSetupService();
    await service.downloadRequiredModels();

    const states = await service.getModelStates();
    expect(states.every((state) => state.status === 'ready')).toBe(true);
    expect(states.map((state) => state.id)).toEqual([
      'background-remover',
      'smart-crop',
      'magic-eraser',
    ]);
  });
});
