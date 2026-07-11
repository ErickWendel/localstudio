const tinyPngBytes = new Uint8Array([137, 80, 78, 71]);

export const pptxLayoutMediaParts = [
  { path: 'ppt/media/layout-icon.png', contents: tinyPngBytes },
] as const;
