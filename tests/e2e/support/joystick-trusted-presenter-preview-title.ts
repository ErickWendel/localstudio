import type { PresenterRemoteSlidePreview } from '@localstudio/presenter-remote/protocol';

type PresenterRemoteSlidePreviewElement = PresenterRemoteSlidePreview['elements'][number];

export function createTrustedPresenterPreviewTitle(
  label: string,
): PresenterRemoteSlidePreviewElement {
  return {
    fill: '#FFFFFF',
    fontFamily: 'Inter',
    fontSize: 84,
    fontWeight: 700,
    height: 140,
    id: `${label}-title`,
    kind: 'text',
    lineHeight: 1.05,
    opacity: 1,
    rotation: 0,
    text: label,
    verticalAlign: 'middle',
    width: 900,
    x: 180,
    y: 110,
    align: 'center',
  };
}
