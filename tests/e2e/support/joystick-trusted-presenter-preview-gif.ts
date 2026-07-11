import type { PresenterRemoteSlidePreview } from '@localstudio/presenter-remote/protocol';

type PresenterRemoteSlidePreviewElement = PresenterRemoteSlidePreview['elements'][number];

export function createTrustedPresenterPreviewGif(
  label: string,
  imageUrl: string,
): PresenterRemoteSlidePreviewElement {
  return {
    assetUrl: imageUrl,
    height: 150,
    id: `${label}-gif`,
    kind: 'media',
    mediaType: 'gif',
    opacity: 1,
    rotation: 0,
    width: 220,
    x: 1320,
    y: 650,
  };
}
