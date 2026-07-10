import { afterAll, beforeAll, vi } from 'vitest';
import type { Asset } from '../../../src/domain/documents/model';
import { BrowserBackgroundRemovalService } from '../../../src/services/background-removal/browserBackgroundRemovalService';
import type { BackgroundSegmentationResult } from '../../../src/services/model-setup/transformersRuntimeTypes';

type MutableGlobal = typeof globalThis & { ImageData?: typeof ImageData };

const mockProcessor = Object.assign(
  vi.fn(() => Promise.resolve({
    original_sizes: [],
    reshaped_input_sizes: [[1, 1]],
  })),
  {
    post_process_masks: vi.fn(() => Promise.resolve([[{}]])),
  },
);

const mockModel = Object.assign(
  vi.fn(() => Promise.resolve({
    pred_masks: {},
    iou_scores: { data: [1] },
  })),
  {
    get_image_embeddings: vi.fn(() => Promise.resolve({})),
  },
);

vi.mock('@huggingface/transformers', () => ({
  AutoProcessor: {
    from_pretrained: vi.fn(() => Promise.resolve(mockProcessor)),
  },
  RawImage: {
    fromTensor: vi.fn(() => ({ data: new Uint8Array([1]), width: 1, height: 1 })),
    fromURL: vi.fn(() => Promise.resolve({
      data: new Uint8Array([255, 0, 0, 255]),
      width: 1,
      height: 1,
      channels: 4,
    })),
  },
  SamModel: {
    from_pretrained: vi.fn(() => Promise.resolve(mockModel)),
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

describe('BrowserBackgroundRemovalService', () => {
  let originalToBlobDescriptor: PropertyDescriptor | undefined;
  let originalImageData: typeof ImageData | undefined;

  beforeAll(() => {
    originalToBlobDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'toBlob');
    originalImageData = (globalThis as MutableGlobal).ImageData;
    (globalThis as MutableGlobal).ImageData = class ImageDataMock {
      readonly data: Uint8ClampedArray;

      constructor(
        readonly width: number,
        readonly height: number,
      ) {
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    } as typeof ImageData;
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value(callback: BlobCallback) {
        callback(new Blob(['removed'], { type: 'image/png' }));
      },
    });
  });

  afterAll(() => {
    if (originalToBlobDescriptor) {
      Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', originalToBlobDescriptor);
    } else {
      delete (HTMLCanvasElement.prototype as Partial<HTMLCanvasElement>).toBlob;
    }
    if (originalImageData) {
      (globalThis as MutableGlobal).ImageData = originalImageData;
    } else {
      delete (globalThis as MutableGlobal).ImageData;
    }
  });

  it('does not inherit file storage metadata for generated replacement assets', async () => {
    const runtime = {
      prepareBackgroundRemoval: vi.fn(() => Promise.resolve()),
      segmentBackgroundRemoval: vi.fn(
        (): Promise<BackgroundSegmentationResult> =>
          Promise.resolve({
            imageInput: {
              data: new Uint8Array([255, 0, 0, 255]),
              width: 1,
              height: 1,
              channels: 4,
            },
            subjectMask: {
              data: new Uint8Array([1]),
              width: 1,
              height: 1,
              score: 1,
            },
          }),
      ),
    };
    const service = new BrowserBackgroundRemovalService(runtime);
    const sourceAsset: Asset = {
      id: 'asset-hero',
      type: 'image',
      name: 'Hero',
      mimeType: 'image/png',
      objectUrl: 'blob:source',
      storage: 'file',
      fileName: 'asset-hero.png',
    };

    const result = await service.removeBackground(sourceAsset, {
      subjectPoint: { x: 0.5, y: 0.5 },
    });

    expect(result.asset).toMatchObject({
      type: 'image',
      name: 'Hero BG Removed',
      mimeType: 'image/png',
    });
    expect(result.asset.objectUrl).toMatch(/^blob:/);
    expect(result.asset.id).not.toBe(sourceAsset.id);
    expect(result.asset.storage).toBeUndefined();
    expect(result.asset.fileName).toBeUndefined();
  });
});
