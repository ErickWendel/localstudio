import {
  BrowserBonsaiImageRuntime,
  WorkerBackedBonsaiImageRuntime,
  type BonsaiImageRuntime,
  type BonsaiImageWorkerRequest,
  type BonsaiImageWorkerResponse,
} from '../../../src/services/bonsaiImageRuntime';
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
  it('preloads the Bonsai runtime with from_pretrained and maps component progress', async () => {
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

  it('imports the vendored runtime-only module without DOM side effects or cleanup hooks', async () => {
    const appRoot = document.createElement('div');
    appRoot.id = 'root';
    document.body.appendChild(appRoot);
    const pipeline = {
      generate: vi.fn(() => Promise.resolve(new Blob(['image'], { type: 'image/png' }))),
    };
    const fromPretrained = vi.fn(() => Promise.resolve(pipeline));
    const runtimeModule = await import('../../../src/vendor/bonsai-image-webgpu-runtime.js');

    expect('cleanupBonsaiDemo' in runtimeModule).toBe(false);
    expect('destroyBonsaiDemoScene' in runtimeModule).toBe(false);
    expect(document.body.children).toHaveLength(1);

    await new BrowserBonsaiImageRuntime({
      importRuntime: () =>
        Promise.resolve({
          BonsaiImagePipeline: {
            from_pretrained: fromPretrained,
          },
        }),
    }).preload('prism-ml/bonsai-image-ternary-4B-mlx-2bit');

    expect(document.getElementById('root')).toBe(appRoot);
    expect(document.body.children).toHaveLength(1);
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

  it('generates with the Bonsai runtime after loading it once', async () => {
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

describe('WorkerBackedBonsaiImageRuntime', () => {
  class FakeWorker {
    onmessage: ((event: MessageEvent<BonsaiImageWorkerResponse>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    messages: BonsaiImageWorkerRequest[] = [];
    postMessage = vi.fn((message: BonsaiImageWorkerRequest) => {
      this.messages.push(message);
    });
    terminate = vi.fn();

    emit(response: BonsaiImageWorkerResponse) {
      this.onmessage?.({ data: response } as MessageEvent<BonsaiImageWorkerResponse>);
    }
  }

  function lastWorkerMessage(worker: FakeWorker) {
    const message = worker.messages.at(-1);
    if (!message) throw new Error('Expected the worker to receive a message.');
    return message;
  }

  it('preloads through the worker protocol and forwards progress', async () => {
    const worker = new FakeWorker();
    const runtime = new WorkerBackedBonsaiImageRuntime({
      createWorker: () => worker as unknown as Worker,
    });
    const progress: number[] = [];

    const preloadPromise = runtime.preload('model-id', {
      onProgress: (value) => progress.push(value),
    });
    const preloadMessage = lastWorkerMessage(worker);
    expect(preloadMessage).toEqual({
      id: preloadMessage.id,
      type: 'preload',
      modelId: 'model-id',
    });
    expect(preloadMessage.id).toEqual(expect.any(String));
    const requestId = preloadMessage.id;
    worker.emit({ id: requestId, type: 'progress', progress: 42 });
    worker.emit({ id: requestId, type: 'result' });

    await expect(preloadPromise).resolves.toBeUndefined();
    expect(progress).toEqual([42]);
  });

  it('generates through the worker protocol and forwards step callbacks', async () => {
    const worker = new FakeWorker();
    const runtime = new WorkerBackedBonsaiImageRuntime({
      createWorker: () => worker as unknown as Worker,
    });
    const onStep = vi.fn();

    const generatePromise = runtime.generate({
      modelId: 'model-id',
      prompt: 'A neon bonsai',
      height: 512,
      width: 512,
      steps: 4,
      seed: 123,
      onStep,
    });
    const generateMessage = lastWorkerMessage(worker);
    expect(generateMessage).toEqual({
      id: generateMessage.id,
      type: 'generate',
      options: {
        modelId: 'model-id',
        prompt: 'A neon bonsai',
        height: 512,
        width: 512,
        steps: 4,
        seed: 123,
      },
    });
    expect(generateMessage.id).toEqual(expect.any(String));
    const requestId = generateMessage.id;
    const blob = new Blob(['image'], { type: 'image/png' });
    worker.emit({ id: requestId, type: 'step', step: 2, totalSteps: 4 });
    worker.emit({ id: requestId, type: 'result', blob });

    await expect(generatePromise).resolves.toBe(blob);
    expect(onStep).toHaveBeenCalledWith(2, 4);
  });

  it('rejects when the worker reports an error', async () => {
    const worker = new FakeWorker();
    const runtime = new WorkerBackedBonsaiImageRuntime({
      createWorker: () => worker as unknown as Worker,
    });

    const preloadPromise = runtime.preload('model-id');
    const requestId = lastWorkerMessage(worker).id;
    worker.emit({ id: requestId, type: 'error', message: 'worker failed' });

    await expect(preloadPromise).rejects.toThrow('worker failed');
  });

  it('does not fall back to the direct runtime after a worker runtime error', async () => {
    const worker = new FakeWorker();
    const fallbackBlob = new Blob(['image'], { type: 'image/png' });
    const fallbackRuntime = {
      preload: vi.fn(() => Promise.resolve()),
      generate: vi.fn(() => Promise.resolve(fallbackBlob)),
    } satisfies BonsaiImageRuntime;
    const runtime = new WorkerBackedBonsaiImageRuntime({
      createWorker: () => worker as unknown as Worker,
      fallbackRuntime,
    });
    const onStep = vi.fn();

    const generatePromise = runtime.generate({
      modelId: 'model-id',
      prompt: 'A neon bonsai',
      height: 512,
      width: 512,
      steps: 4,
      onStep,
    });
    const requestId = lastWorkerMessage(worker).id;
    worker.emit({ id: requestId, type: 'error', message: 'document is not defined' });

    await expect(generatePromise).rejects.toThrow('document is not defined');
    expect(fallbackRuntime.generate).not.toHaveBeenCalled();
  });

  it('falls back to the direct runtime when worker creation fails', async () => {
    const fallbackRuntime = {
      preload: vi.fn(() => Promise.resolve()),
      generate: vi.fn(() => Promise.resolve(new Blob(['image'], { type: 'image/png' }))),
    } satisfies BonsaiImageRuntime;
    const runtime = new WorkerBackedBonsaiImageRuntime({
      createWorker: () => {
        throw new Error('workers unavailable');
      },
      fallbackRuntime,
    });

    await runtime.preload('model-id');

    expect(fallbackRuntime.preload).toHaveBeenCalledWith('model-id', undefined);
  });
});
