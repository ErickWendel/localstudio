import type { PresenterRemoteSlidePreview } from '@localstudio/presenter-remote/protocol';

type PresenterRemoteSlidePreviewElement = PresenterRemoteSlidePreview['elements'][number];

export function createTrustedPresenterPreviewVideo(
  label: string,
  imageUrl: string,
): PresenterRemoteSlidePreviewElement {
  return {
    assetUrl: imageUrl,
    autoplay: false,
    height: 150,
    id: `${label}-video`,
    kind: 'media',
    loop: false,
    mediaType: 'video',
    muted: true,
    opacity: 1,
    rotation: 0,
    width: 260,
    x: 980,
    y: 640,
  };
}
