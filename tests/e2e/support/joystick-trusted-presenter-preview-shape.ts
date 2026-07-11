import type { PresenterRemoteSlidePreview } from '@localstudio/presenter-remote/protocol';

type PresenterRemoteSlidePreviewElement = PresenterRemoteSlidePreview['elements'][number];

export function createTrustedPresenterPreviewShape(
  label: string,
): PresenterRemoteSlidePreviewElement {
  return {
    fill: '#F2C94C',
    height: 120,
    id: `${label}-shape`,
    kind: 'shape',
    opacity: 0.9,
    rotation: 6,
    shape: 'rounded-rect',
    stroke: '#111827',
    strokeWidth: 4,
    width: 220,
    x: 1380,
    y: 120,
  };
}
