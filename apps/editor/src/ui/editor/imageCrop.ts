import type { CropRect, ImageElement } from '../../domain/model';

export type ImageCropHandle = 'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left';

export interface ImageCropPatch {
  crop: CropRect;
  frame: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
}

const DEFAULT_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };
const MIN_CROP_RATIO = 0.04;
const MIN_FRAME_SIZE = 24;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function normalizeCrop(crop: CropRect): CropRect {
  const x = clamp(crop.x, 0, 1 - MIN_CROP_RATIO);
  const y = clamp(crop.y, 0, 1 - MIN_CROP_RATIO);
  return {
    x: round(x),
    y: round(y),
    width: round(clamp(crop.width, MIN_CROP_RATIO, 1 - x)),
    height: round(clamp(crop.height, MIN_CROP_RATIO, 1 - y)),
  };
}

export function getImageCrop(element: ImageElement): CropRect {
  return normalizeCrop(element.crop ?? DEFAULT_CROP);
}

export function calculateImageCropPatch(
  element: ImageElement,
  handle: ImageCropHandle,
  delta: { x: number; y: number },
): ImageCropPatch {
  const crop = getImageCrop(element);
  const frame = {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };
  const nextCrop = { ...crop };

  function moveLeft(rawDelta: number) {
    const minDelta = (-crop.x * element.width) / crop.width;
    const maxDelta = Math.min(
      element.width - MIN_FRAME_SIZE,
      element.width * (1 - MIN_CROP_RATIO / crop.width),
    );
    const boundedDelta = clamp(rawDelta, minDelta, maxDelta);
    frame.x = element.x + boundedDelta;
    frame.width = element.width - boundedDelta;
    nextCrop.x = crop.x + (boundedDelta / element.width) * crop.width;
    nextCrop.width = crop.width - (boundedDelta / element.width) * crop.width;
  }

  function moveRight(rawDelta: number) {
    const minDelta = -Math.min(
      element.width - MIN_FRAME_SIZE,
      element.width * (1 - MIN_CROP_RATIO / crop.width),
    );
    const maxDelta = ((1 - crop.x - crop.width) * element.width) / crop.width;
    const boundedDelta = clamp(rawDelta, minDelta, maxDelta);
    frame.width = element.width + boundedDelta;
    nextCrop.width = crop.width + (boundedDelta / element.width) * crop.width;
  }

  function moveTop(rawDelta: number) {
    const minDelta = (-crop.y * element.height) / crop.height;
    const maxDelta = Math.min(
      element.height - MIN_FRAME_SIZE,
      element.height * (1 - MIN_CROP_RATIO / crop.height),
    );
    const boundedDelta = clamp(rawDelta, minDelta, maxDelta);
    frame.y = element.y + boundedDelta;
    frame.height = element.height - boundedDelta;
    nextCrop.y = crop.y + (boundedDelta / element.height) * crop.height;
    nextCrop.height = crop.height - (boundedDelta / element.height) * crop.height;
  }

  function moveBottom(rawDelta: number) {
    const minDelta = -Math.min(
      element.height - MIN_FRAME_SIZE,
      element.height * (1 - MIN_CROP_RATIO / crop.height),
    );
    const maxDelta = ((1 - crop.y - crop.height) * element.height) / crop.height;
    const boundedDelta = clamp(rawDelta, minDelta, maxDelta);
    frame.height = element.height + boundedDelta;
    nextCrop.height = crop.height + (boundedDelta / element.height) * crop.height;
  }

  if (handle.includes('left')) moveLeft(delta.x);
  if (handle.includes('right')) moveRight(delta.x);
  if (handle.includes('top')) moveTop(delta.y);
  if (handle.includes('bottom')) moveBottom(delta.y);

  return {
    crop: normalizeCrop(nextCrop),
    frame: {
      x: round(frame.x),
      y: round(frame.y),
      width: round(Math.max(MIN_FRAME_SIZE, frame.width)),
      height: round(Math.max(MIN_FRAME_SIZE, frame.height)),
    },
  };
}
