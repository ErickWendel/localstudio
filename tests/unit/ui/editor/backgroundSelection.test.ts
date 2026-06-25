import { getNormalizedElementPoint } from '../../../../src/ui/editor/backgroundSelection';

describe('background selection', () => {
  it('normalizes a stage pointer to the clicked element bounds', () => {
    const point = getNormalizedElementPoint({
      element: { x: 100, y: 50, width: 400, height: 200 },
      pointer: { x: 150, y: 75 },
      scale: { x: 0.5, y: 0.5 },
    });

    expect(point).toEqual({ x: 0.5, y: 0.5 });
  });

  it('clamps clicks to the image bounds', () => {
    const point = getNormalizedElementPoint({
      element: { x: 100, y: 50, width: 400, height: 200 },
      pointer: { x: 20, y: 400 },
      scale: { x: 0.5, y: 0.5 },
    });

    expect(point).toEqual({ x: 0, y: 1 });
  });
});
