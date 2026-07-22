import { describe, expect, it } from 'vitest';
import { canvasMagnetGuides } from '../../../../src/ui/editor/canvas/canvasMagnetGuides';

describe('canvasMagnetGuides', () => {
  it('snaps to the page vertical center without adding a horizontal guide', () => {
    const snap = canvasMagnetGuides.getDragSnap({
      movingRect: { x: 351, y: 40, width: 70, height: 50 },
      stageHeight: 432,
      stageWidth: 768,
      targetRects: [],
      threshold: 6,
    });

    expect(snap.deltaX).toBe(-2);
    expect(snap.deltaY).toBe(0);
    expect(snap.guides).toEqual([
      expect.objectContaining({
        id: 'page-vertical-center',
        orientation: 'vertical',
        source: 'page',
      }),
    ]);
  });

  it('snaps to both page centers independently', () => {
    const snap = canvasMagnetGuides.getDragSnap({
      movingRect: { x: 351, y: 193, width: 70, height: 50 },
      stageHeight: 432,
      stageWidth: 768,
      targetRects: [],
      threshold: 6,
    });

    expect(snap.deltaX).toBe(-2);
    expect(snap.deltaY).toBe(-2);
    expect(snap.guides.map((guide) => guide.orientation)).toEqual(['vertical', 'horizontal']);
  });

  it('snaps to nearby object anchors and returns bounded object guides', () => {
    const snap = canvasMagnetGuides.getDragSnap({
      movingRect: { x: 94, y: 150, width: 50, height: 40 },
      stageHeight: 432,
      stageWidth: 768,
      targetRects: [{ id: 'target', x: 150, y: 170, width: 80, height: 60 }],
      threshold: 6,
    });

    expect(snap.deltaX).toBe(6);
    expect(snap.guides[0]).toEqual(
      expect.objectContaining({
        id: 'object-vertical-target-right-left',
        orientation: 'vertical',
        source: 'object',
        y1: 132,
        y2: 248,
      }),
    );
  });

  it('snaps resized width and height to nearby object dimensions', () => {
    const snap = canvasMagnetGuides.getResizeSnap({
      resizedRect: { x: 20, y: 30, width: 123, height: 77 },
      targetRects: [{ id: 'reference', x: 220, y: 40, width: 128, height: 80 }],
      threshold: 6,
    });

    expect(snap.width).toBe(128);
    expect(snap.height).toBe(80);
    expect(snap.guides.map((guide) => guide.kind)).toEqual(['size', 'size']);
  });
});
