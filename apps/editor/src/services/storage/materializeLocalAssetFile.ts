export interface MaterializedLocalAssetFile {
  fileName: string;
  objectUrl: string;
}

function isNotFoundError(error: unknown) {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

function safeAssetFileName(fileName: string) {
  const baseName = fileName.split(/[/\\]/).pop() ?? 'asset.bin';
  const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, '-');
  return safeName.length > 0 ? safeName : 'asset.bin';
}

async function fileExists(directory: FileSystemDirectoryHandle, fileName: string) {
  try {
    await directory.getFileHandle(fileName);
    return true;
  } catch (error) {
    if (isNotFoundError(error)) return false;
    throw error;
  }
}

async function uniqueFileName(directory: FileSystemDirectoryHandle, fileName: string) {
  if (!(await fileExists(directory, fileName))) return fileName;
  const extensionIndex = fileName.lastIndexOf('.');
  const stem = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
  const extension = extensionIndex > 0 ? fileName.slice(extensionIndex) : '';
  for (let index = 1; index < 1000; index += 1) {
    const candidate = `${stem}-${index}${extension}`;
    if (!(await fileExists(directory, candidate))) return candidate;
  }
  return `${stem}-${Date.now()}${extension}`;
}

export async function materializeLocalAssetFile(
  directory: FileSystemDirectoryHandle,
  preferredFileName: string,
  blob: Blob,
): Promise<MaterializedLocalAssetFile> {
  const fileName = await uniqueFileName(directory, safeAssetFileName(preferredFileName));
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  const storedFile = await fileHandle.getFile();
  return {
    fileName,
    objectUrl: URL.createObjectURL(storedFile),
  };
}
