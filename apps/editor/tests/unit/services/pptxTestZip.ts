interface StoredZipInput {
  contents: BlobPart;
  path: string;
}

const textEncoder = new TextEncoder();

function toBytes(contents: BlobPart) {
  if (typeof contents === 'string') return textEncoder.encode(contents);
  if (contents instanceof ArrayBuffer) return new Uint8Array(contents);
  if (ArrayBuffer.isView(contents)) {
    return new Uint8Array(contents.buffer, contents.byteOffset, contents.byteLength);
  }
  return textEncoder.encode(String(contents));
}

function uint16(value: number) {
  return [value & 0xff, (value >> 8) & 0xff];
}

function uint32(value: number) {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

function pushBytes(target: number[], bytes: ArrayLike<number>) {
  for (let index = 0; index < bytes.length; index += 1) target.push(bytes[index] ?? 0);
}

export function createStoredPptxFile(entries: StoredZipInput[], name = 'deck.pptx') {
  const localRecords: number[] = [];
  const centralRecords: number[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.path);
    const contents = toBytes(entry.contents);
    const localOffset = offset;

    pushBytes(localRecords, uint32(0x04034b50));
    pushBytes(localRecords, uint16(20));
    pushBytes(localRecords, uint16(0));
    pushBytes(localRecords, uint16(0));
    pushBytes(localRecords, uint16(0));
    pushBytes(localRecords, uint16(0));
    pushBytes(localRecords, uint32(0));
    pushBytes(localRecords, uint32(contents.byteLength));
    pushBytes(localRecords, uint32(contents.byteLength));
    pushBytes(localRecords, uint16(nameBytes.byteLength));
    pushBytes(localRecords, uint16(0));
    pushBytes(localRecords, nameBytes);
    pushBytes(localRecords, contents);

    pushBytes(centralRecords, uint32(0x02014b50));
    pushBytes(centralRecords, uint16(20));
    pushBytes(centralRecords, uint16(20));
    pushBytes(centralRecords, uint16(0));
    pushBytes(centralRecords, uint16(0));
    pushBytes(centralRecords, uint16(0));
    pushBytes(centralRecords, uint16(0));
    pushBytes(centralRecords, uint32(0));
    pushBytes(centralRecords, uint32(contents.byteLength));
    pushBytes(centralRecords, uint32(contents.byteLength));
    pushBytes(centralRecords, uint16(nameBytes.byteLength));
    pushBytes(centralRecords, uint16(0));
    pushBytes(centralRecords, uint16(0));
    pushBytes(centralRecords, uint16(0));
    pushBytes(centralRecords, uint16(0));
    pushBytes(centralRecords, uint32(0));
    pushBytes(centralRecords, uint32(localOffset));
    pushBytes(centralRecords, nameBytes);

    offset += 30 + nameBytes.byteLength + contents.byteLength;
  }

  const centralOffset = localRecords.length;
  const centralSize = centralRecords.length;
  const endRecord: number[] = [];
  pushBytes(endRecord, uint32(0x06054b50));
  pushBytes(endRecord, uint16(0));
  pushBytes(endRecord, uint16(0));
  pushBytes(endRecord, uint16(entries.length));
  pushBytes(endRecord, uint16(entries.length));
  pushBytes(endRecord, uint32(centralSize));
  pushBytes(endRecord, uint32(centralOffset));
  pushBytes(endRecord, uint16(0));

  return new File([new Uint8Array([...localRecords, ...centralRecords, ...endRecord])], name, {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}
