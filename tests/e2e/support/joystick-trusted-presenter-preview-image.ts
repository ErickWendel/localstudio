import type { PresenterRemoteSlidePreview } from '@localstudio/presenter-remote/protocol';

type PresenterRemoteSlidePreviewElement = PresenterRemoteSlidePreview['elements'][number];

export function createTrustedPresenterPreviewImage(
  label: string,
  imageUrl: string,
): PresenterRemoteSlidePreviewElement {
  return {
    assetUrl: imageUrl,
    height: 180,
    id: `${label}-image`,
    kind: 'image',
    opacity: 0.88,
    rotation: 0,
    width: 320,
    x: 96,
    y: 78,
  };
}
