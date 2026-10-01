declare module 'gifenc' {
  type Palette = number[][];

  interface GifEncoder {
    bytes(): Uint8Array;
    finish(): void;
    writeFrame(
      indexedPixels: Uint8Array,
      width: number,
      height: number,
      options: { delay: number; palette: Palette; repeat: number },
    ): void;
  }

  export function GIFEncoder(): GifEncoder;
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: 'rgb444' | 'rgb565' | 'rgba4444',
  ): Uint8Array;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: 'rgb444' | 'rgb565' | 'rgba4444' },
  ): Palette;
}
