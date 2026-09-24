import { describe, expect, it } from 'vitest';
import { textSelectionFrame } from '../../../../src/ui/editor/canvas/textSelectionFrame';

describe('textSelectionFrame', () => {
  it('keeps the selection border outside text and resize handles', () => {
    expect(textSelectionFrame.paddingForOverflow(0)).toBe(textSelectionFrame.anchorClearance);
    expect(textSelectionFrame.paddingForOverflow(6)).toBe(16);
    expect(textSelectionFrame.paddingForOverflow(Number.NaN)).toBe(textSelectionFrame.anchorClearance);
    expect(textSelectionFrame.paddingForOverflow(4000)).toBe(58);
  });

  it('refuses to shrink a text frame over the rendered text', () => {
    const previous = { height: 180, rotation: 0, width: 320, x: 40, y: 20 };
    const fromLeft = textSelectionFrame.clampResize(
      previous,
      { height: 40, rotation: 12, width: 20, x: 300, y: 90 },
      { height: 96, width: 80 },
    );

    expect(fromLeft).toEqual({
      height: 96,
      rotation: 12,
      width: 80,
      x: 280,
      y: 104,
    });
  });

  it('keeps the anchored edge when the opposite edge is resized below the text', () => {
    const previous = { height: 180, width: 320, x: 40, y: 20 };
    const fromRight = textSelectionFrame.clampResize(
      previous,
      { height: 200, width: 10, x: 40, y: 20 },
      { height: 96, width: 80 },
    );

    expect(fromRight.x).toBe(40);
    expect(fromRight.y).toBe(20);
    expect(fromRight.width).toBe(80);
    expect(fromRight.height).toBe(200);
  });
});
