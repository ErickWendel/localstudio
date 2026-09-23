import type { ProjectDocument } from '../../domain/documents/model';

function isNotFoundError(error: unknown) {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

async function getOptionalDirectory(directory: FileSystemDirectoryHandle, name: string) {
  try {
    return await directory.getDirectoryHandle(name);
  } catch (error) {
    if (isNotFoundError(error)) return undefined;
    throw error;
  }
}

async function destinationHasFile(directory: FileSystemDirectoryHandle, fileName: string) {
  try {
    await directory.getFileHandle(fileName);
    return true;
  } catch (error) {
    if (isNotFoundError(error)) return false;
    throw error;
  }
}

async function copyFileIfMissing(
  sourceDirectory: FileSystemDirectoryHandle,
  destinationDirectory: FileSystemDirectoryHandle,
  fileName: string,
) {
  if (await destinationHasFile(destinationDirectory, fileName)) return;

  let sourceHandle: FileSystemFileHandle;
  try {
    sourceHandle = await sourceDirectory.getFileHandle(fileName);
  } catch (error) {
    if (isNotFoundError(error)) return;
    throw error;
  }

  const destinationHandle = await destinationDirectory.getFileHandle(fileName, { create: true });
  const writable = await destinationHandle.createWritable();
  await writable.write(await sourceHandle.getFile());
  await writable.close();
}

async function copyNamedFiles(
  sourceRoot: FileSystemDirectoryHandle,
  destinationRoot: FileSystemDirectoryHandle,
  folderName: string,
  fileNames: Array<string | undefined>,
) {
  const names = [...new Set(fileNames.filter((fileName): fileName is string => Boolean(fileName)))];
  if (names.length === 0) return;

  const sourceDirectory = await getOptionalDirectory(sourceRoot, folderName);
  if (!sourceDirectory) return;

  const destinationDirectory = await destinationRoot.getDirectoryHandle(folderName, {
    create: true,
  });
  for (const fileName of names) {
    await copyFileIfMissing(sourceDirectory, destinationDirectory, fileName);
  }
}

interface CopyMissingFileBackedProjectFilesOptions {
  includeRecordings: boolean;
}

export async function copyMissingFileBackedProjectFiles(
  sourceDirectory: FileSystemDirectoryHandle,
  destinationDirectory: FileSystemDirectoryHandle,
  project: ProjectDocument,
  options: CopyMissingFileBackedProjectFilesOptions,
) {
  if (sourceDirectory === destinationDirectory) return;

  await copyNamedFiles(
    sourceDirectory,
    destinationDirectory,
    'assets',
    Object.values(project.assets)
      .filter((asset) => asset.storage === 'file')
      .map((asset) => asset.fileName),
  );
  await copyNamedFiles(
    sourceDirectory,
    destinationDirectory,
    'fonts',
    Object.values(project.fonts ?? {})
      .filter((font) => font.storage === 'file')
      .map((font) => font.fileName),
  );
  if (!options.includeRecordings) return;

  await copyNamedFiles(
    sourceDirectory,
    destinationDirectory,
    'recordings',
    Object.values(project.recordings ?? {}).flatMap((recording) => [
      recording.audio.storage === 'file' ? recording.audio.fileName : undefined,
      recording.transcriptFileName,
    ]),
  );
}
