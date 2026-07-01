import { fitImageWithinPage } from '../../../src/domain/images/imageSizing';

describe('fitImageWithinPage', () => {
  it('keeps images at natural size when they fit inside the page', () => {
    expect(
      fitImageWithinPage({
        imageWidth: 516,
        imageHeight: 387,
        pageWidth: 1920,
        pageHeight: 1080,
      }),
    ).toEqual({ x: 702, y: 347, width: 516, height: 387 });
  });

  it('scales images down proportionally when they are larger than the page', () => {
    expect(
      fitImageWithinPage({
        imageWidth: 4000,
        imageHeight: 2000,
        pageWidth: 1920,
        pageHeight: 1080,
      }),
    ).toEqual({ x: 0, y: 60, width: 1920, height: 960 });
  });
});
