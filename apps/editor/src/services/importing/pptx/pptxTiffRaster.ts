import { zlibSync } from 'fflate';

interface TiffRaster {
  height: number;
  rgba: Uint8Array;
  width: number;
}

function readNumber(view: DataView, offset: number, littleEndian: boolean, byteCount: number) {
  if (byteCount === 1) return view.getUint8(offset);
  if (byteCount === 2) return view.getUint16(offset, littleEndian);
  return view.getUint32(offset, littleEndian);
}

function readShorts(view: DataView, offset: number, count: number, littleEndian: boolean) {
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push(view.getUint16(offset + index * 2, littleEndian));
  }
  return values;
}

function readLongs(view: DataView, offset: number, count: number, littleEndian: boolean) {
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push(view.getUint32(offset + index * 4, littleEndian));
  }
  return values;
}

function readTagValues(view: DataView, entryOffset: number, littleEndian: boolean) {
  const type = view.getUint16(entryOffset + 2, littleEndian);
  const count = view.getUint32(entryOffset + 4, littleEndian);
  const valueBytes = type === 3 ? 2 : 4;
  const inline = count * valueBytes <= 4;
  const dataOffset = inline ? entryOffset + 8 : view.getUint32(entryOffset + 8, littleEndian);
  if (type === 3) return readShorts(view, dataOffset, count, littleEndian);
  if (type === 4) return readLongs(view, dataOffset, count, littleEndian);
  return [readNumber(view, dataOffset, littleEndian, valueBytes)];
}

function decodeUncompressedTiff(bytes: Uint8Array): TiffRaster | undefined {
  if (bytes.byteLength < 16) return undefined;
  const littleEndian = bytes[0] === 0x49 && bytes[1] === 0x49;
  const bigEndian = bytes[0] === 0x4d && bytes[1] === 0x4d;
  if (!littleEndian && !bigEndian) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(2, littleEndian) !== 42) return undefined;
  const ifdOffset = view.getUint32(4, littleEndian);
  if (ifdOffset + 2 > bytes.byteLength) return undefined;
  const entryCount = view.getUint16(ifdOffset, littleEndian);
  const tags = new Map<number, number[]>();
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    if (entryOffset + 12 > bytes.byteLength) return undefined;
    tags.set(view.getUint16(entryOffset, littleEndian), readTagValues(view, entryOffset, littleEndian));
  }
  const width = tags.get(256)?.[0];
  const height = tags.get(257)?.[0];
  const compression = tags.get(259)?.[0] ?? 1;
  const photometric = tags.get(262)?.[0];
  const samples = tags.get(277)?.[0] ?? tags.get(258)?.length ?? 1;
  const bits = tags.get(258) ?? [8];
  const planar = tags.get(284)?.[0] ?? 1;
  if (!width || !height || compression !== 1 || planar !== 1) return undefined;
  if (photometric !== 2 || bits.some((value) => value !== 8) || (samples !== 3 && samples !== 4)) {
    return undefined;
  }
  const rowsPerStrip = tags.get(278)?.[0] || height;
  const stripOffsets = tags.get(273) ?? [];
  const stripByteCounts = tags.get(279) ?? [];
  const rgba = new Uint8Array(width * height * 4);
  let row = 0;
  for (let stripIndex = 0; stripIndex < stripOffsets.length && row < height; stripIndex += 1) {
    const offset = stripOffsets[stripIndex] ?? 0;
    const available = stripByteCounts[stripIndex] ?? bytes.byteLength - offset;
    const stripRows = Math.min(rowsPerStrip, height - row);
    const expected = stripRows * width * samples;
    if (offset < 0 || offset + Math.min(available, expected) > bytes.byteLength) return undefined;
    for (let stripRow = 0; stripRow < stripRows; stripRow += 1) {
      const source = offset + stripRow * width * samples;
      const target = (row + stripRow) * width * 4;
      for (let column = 0; column < width; column += 1) {
        const pixel = source + column * samples;
        rgba[target + column * 4] = bytes[pixel] ?? 0;
        rgba[target + column * 4 + 1] = bytes[pixel + 1] ?? 0;
        rgba[target + column * 4 + 2] = bytes[pixel + 2] ?? 0;
        rgba[target + column * 4 + 3] = samples === 4 ? (bytes[pixel + 3] ?? 255) : 255;
      }
    }
    row += stripRows;
  }
  if (row !== height) return undefined;
  return { height, rgba, width };
}

function concat(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32(value: number) {
  return Uint8Array.of((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

function chunk(type: string, data: Uint8Array) {
  const typeBytes = new TextEncoder().encode(type);
  return concat([uint32(data.byteLength), typeBytes, data, uint32(crc32(concat([typeBytes, data])))]);
}

function encodePng(raster: TiffRaster) {
  const stride = raster.width * 4;
  const filtered = new Uint8Array((stride + 1) * raster.height);
  for (let row = 0; row < raster.height; row += 1) {
    filtered[row * (stride + 1)] = 0;
    filtered.set(raster.rgba.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1);
  }
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, raster.width);
  headerView.setUint32(4, raster.height);
  header[8] = 8;
  header[9] = 6;
  return concat([
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    chunk('IHDR', header),
    chunk('IDAT', zlibSync(filtered)),
    chunk('IEND', new Uint8Array()),
  ]);
}

function toPng(bytes: Uint8Array) {
  const raster = decodeUncompressedTiff(bytes);
  if (!raster) return undefined;
  return encodePng(raster);
}

export const pptxTiffRaster = {
  decodeUncompressedTiff,
  toPng,
};
