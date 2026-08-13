export function readCanvasPixel(
  canvas: HTMLCanvasElement,
  point: { x: number; y: number },
) {
  const context = canvas.getContext('2d');
  if (!context) return [];
  return Array.from(context.getImageData(point.x, point.y, 1, 1).data);
}
