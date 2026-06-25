import { BrowserImageGenerationService, type BonsaiImageRuntime } from '../../../src/services/browserImageGenerationService';
import {
  DEFAULT_IMAGE_GENERATION_SIZE,
  DEFAULT_IMAGE_GENERATION_STEPS,
  IMAGE_GENERATION_TRANSFORMERS_MODEL_ID,
} from '../../../src/services/imageGenerationModels';

describe('BrowserImageGenerationService', () => {
  class TestRuntime implements BonsaiImageRuntime {
    preload = vi.fn(() => Promise.resolve());
    generate = vi.fn((options: Parameters<BonsaiImageRuntime['generate']>[0]) => {
      options.onStep?.(2, 4);
      options.onStep?.(4, 4);
      return Promise.resolve(new Blob(['image'], { type: 'image/png' }));
    });
  }

  it('generates a PNG image asset from a prompt', async () => {
    const runtime = new TestRuntime();
    const progress: Array<{ label: string; progress: number }> = [];
    const service = new BrowserImageGenerationService({
      runtime,
      createId: (prefix) => `${prefix}-1`,
      createObjectUrl: () => 'blob:generated-image',
    });

    const asset = await service.generateImage('An icy Bonsai tree', {
      onProgress: (state) => progress.push(state),
    });

    expect(runtime.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: IMAGE_GENERATION_TRANSFORMERS_MODEL_ID,
        prompt: 'An icy Bonsai tree',
        height: DEFAULT_IMAGE_GENERATION_SIZE,
        width: DEFAULT_IMAGE_GENERATION_SIZE,
        steps: DEFAULT_IMAGE_GENERATION_STEPS,
      }),
    );
    expect(progress).toEqual([
      { label: 'Generating image 2/4', progress: 50 },
      { label: 'Generating image 4/4', progress: 100 },
    ]);
    expect(asset).toEqual({
      id: 'asset-generated-image-1',
      type: 'image',
      name: 'An icy Bonsai tree.png',
      mimeType: 'image/png',
      objectUrl: 'blob:generated-image',
    });
  });

  it('rejects empty prompts without calling the runtime', async () => {
    const runtime = new TestRuntime();
    const service = new BrowserImageGenerationService({ runtime });

    await expect(service.generateImage('   ')).rejects.toThrow('Enter a prompt before generating an image.');

    expect(runtime.generate).not.toHaveBeenCalled();
  });
});
