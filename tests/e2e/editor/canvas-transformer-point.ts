import { type Page } from '@playwright/test';

type TransformerPoint = 'center' | 'bottom-right';

async function get(page: Page, point: TransformerPoint) {
  return page.locator('.konvajs-content canvas').evaluate((canvas: HTMLCanvasElement, target) => {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Expected the editor canvas to use a 2D rendering context');

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const greenPixels: Array<{ x: number; y: number }> = [];
    let minimumX = canvas.width;
    let minimumY = canvas.height;
    let maximumX = -1;
    let maximumY = -1;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        const red = pixels[offset];
        const green = pixels[offset + 1];
        const blue = pixels[offset + 2];
        const alpha = pixels[offset + 3];
        if (red >= 100 || green <= 200 || blue >= 180 || alpha <= 180) continue;
        greenPixels.push({ x, y });
        minimumX = Math.min(minimumX, x);
        minimumY = Math.min(minimumY, y);
        maximumX = Math.max(maximumX, x);
        maximumY = Math.max(maximumY, y);
      }
    }
    if (maximumX < 0 || maximumY < 0) {
      throw new Error('Could not find the selected element transformer on the editor canvas');
    }

    let canvasPoint = {
      x: (minimumX + maximumX) / 2,
      y: (minimumY + maximumY) / 2,
    };
    if (target === 'bottom-right') {
      const handlePixels = greenPixels.filter(
        ({ x, y }) => x >= maximumX - 16 && y >= maximumY - 16,
      );
      canvasPoint = handlePixels.reduce(
        (center, handlePoint) => ({
          x: center.x + handlePoint.x / handlePixels.length,
          y: center.y + handlePoint.y / handlePixels.length,
        }),
        { x: 0, y: 0 },
      );
    }

    const bounds = canvas.getBoundingClientRect();
    return {
      x: bounds.left + (canvasPoint.x / canvas.width) * bounds.width,
      y: bounds.top + (canvasPoint.y / canvas.height) * bounds.height,
    };
  }, point);
}

export const canvasTransformerPoint = { get };
