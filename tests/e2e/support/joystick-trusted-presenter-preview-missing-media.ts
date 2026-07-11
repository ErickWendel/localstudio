import type { PresenterRemoteSlidePreview } from '@localstudio/presenter-remote/protocol';

type PresenterRemoteSlidePreviewElement = PresenterRemoteSlidePreview['elements'][number];

export function createTrustedPresenterPreviewMissingMedia(
  label: string,
): PresenterRemoteSlidePreviewElement {
  return {
    height: 120,
    id: `${label}-missing-media`,
    kind: 'media',
    mediaType: 'video',
    opacity: 0.75,
    rotation: 0,
    width: 180,
    x: 720,
    y: 660,
  };
}
