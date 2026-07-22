import { placeholderImage } from '../../../domain/assets/placeholderImage';
import type {
  GifElement,
  ImageElement,
  ProjectDocument,
  VideoElement,
} from '../../../domain/documents/model';

type MediaPlaceholderFrame = Pick<
  ImageElement,
  'height' | 'locked' | 'opacity' | 'rotation' | 'visible' | 'width' | 'x' | 'y'
>;

function getSelectedImagePlaceholder(input: {
  project: ProjectDocument;
  selectedElementIds: string[];
}) {
  if (input.selectedElementIds.length !== 1) return undefined;
  const element = input.project.elements[input.selectedElementIds[0] ?? ''];
  if (element?.type !== 'image') return undefined;
  return element.assetId === placeholderImage.PLACEHOLDER_IMAGE_ASSET_ID ? element : undefined;
}

function fitMediaInsidePlaceholder(input: {
  mediaHeight: number;
  mediaWidth: number;
  placeholder: MediaPlaceholderFrame;
}) {
  if (
    input.mediaWidth <= 0 ||
    input.mediaHeight <= 0 ||
    input.placeholder.width <= 0 ||
    input.placeholder.height <= 0
  ) {
    return {
      height: input.placeholder.height,
      width: input.placeholder.width,
      x: input.placeholder.x,
      y: input.placeholder.y,
    };
  }

  const scale = Math.min(
    input.placeholder.width / input.mediaWidth,
    input.placeholder.height / input.mediaHeight,
  );
  const width = Math.max(1, Math.round(input.mediaWidth * scale));
  const height = Math.max(1, Math.round(input.mediaHeight * scale));
  return {
    height,
    width,
    x: Math.round(input.placeholder.x + (input.placeholder.width - width) / 2),
    y: Math.round(input.placeholder.y + (input.placeholder.height - height) / 2),
  };
}

function createImageElement(input: {
  assetId: string;
  mediaHeight: number;
  mediaWidth: number;
  placeholder: ImageElement;
}) {
  const frame = fitMediaInsidePlaceholder(input);
  return {
    id: input.placeholder.id,
    type: 'image',
    assetId: input.assetId,
    ...frame,
    rotation: input.placeholder.rotation,
    locked: input.placeholder.locked,
    visible: input.placeholder.visible,
    opacity: input.placeholder.opacity,
  } satisfies ImageElement;
}

function createGifElement(input: {
  assetId: string;
  mediaHeight: number;
  mediaWidth: number;
  placeholder: ImageElement;
}) {
  const frame = fitMediaInsidePlaceholder(input);
  return {
    id: input.placeholder.id,
    type: 'gif',
    assetId: input.assetId,
    ...frame,
    rotation: input.placeholder.rotation,
    locked: input.placeholder.locked,
    visible: input.placeholder.visible,
    opacity: input.placeholder.opacity,
    playing: true,
  } satisfies GifElement;
}

function createVideoElement(input: {
  assetId: string;
  durationSeconds?: number | undefined;
  mediaHeight: number;
  mediaWidth: number;
  placeholder: ImageElement;
}) {
  const frame = fitMediaInsidePlaceholder(input);
  return {
    id: input.placeholder.id,
    type: 'video',
    assetId: input.assetId,
    ...frame,
    rotation: input.placeholder.rotation,
    locked: input.placeholder.locked,
    visible: input.placeholder.visible,
    opacity: input.placeholder.opacity,
    loop: true,
    controls: true,
    muted: true,
    autoplayInPreview: true,
    playing: true,
    trimStartSeconds: 0,
    repeatMode: 'loop',
    ...(input.durationSeconds !== undefined
      ? {
          durationSeconds: input.durationSeconds,
          trimEndSeconds: input.durationSeconds,
        }
      : {}),
  } satisfies VideoElement;
}

export const mediaPlaceholderReplacement = {
  createGifElement,
  createImageElement,
  createVideoElement,
  getSelectedImagePlaceholder,
};
