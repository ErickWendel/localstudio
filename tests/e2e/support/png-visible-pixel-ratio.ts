import { inflateSync } from 'node:zlib';
import { expect } from './journey-test';

function decodePngRgbaPixels(bytes: Uint8Array) {
  const signature = Buffer.from(bytes.subarray(0, 8));
  expect(signature).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  let offset = 8;
  let width = 0;
  let height = 0;
  const idatChunks: Buffer[] = [];
  while (offset < bytes.length) {
    const length = Buffer.from(bytes.subarray(offset, offset + 4)).readUInt32BE(0);
    const type = Buffer.from(bytes.subarray(offset + 4, offset + 8)).toString('ascii');
    const data = Buffer.from(bytes.subarray(offset + 8, offset + 8 + length));
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8]).toBe(8);
      expect(data[9]).toBe(6);
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  const raw = inflateSync(Buffer.concat(idatChunks));
  const stride = width * 4;
  const pixels = Buffer.alloc(height * stride);
  let readOffset = 0;
  const paeth = (left: number, up: number, upperLeft: number) => {
    const estimate = left + up - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
    return upDistance <= upperLeftDistance ? up : upperLeft;
  };

  for (let y = 0; y < height; y += 1) {
    const filter = raw[readOffset++];
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? pixels[y * stride + x - 4] ?? 0 : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] ?? 0 : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] ?? 0 : 0;
      const value = raw[readOffset++] ?? 0;
      let decoded: number;
      if (filter === 0) decoded = value;
      else if (filter === 1) decoded = value + left;
      else if (filter === 2) decoded = value + up;
      else if (filter === 3) decoded = value + Math.floor((left + up) / 2);
      else if (filter === 4) decoded = value + paeth(left, up, upperLeft);
      else throw new Error(`Unsupported PNG filter ${filter}.`);
      pixels[y * stride + x] = decoded & 0xff;
    }
  }

  return { height, pixels, width };
}

export function readPngVisiblePixelRatio(bytes: Uint8Array) {
  const { height, pixels, width } = decodePngRgbaPixels(bytes);
  let visiblePixels = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = ((pixels[index] ?? 0) + (pixels[index + 1] ?? 0) + (pixels[index + 2] ?? 0)) / 3;
    if (luminance > 24) visiblePixels += 1;
  }
  return visiblePixels / (width * height);
}
