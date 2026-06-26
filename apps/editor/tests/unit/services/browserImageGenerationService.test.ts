import { BrowserBonsaiImageRuntime, type BonsaiImageRuntime } from '../../../src/services/bonsaiImageRuntime';
import { BrowserImageGenerationService } from '../../../src/services/browserImageGenerationService';
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

describe('BrowserBonsaiImageRuntime', () => {
  it('preloads the Bonsai demo runtime with from_pretrained and maps component progress', async () => {
    const pipeline = {
      generate: vi.fn(() =>
        Promise.resolve({
          toBlob: () => new Blob(['image'], { type: 'image/png' }),
        }),
      ),
    };
    const fromPretrained = vi.fn((_modelId: string, options?: { onProgress?: (progress: unknown) => void }) => {
      options?.onProgress?.({ phase: 'init' });
      options?.onProgress?.({ component: 'text_encoder', loaded: 850_000_000, total: 1_700_000_000 });
      options?.onProgress?.({ component: 'text_encoder', loaded: 1_700_000_000, total: 1_700_000_000 });
      options?.onProgress?.({ component: 'transformer', loaded: 1_300_000_000, total: 1_300_000_000 });
      options?.onProgress?.({ component: 'vae', loaded: 95_000_000, total: 95_000_000 });
      return Promise.resolve(pipeline);
    });
    const progress: number[] = [];

    await new BrowserBonsaiImageRuntime({
      cacheName: 'test-cache',
      importRuntime: () =>
        Promise.resolve({
          BonsaiImagePipeline: {
            from_pretrained: fromPretrained,
          },
        }),
    }).preload('prism-ml/bonsai-image-ternary-4B-mlx-2bit', {
      onProgress: (value) => progress.push(Math.round(value)),
    });

    expect(fromPretrained).toHaveBeenCalledWith(
      'prism-ml/bonsai-image-ternary-4B-mlx-2bit',
      expect.objectContaining({ cacheName: 'test-cache' }),
    );
    expect(progress).toEqual([3, 27, 55, 97, 100]);
  });

  it('removes Bonsai demo DOM side effects after importing the runtime', async () => {
    const appRoot = document.createElement('div');
    appRoot.id = 'root';
    document.body.appendChild(appRoot);
    const pipeline = {
      generate: vi.fn(() => Promise.resolve(new Blob(['image'], { type: 'image/png' }))),
    };
    const fromPretrained = vi.fn(() => Promise.resolve(pipeline));
    const cleanupBonsaiDemo = vi.fn();
    const destroyBonsaiDemoScene = vi.fn();

    await new BrowserBonsaiImageRuntime({
      importRuntime: () => {
        const demoContainer = document.createElement('div');
        demoContainer.id = 'bonsai-demo';
        demoContainer.appendChild(document.createElement('canvas'));
        document.body.appendChild(demoContainer);
        return Promise.resolve({
          BonsaiImagePipeline: {
            from_pretrained: fromPretrained,
          },
          cleanupBonsaiDemo,
          destroyBonsaiDemoScene,
        });
      },
    }).preload('prism-ml/bonsai-image-ternary-4B-mlx-2bit');

    expect(cleanupBonsaiDemo).toHaveBeenCalled();
    expect(destroyBonsaiDemoScene).toHaveBeenCalled();
    expect(document.getElementById('root')).toBe(appRoot);
    expect(document.getElementById('bonsai-demo')).toBeNull();
    appRoot.remove();
  });

  it('keeps model preload progress moving before byte totals are available', async () => {
    vi.useFakeTimers();
    type TestPipeline = {
      generate(options: {
        callback_on_step_end?: (_pipeline: unknown, step: number) => void;
        guidance_scale: 1;
        height: number;
        num_inference_steps: number;
        prompt: string;
        seed?: number;
        width: number;
      }): Promise<Blob>;
    };
    const pipeline: TestPipeline = {
      generate: vi.fn(() => Promise.resolve(new Blob(['image'], { type: 'image/png' }))),
    };
    let resolvePipeline: ((pipeline: TestPipeline) => void) | undefined;
    const fromPretrained = vi.fn((_modelId: string, options?: { onProgress?: (progress: unknown) => void }) => {
      options?.onProgress?.({ phase: 'init' });
      options?.onProgress?.({ component: 'text_encoder', phase: 'open' });
      return new Promise<typeof pipeline>((resolve) => {
        resolvePipeline = resolve;
      });
    });
    const progress: number[] = [];
    const preloadPromise = new BrowserBonsaiImageRuntime({
      importRuntime: () =>
        Promise.resolve({
          BonsaiImagePipeline: {
            from_pretrained: fromPretrained,
          },
        }),
    }).preload('prism-ml/bonsai-image-ternary-4B-mlx-2bit', {
      onProgress: (value) => progress.push(Math.round(value)),
    });

    await vi.advanceTimersByTimeAsync(3_000);
    resolvePipeline?.(pipeline);
    await preloadPromise;
    vi.useRealTimers();

    expect(progress).toEqual([3, 12, 14, 16, 100]);
  });

  it('generates with the Bonsai demo runtime after loading it once', async () => {
    const pipeline = {
      generate: vi.fn(() =>
        Promise.resolve({
          toBlob: () => new Blob(['image'], { type: 'image/png' }),
        }),
      ),
    };
    const fromPretrained = vi.fn(() => Promise.resolve(pipeline));
    const runtime = new BrowserBonsaiImageRuntime({
      importRuntime: () =>
        Promise.resolve({
          BonsaiImagePipeline: {
            from_pretrained: fromPretrained,
          },
        }),
    });

    const blob = await runtime.generate({
      modelId: 'prism-ml/bonsai-image-ternary-4B-mlx-2bit',
      prompt: 'A neon bonsai tree',
      height: 512,
      width: 512,
      steps: 4,
      seed: 123,
    });

    expect(fromPretrained).toHaveBeenCalledTimes(1);
    expect(pipeline.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'A neon bonsai tree',
        height: 512,
        width: 512,
        guidance_scale: 1,
        num_inference_steps: 4,
        seed: 123,
      }),
    );
    expect(blob.type).toBe('image/png');
  });
});
