import { pptxFileUtils } from './pptxFileUtils';
import type { PptxPackageFile } from './pptxPackageTypes';

export interface PptxZipEntry {
  compressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
  name: string;
}

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;

function toBlobPart(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function readUInt16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readUInt32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function findEndOfCentralDirectory(view: DataView) {
  const minimumOffset = Math.max(0, view.byteLength - 65557);
  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (readUInt32(view, offset) === ZIP_EOCD_SIGNATURE) return offset;
  }
  throw new Error('PowerPoint file is corrupt: ZIP central directory was not found.');
}

function readEntries(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEndOfCentralDirectory(view);
  const entryCount = readUInt16(view, eocdOffset + 10);
  let offset = readUInt32(view, eocdOffset + 16);
  const entries: PptxZipEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32(view, offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('PowerPoint file is corrupt: invalid ZIP central directory entry.');
    }
    const compressionMethod = readUInt16(view, offset + 10);
    const compressedSize = readUInt32(view, offset + 20);
    const nameLength = readUInt16(view, offset + 28);
    const extraLength = readUInt16(view, offset + 30);
    const commentLength = readUInt16(view, offset + 32);
    const localHeaderOffset = readUInt32(view, offset + 42);
    const nameBytes = bytes.slice(offset + 46, offset + 46 + nameLength);
    const name = new TextDecoder().decode(nameBytes);
    if (!name.endsWith('/')) entries.push({ compressedSize, compressionMethod, localHeaderOffset, name });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

async function inflateRaw(bytes: Uint8Array) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('Deflated PowerPoint archives are not supported in this browser.');
  }
  const blob = new Blob([toBlobPart(bytes)]);
  const sourceStream =
    typeof blob.stream === 'function' ? blob.stream() : new Response(toBlobPart(bytes)).body;
  if (!sourceStream) {
    throw new Error('Deflated PowerPoint archives are not supported in this browser.');
  }
  const stream = sourceStream.pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function extractEntry(bytes: Uint8Array, entry: PptxZipEntry) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = entry.localHeaderOffset;
  if (readUInt32(view, offset) !== ZIP_LOCAL_FILE_SIGNATURE) {
    throw new Error('PowerPoint file is corrupt: invalid ZIP local file entry.');
  }
  const nameLength = readUInt16(view, offset + 26);
  const extraLength = readUInt16(view, offset + 28);
  const dataOffset = offset + 30 + nameLength + extraLength;
  const compressedBytes = bytes.slice(dataOffset, dataOffset + entry.compressedSize);
  if (entry.compressionMethod === 0) return compressedBytes;
  if (entry.compressionMethod === 8) return inflateRaw(compressedBytes);
  throw new Error(`Unsupported PowerPoint ZIP compression method ${entry.compressionMethod}.`);
}

async function readPackage(file: File): Promise<PptxPackageFile[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = readEntries(bytes);
  return Promise.all(
    entries.map(async (entry): Promise<PptxPackageFile> => {
      const contents = await extractEntry(bytes, entry);
      return {
        path: pptxFileUtils.normalizePath(entry.name),
        blob: new Blob([contents], { type: pptxFileUtils.getMimeType(entry.name) }),
      };
    }),
  );
}

export const pptxZip = {
  readEntries,
  readPackage,
};
