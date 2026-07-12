import type { PptxImageSize, PptxPackageFile } from './pptxPackageTypes';

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset]! * 0x1000000 +
    bytes[offset + 1]! * 0x10000 +
    bytes[offset + 2]! * 0x100 +
    bytes[offset + 3]!
  );
}

function readUint16(bytes: Uint8Array, offset: number) {
  return bytes[offset]! * 0x100 + bytes[offset + 1]!;
}

function parsePngSize(bytes: Uint8Array): PptxImageSize | undefined {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return undefined;
  }
  const width = readUint32(bytes, 16);
  const height = readUint32(bytes, 20);
  return width > 0 && height > 0 ? { height, width } : undefined;
}

function parseJpegSize(bytes: Uint8Array): PptxImageSize | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return undefined;
    const marker = bytes[offset + 1];
    const length = readUint16(bytes, offset + 2);
    if (length < 2) return undefined;
    if (marker && marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      const height = readUint16(bytes, offset + 5);
      const width = readUint16(bytes, offset + 7);
      return width > 0 && height > 0 ? { height, width } : undefined;
    }
    offset += 2 + length;
  }
  return undefined;
}

async function getSize(file: PptxPackageFile, mimeType: string | undefined): Promise<PptxImageSize | undefined> {
  if (!mimeType?.startsWith('image/')) return undefined;
  const bytes = new Uint8Array(await file.blob.arrayBuffer());
  if (mimeType === 'image/png' || file.path.toLowerCase().endsWith('.png')) return parsePngSize(bytes);
  if (mimeType === 'image/jpeg' || file.path.toLowerCase().match(/\.jpe?g$/)) return parseJpegSize(bytes);
  return undefined;
}

export const pptxImageDimensions = {
  getSize,
};
