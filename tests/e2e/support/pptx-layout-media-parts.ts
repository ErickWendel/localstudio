const tinyPngBytes = new Uint8Array([137, 80, 78, 71]);
const whitePixelPngBytes = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64',
  ),
);

export const pptxLayoutMediaParts = [
  { path: 'ppt/media/background-image.png', contents: whitePixelPngBytes },
  { path: 'ppt/media/layout-icon.png', contents: tinyPngBytes },
] as const;
