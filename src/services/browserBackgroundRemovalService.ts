import type { Asset } from '../domain/model';
import type { BackgroundRemovalService } from './interfaces';
import { TRANSFORMERS_CACHE_KEY } from './imageGenerationModels';
import { IMAGE_EDITING_TRANSFORMERS_MODEL_ID } from './modelSetupService';

interface SamImageInput {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  channels: number;
}

interface SamMask {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

interface SamProcessedImage {
  original_sizes: unknown;
  reshaped_input_sizes: Array<[number, number]>;
}

interface SamRuntimeModel {
  get_image_embeddings(image: SamProcessedImage): Promise<Record<string, unknown>>;
  (inputs: Record<string, unknown>): Promise<{
    pred_masks: unknown;
    iou_scores: { data: ArrayLike<number> };
  }>;
}

interface SamRuntimeProcessor {
  (image: SamImageInput): Promise<SamProcessedImage>;
  post_process_masks(
    predMasks: unknown,
    originalSizes: SamProcessedImage['original_sizes'],
    reshapedInputSizes: SamProcessedImage['reshaped_input_sizes'],
  ): Promise<Array<Array<unknown>>>;
}

interface SamRawImageReader {
  fromURL(url: string): Promise<SamImageInput>;
  fromTensor(tensor: unknown): SamMask;
}

interface SamTensorConstructor {
  new (type: 'float32' | 'int64', data: Array<number | bigint>, dims: number[]): unknown;
}

function createObjectUrlFromImageData(imageData: ImageData) {
  return new Promise<string>((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const context = canvas.getContext('2d');
    if (!context) {
      reject(new Error('Canvas 2D context is unavailable.'));
      return;
    }

    context.putImageData(imageData, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Background removed image could not be encoded.'));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, 'image/png');
  });
}

function createDataUrlFromImageData(imageData: ImageData) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable.');
  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

interface EncodedAsset {
  imageInput: SamImageInput;
  imageProcessed: SamProcessedImage;
  imageEmbeddings: Record<string, unknown>;
}

interface SegmentationResult extends EncodedAsset {
  mask: SamMask;
  scores: number[];
}

interface SubjectMask {
  data: Uint8Array;
  width: number;
  height: number;
  score: number;
}

interface CroppedTransparentImageResult {
  objectUrl: string;
  bounds: { x: number; y: number; width: number; height: number };
}

interface SegmentationPoint {
  x: number;
  y: number;
  positive: boolean;
}

const SUBJECT_PADDING_RATIO = 0.035;

export class BrowserBackgroundRemovalService implements BackgroundRemovalService {
  private modelPromise: Promise<{
    model: SamRuntimeModel;
    processor: SamRuntimeProcessor;
    RawImage: SamRawImageReader;
    Tensor: SamTensorConstructor;
  }> | null = null;
  private encodedAssets = new Map<string, Promise<EncodedAsset>>();

  async prepareBackgroundRemoval(
    asset: Asset,
    options?: { onProgress?: (progress: number) => void },
  ): Promise<void> {
    await this.encodeAsset(asset, options?.onProgress);
    options?.onProgress?.(100);
  }

  async previewBackgroundMask(
    asset: Asset,
    options?: { points?: SegmentationPoint[]; subjectPoint?: { x: number; y: number } },
  ): Promise<{ maskUrl: string; score: number }> {
    if (!asset.objectUrl) throw new Error('Selected image has no source URL.');
    const points = this.getSegmentationPoints(options);
    if (points.length === 0) throw new Error('At least one point is required for previewing background removal.');

    const segmentation = await this.segmentSeparateSubjects(asset, points);
    return {
      maskUrl: this.createBlueMaskImage(segmentation.subjectMask),
      score: segmentation.subjectMask.score,
    };
  }

  async removeBackground(
    asset: Asset,
    options?: { points?: SegmentationPoint[]; subjectPoint?: { x: number; y: number } },
  ): Promise<{ asset: Asset; bounds: { x: number; y: number; width: number; height: number } }> {
    if (!asset.objectUrl) throw new Error('Selected image has no source URL.');
    const points = this.getSegmentationPoints(options);
    if (points.length === 0) throw new Error('At least one point is required for background removal.');

    const segmentation = await this.segmentSeparateSubjects(asset, points);
    const transparentImage = await this.createTransparentImage(
      segmentation.imageInput,
      segmentation.subjectMask,
    );

    return {
      asset: {
        id: `${asset.id}-bg-removed-${Date.now().toString(36)}`,
        type: 'image',
        name: `${asset.name} BG Removed`,
        mimeType: 'image/png',
        objectUrl: transparentImage.objectUrl,
      },
      bounds: transparentImage.bounds,
    };
  }

  private async segmentSeparateSubjects(
    asset: Asset,
    points: SegmentationPoint[],
  ): Promise<EncodedAsset & { subjectMask: SubjectMask }> {
    const positivePoints = points.filter((point) => point.positive);
    const promptPoints = positivePoints.length > 0 ? positivePoints : points;
    const segmentations = await Promise.all(promptPoints.map((point) => this.segment(asset, [point])));
    if (segmentations.length === 0) throw new Error('At least one point is required for segmentation.');
    const firstSegmentation = segmentations[0];
    if (!firstSegmentation) throw new Error('At least one point is required for segmentation.');
    const subjectData = new Uint8Array(firstSegmentation.mask.width * firstSegmentation.mask.height);
    let scoreTotal = 0;

    for (const segmentation of segmentations) {
      const bestMaskIndex = this.getBestMaskIndex(segmentation.scores);
      const maskCount = segmentation.scores.length;
      scoreTotal += segmentation.scores[bestMaskIndex] ?? 0;

      for (let pixelIndex = 0; pixelIndex < subjectData.length; pixelIndex += 1) {
        if (segmentation.mask.data[maskCount * pixelIndex + bestMaskIndex] === 1) {
          subjectData[pixelIndex] = 1;
        }
      }
    }

    return {
      ...firstSegmentation,
      subjectMask: {
        data: subjectData,
        width: firstSegmentation.mask.width,
        height: firstSegmentation.mask.height,
        score: scoreTotal / segmentations.length,
      },
    };
  }

  private async segment(asset: Asset, points: SegmentationPoint[]): Promise<SegmentationResult> {
    const { model, processor, RawImage, Tensor } = await this.loadModel();
    const encodedAsset = await this.encodeAsset(asset);
    const reshaped = encodedAsset.imageProcessed.reshaped_input_sizes[0]!;
    const inputPoints = new Tensor(
      'float32',
      points.flatMap((point) => [point.x * reshaped[1], point.y * reshaped[0]]),
      [1, 1, points.length, 2],
    );
    const inputLabels = new Tensor(
      'int64',
      points.map((point) => (point.positive ? 1n : 0n)),
      [1, 1, points.length],
    );
    const { pred_masks: predMasks, iou_scores: iouScores } = await model({
      ...encodedAsset.imageEmbeddings,
      input_points: inputPoints,
      input_labels: inputLabels,
    });
    const masks = await processor.post_process_masks(
      predMasks,
      encodedAsset.imageProcessed.original_sizes,
      encodedAsset.imageProcessed.reshaped_input_sizes,
    );
    const mask = RawImage.fromTensor(masks[0]?.[0]);
    return {
      ...encodedAsset,
      mask,
      scores: Array.from(iouScores.data),
    };
  }

  private async encodeAsset(asset: Asset, onProgress?: (progress: number) => void) {
    if (!asset.objectUrl) throw new Error('Selected image has no source URL.');
    const cached = this.encodedAssets.get(asset.objectUrl);
    if (cached) {
      void cached.then(
        () => {
          onProgress?.(100);
        },
        () => undefined,
      );
      return cached;
    }

    const encoded = this.createEncodedAsset(asset.objectUrl, onProgress);
    this.encodedAssets.set(asset.objectUrl, encoded);
    return encoded;
  }

  private async createEncodedAsset(
    objectUrl: string,
    onProgress?: (progress: number) => void,
  ): Promise<EncodedAsset> {
    onProgress?.(8);
    const { model, processor, RawImage } = await this.loadModel();
    onProgress?.(28);
    const imageInput = await RawImage.fromURL(objectUrl);
    onProgress?.(45);
    const imageProcessed = await processor(imageInput);
    onProgress?.(68);
    const imageEmbeddings = await model.get_image_embeddings(imageProcessed);
    onProgress?.(100);
    return { imageInput, imageProcessed, imageEmbeddings };
  }

  private async loadModel() {
    this.modelPromise ??= this.createModel();
    return this.modelPromise;
  }

  private async createModel() {
    const { AutoProcessor, RawImage, SamModel, Tensor, env } = await import('@huggingface/transformers');

    env.useBrowserCache = true;
    env.cacheKey = TRANSFORMERS_CACHE_KEY;

    const [model, processor] = await Promise.all([
      SamModel.from_pretrained(IMAGE_EDITING_TRANSFORMERS_MODEL_ID, {
        dtype: 'fp16',
        device: 'webgpu',
      }),
      AutoProcessor.from_pretrained(IMAGE_EDITING_TRANSFORMERS_MODEL_ID),
    ]);

    return {
      model: model as unknown as SamRuntimeModel,
      processor: processor as unknown as SamRuntimeProcessor,
      RawImage: RawImage as unknown as SamRawImageReader,
      Tensor: Tensor as unknown as SamTensorConstructor,
    };
  }

  private async createTransparentImage(
    imageInput: SamImageInput,
    subjectMask: SubjectMask,
  ): Promise<CroppedTransparentImageResult> {
    const alphaBounds = this.getMaskBounds(subjectMask);
    if (!alphaBounds) {
      const emptyImageData = new ImageData(1, 1);
      return {
        objectUrl: await createObjectUrlFromImageData(emptyImageData),
        bounds: { x: 0, y: 0, width: 1 / imageInput.width, height: 1 / imageInput.height },
      };
    }

    const padding = Math.max(2, Math.round(Math.max(alphaBounds.width, alphaBounds.height) * SUBJECT_PADDING_RATIO));
    const cropX = Math.max(0, alphaBounds.x - padding);
    const cropY = Math.max(0, alphaBounds.y - padding);
    const cropMaxX = Math.min(imageInput.width, alphaBounds.x + alphaBounds.width + padding);
    const cropMaxY = Math.min(imageInput.height, alphaBounds.y + alphaBounds.height + padding);
    const cropWidth = Math.max(1, cropMaxX - cropX);
    const cropHeight = Math.max(1, cropMaxY - cropY);
    const imageData = new ImageData(cropWidth, cropHeight);

    for (let y = 0; y < cropHeight; y += 1) {
      for (let x = 0; x < cropWidth; x += 1) {
        const sourceX = cropX + x;
        const sourceY = cropY + y;
        const sourcePixelIndex = sourceY * imageInput.width + sourceX;
        const sourceOffset = sourcePixelIndex * imageInput.channels;
        const targetOffset = (y * cropWidth + x) * 4;
        const isSubject = subjectMask.data[sourcePixelIndex] === 1;

        imageData.data[targetOffset] = imageInput.data[sourceOffset] ?? 0;
        imageData.data[targetOffset + 1] =
          imageInput.data[sourceOffset + Math.min(1, imageInput.channels - 1)] ?? 0;
        imageData.data[targetOffset + 2] =
          imageInput.data[sourceOffset + Math.min(2, imageInput.channels - 1)] ?? 0;
        imageData.data[targetOffset + 3] = isSubject ? 255 : 0;
      }
    }

    return {
      objectUrl: await createObjectUrlFromImageData(imageData),
      bounds: {
        x: cropX / imageInput.width,
        y: cropY / imageInput.height,
        width: cropWidth / imageInput.width,
        height: cropHeight / imageInput.height,
      },
    };
  }

  private createBlueMaskImage(subjectMask: SubjectMask) {
    const imageData = new ImageData(subjectMask.width, subjectMask.height);

    for (let pixelIndex = 0; pixelIndex < subjectMask.width * subjectMask.height; pixelIndex += 1) {
      const targetOffset = pixelIndex * 4;
      if (subjectMask.data[pixelIndex] !== 1) continue;

      imageData.data[targetOffset] = 0;
      imageData.data[targetOffset + 1] = 114;
      imageData.data[targetOffset + 2] = 189;
      imageData.data[targetOffset + 3] = 178;
    }

    return createDataUrlFromImageData(imageData);
  }

  private getBestMaskIndex(scores: number[]) {
    return scores.reduce((bestIndex, score, index) => (score > scores[bestIndex]! ? index : bestIndex), 0);
  }

  private getSegmentationPoints(options?: { points?: SegmentationPoint[]; subjectPoint?: { x: number; y: number } }) {
    if (options?.points?.length) return options.points;
    if (options?.subjectPoint) return [{ ...options.subjectPoint, positive: true }];
    return [];
  }

  private getMaskBounds(subjectMask: SubjectMask) {
    let minX = subjectMask.width;
    let minY = subjectMask.height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < subjectMask.height; y += 1) {
      for (let x = 0; x < subjectMask.width; x += 1) {
        const pixelIndex = y * subjectMask.width + x;
        if (subjectMask.data[pixelIndex] !== 1) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (maxX < minX || maxY < minY) return undefined;
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }
}
