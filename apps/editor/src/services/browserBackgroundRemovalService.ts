import type { Asset } from '../domain/model';
import type { BackgroundRemovalService } from './interfaces';
import { TransformersRuntimeClient } from './transformersRuntimeClient';
import type {
  BackgroundSegmentationResult,
  SamImageInput,
  SegmentationPoint,
  SubjectMask,
} from './model-setup/transformersOperations';

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

interface CroppedTransparentImageResult {
  objectUrl: string;
  bounds: { x: number; y: number; width: number; height: number };
}

interface BackgroundRemovalRuntime {
  prepareBackgroundRemoval(objectUrl: string, options?: { onProgress?: (progress: number) => void }): Promise<void>;
  segmentBackgroundRemoval(objectUrl: string, points: SegmentationPoint[]): Promise<BackgroundSegmentationResult>;
}

const SUBJECT_PADDING_RATIO = 0.035;

export class BrowserBackgroundRemovalService implements BackgroundRemovalService {
  constructor(private readonly runtime: BackgroundRemovalRuntime = new TransformersRuntimeClient()) {}

  async prepareBackgroundRemoval(
    asset: Asset,
    options?: { onProgress?: (progress: number) => void },
  ): Promise<void> {
    if (!asset.objectUrl) throw new Error('Selected image has no source URL.');
    await this.runtime.prepareBackgroundRemoval(asset.objectUrl, options);
    options?.onProgress?.(100);
  }

  async previewBackgroundMask(
    asset: Asset,
    options?: { points?: SegmentationPoint[]; subjectPoint?: { x: number; y: number } },
  ): Promise<{ maskUrl: string; score: number }> {
    if (!asset.objectUrl) throw new Error('Selected image has no source URL.');
    const points = this.getSegmentationPoints(options);
    if (points.length === 0) throw new Error('At least one point is required for previewing background removal.');

    const segmentation = await this.runtime.segmentBackgroundRemoval(asset.objectUrl, points);
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

    const segmentation = await this.runtime.segmentBackgroundRemoval(asset.objectUrl, points);
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
