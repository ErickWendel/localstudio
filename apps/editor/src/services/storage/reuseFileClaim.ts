import { assetFileUtils } from './assetFileUtils';

function isNotFoundError(error: unknown) {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

export async function shouldReuseFileClaim(
  directory: FileSystemDirectoryHandle,
  claim: {
    fileName?: string | undefined;
    objectUrl?: string | undefined;
    storage?: string | undefined;
  },
) {
  if (claim.storage !== 'file' || !claim.fileName) return false;
  try {
    await directory.getFileHandle(claim.fileName);
    return true;
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }
  return !assetFileUtils.isReadableObjectUrl(claim.objectUrl);
}
