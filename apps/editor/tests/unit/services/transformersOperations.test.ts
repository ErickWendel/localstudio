import { vi } from 'vitest';
import { directTransformersOperations } from '../../../src/services/model-setup/directTransformersOperations';
import type { ModelDownloadProgressDetails } from '../../../src/services/contracts/interfaces';

const mockProcessor = Object.assign(
  vi.fn(() =>
    Promise.resolve({
      original_sizes: [],
      reshaped_input_sizes: [[1, 1]],
    }),
  ),
  {
    post_process_masks: vi.fn(() => Promise.resolve([[{}]])),
  },
);

const mockModel = Object.assign(
  vi.fn(() =>
    Promise.resolve({
      pred_masks: {},
      iou_scores: { data: [1] },
    }),
  ),
  {
    dispose: vi.fn(() => Promise.resolve()),
    get_image_embeddings: vi.fn(() => Promise.resolve({})),
  },
);

const fromPretrainedSamModel = vi.fn(
  (_modelId: string, options?: { progress_callback?: (event: unknown) => void }) => {
    options?.progress_callback?.({
      file: 'onnx/model_fp16.onnx',
      loaded: 120_000_000,
      progress: 64,
      status: 'progress',
      total: 190_000_000,
    });
    return Promise.resolve(mockModel);
  },
);

const fromPretrainedProcessor = vi.fn(
  (_modelId: string, options?: { progress_callback?: (event: unknown) => void }) => {
    options?.progress_callback?.({
      file: 'preprocessor_config.json',
      loaded: 20_000,
      progress: 100,
      status: 'progress',
      total: 20_000,
    });
    return Promise.resolve(mockProcessor);
  },
);

vi.mock('@huggingface/transformers', () => ({
  AutoProcessor: {
    from_pretrained: fromPretrainedProcessor,
  },
  RawImage: {
    fromTensor: vi.fn(() => ({ data: new Uint8Array([1]), width: 1, height: 1 })),
    fromURL: vi.fn(() =>
      Promise.resolve({
        data: new Uint8Array([255, 0, 0, 255]),
        width: 1,
        height: 1,
        channels: 4,
      }),
    ),
  },
  SamModel: {
    from_pretrained: fromPretrainedSamModel,
  },
  Tensor: class Tensor {
    constructor(
      readonly type: string,
      readonly data: Array<number | bigint>,
      readonly dims: number[],
    ) {}
  },
  env: {},
}));

describe('directTransformersOperations.DirectTransformersOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports byte-aware progress while preloading image editing models', async () => {
    const operations = new directTransformersOperations.DirectTransformersOperations();
    const details: Array<ModelDownloadProgressDetails | undefined> = [];

    await operations.preloadImageEditing({
      onProgress: (_progress, nextDetails) => details.push(nextDetails),
    });

    expect(fromPretrainedSamModel.mock.calls[0]?.[0]).toBe('Xenova/slimsam-77-uniform');
    expect(typeof fromPretrainedSamModel.mock.calls[0]?.[1]?.progress_callback).toBe('function');
    expect(fromPretrainedProcessor.mock.calls[0]?.[0]).toBe('Xenova/slimsam-77-uniform');
    expect(typeof fromPretrainedProcessor.mock.calls[0]?.[1]?.progress_callback).toBe('function');
    expect(details.some((item) => item?.loadedBytes === 120_000_000)).toBe(true);
    expect(details.some((item) => item?.totalBytes === 190_000_000)).toBe(true);
  });

  it('disposes the loaded image editing model when removed', async () => {
    const operations = new directTransformersOperations.DirectTransformersOperations();

    await operations.preloadImageEditing();
    await operations.removeImageEditing();

    expect(mockModel.dispose).toHaveBeenCalledTimes(1);
  });
});
