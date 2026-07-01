import { describe, expect, it } from 'vitest';
import type { ImageElement } from '../../../../src/domain/documents/model';
import { imageCrop } from '../../../../src/ui/editor/canvas/imageCrop';

const imageElement: ImageElement = {
  id: 'image-1',
  type: 'image',
  assetId: 'asset-1',
  x: 100,
  y: 80,
  width: 400,
  height: 300,
  rotation: 0,
  locked: false,
  visible: true,
  opacity: 1,
};

describe('image crop helpers', () => {
  it('crops the left edge by updating frame and normalized crop rect', () => {
    const patch = imageCrop.calculateImageCropPatch(imageElement, 'left', { x: 100, y: 0 });

    expect(patch.frame).toMatchObject({ x: 200, y: 80, width: 300, height: 300 });
    expect(patch.crop).toMatchObject({ x: 0.25, y: 0, width: 0.75, height: 1 });
  });

  it('expands an already cropped edge without passing the original image bounds', () => {
    const patch = imageCrop.calculateImageCropPatch(
      {
        ...imageElement,
        x: 200,
        width: 300,
        crop: { x: 0.25, y: 0, width: 0.75, height: 1 },
      },
      'left',
      { x: -400, y: 0 },
    );

    expect(patch.frame.x).toBe(100);
    expect(patch.frame.width).toBe(400);
    expect(patch.crop).toMatchObject({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('keeps a minimum crop area and frame size', () => {
    const patch = imageCrop.calculateImageCropPatch(imageElement, 'right', { x: -1000, y: 0 });

    expect(patch.frame.width).toBeGreaterThanOrEqual(24);
    expect(patch.crop.width).toBeGreaterThanOrEqual(0.04);
  });
});
