import { collectReferencedAssetIds } from '../../domain/assets/assetUsage';
import type { Asset, ProjectDocument, TranscriptRecordingAudio } from '../../domain/documents/model';
import { assetFileUtils } from '../storage/assetFileUtils';
import type { MirrorFile, ProjectRepository } from '../contracts/interfaces';
import type { MinioMirrorConfig } from './minioMirrorService';
import { minioObjectUtils } from './minioObjectUtils';
import { storageObjectUtils } from '../storage/storageObjectUtils';

export interface MirrorManifestFile {
  path: string;
  size: number;
  checksum: string;
}

export interface MirrorManifest {
  schemaVersion: 1;
  projectId: string;
  projectName: string;
  syncedAt: string;
  files: Record<string, MirrorManifestFile>;
  publicBaseUrl?: string;
}

export interface MirrorFileCache {
  objectFiles: Map<string, MirrorFile & MirrorManifestFile>;
  versionFiles: Map<string, MirrorFile & MirrorManifestFile>;
}

const MIRROR_MANIFEST_FILE_NAME = 'localstudio-mirror.json';
const PROJECT_FILE_NAME = 'project.json';

function getDefaultFetch() {
  if (typeof window !== 'undefined') return window.fetch.bind(window);
  return globalThis.fetch.bind(globalThis);
}

function cloneProjectWithoutObjectUrls(project: ProjectDocument): ProjectDocument {
  return {
    ...project,
    assets: Object.fromEntries(
      Object.entries(project.assets).map(([assetId, asset]) => {
        const nextAsset = { ...asset };
        delete nextAsset.objectUrl;
        return [assetId, nextAsset];
      }),
    ),
    ...(project.fonts
      ? {
          fonts: Object.fromEntries(
            Object.entries(project.fonts).map(([fontId, font]) => {
              const nextFont = { ...font };
              delete nextFont.objectUrl;
              return [fontId, nextFont];
            }),
          ),
        }
      : {}),
    ...(project.recordings
      ? {
          recordings: Object.fromEntries(
            Object.entries(project.recordings).map(([recordingId, recording]) => {
              const nextRecording = {
                ...recording,
                audio: { ...recording.audio },
              };
              delete nextRecording.audio.objectUrl;
              return [recordingId, nextRecording];
            }),
          ),
        }
      : {}),
  };
}

async function objectUrlToBlob(value: { objectUrl?: string }, requestFetch: typeof fetch) {
  return assetFileUtils.objectUrlToBlobIfReadable(value.objectUrl, requestFetch);
}

async function createFileEntry(path: string, blob: Blob): Promise<MirrorFile & MirrorManifestFile> {
  return {
    path,
    blob,
    size: blob.size,
    checksum: await minioObjectUtils.sha256Hex(blob),
  };
}

async function createMirrorFiles(
  project: ProjectDocument,
  repository: ProjectRepository,
  config: MinioMirrorConfig,
  options: { fetch?: typeof fetch; now?: () => Date; cache?: MirrorFileCache } = {},
): Promise<MirrorFile[]> {
  const requestFetch = options.fetch ?? getDefaultFetch();
  const now = options.now ?? (() => new Date());
  const referencedAssetIds = collectReferencedAssetIds(project);
  const projectForMirror: ProjectDocument = {
    ...project,
    assets: {},
    ...(project.fonts ? { fonts: {} } : {}),
  };
  const files: Array<MirrorFile & MirrorManifestFile> = [];

  async function createObjectFileEntry(path: string, objectUrl: string | undefined) {
    if (!objectUrl) return undefined;
    const cacheKey = `${path}\n${objectUrl}`;
    const cachedEntry = options.cache?.objectFiles.get(cacheKey);
    if (cachedEntry) return cachedEntry;
    const blob = await objectUrlToBlob({ objectUrl }, requestFetch);
    if (!blob) return undefined;
    const entry = await createFileEntry(path, blob);
    options.cache?.objectFiles.set(cacheKey, entry);
    return entry;
  }

  for (const [assetId, asset] of Object.entries(project.assets)) {
    if (!referencedAssetIds.has(assetId)) continue;
    const fileName = asset.fileName ?? `${asset.id}.${assetFileUtils.getAssetFileExtension(asset.mimeType)}`;
    const entry = await createObjectFileEntry(
      `assets/${fileName}`,
      asset.objectUrl,
    );
    if (entry) {
      const assetForMirror: Asset = {
        ...asset,
        fileName,
        storage: 'file',
      };
      delete assetForMirror.objectUrl;
      projectForMirror.assets[assetId] = assetForMirror;
      files.push(entry);
    } else {
      projectForMirror.assets[assetId] = { ...asset };
    }
  }

  for (const [fontId, font] of Object.entries(project.fonts ?? {})) {
    const entry = await createObjectFileEntry(`fonts/${font.fileName}`, font.objectUrl);
    if (entry) {
      const fontForMirror = {
        ...font,
        storage: 'file' as const,
      };
      delete fontForMirror.objectUrl;
      projectForMirror.fonts![fontId] = fontForMirror;
      files.push(entry);
    } else {
      projectForMirror.fonts![fontId] = { ...font };
    }
  }

  for (const [recordingId, recording] of Object.entries(project.recordings ?? {})) {
    const fileName =
      recording.audio.fileName ??
      `${recording.id}.${assetFileUtils.getAssetFileExtension(recording.audio.mimeType)}`;
    const entry = await createObjectFileEntry(
      `recordings/${fileName}`,
      recording.audio.objectUrl,
    );
    if (entry) {
      const audioForMirror: TranscriptRecordingAudio = {
        ...recording.audio,
        fileName,
        storage: 'file',
      };
      delete audioForMirror.objectUrl;
      projectForMirror.recordings![recordingId] = {
        ...recording,
        audio: audioForMirror,
      };
      files.push(entry);
    } else {
      projectForMirror.recordings![recordingId] = { ...recording };
    }
  }

  files.push(await createFileEntry(PROJECT_FILE_NAME, storageObjectUtils.jsonBlob(projectForMirror)));

  const versions = repository.getVersionHistory ? await repository.getVersionHistory() : [];
  files.push(
    await createFileEntry(
      'history/manifest.json',
      storageObjectUtils.jsonBlob({
        schemaVersion: 1,
        projectId: project.id,
        latestVersionId: versions[0]?.id,
        versions,
      }),
    ),
  );

  for (const version of versions) {
    const versionCacheKey = `${version.id}\n${version.fileName}`;
    const cachedVersionFile = options.cache?.versionFiles.get(versionCacheKey);
    if (cachedVersionFile) {
      files.push(cachedVersionFile);
      continue;
    }
    const versionProject = repository.loadVersion ? await repository.loadVersion(version.id) : null;
    if (!versionProject) continue;
    const versionFile = await createFileEntry(
      `history/versions/${version.fileName}`,
      storageObjectUtils.jsonBlob(cloneProjectWithoutObjectUrls(versionProject)),
    );
    options.cache?.versionFiles.set(versionCacheKey, versionFile);
    files.push(versionFile);
  }

  files.push(
    await createFileEntry(
      'config/localstudio.json',
      storageObjectUtils.jsonBlob({
        app: 'LocalStudio.dev',
        projectId: project.id,
        schemaVersion: 1,
        savedAt: project.updatedAt,
      }),
    ),
  );

  const manifestFiles = Object.fromEntries(
    files.map((file) => [
      file.path,
      {
        path: file.path,
        size: file.size,
        checksum: file.checksum,
      },
    ]),
  );
  const manifest: MirrorManifest = {
    schemaVersion: 1,
    projectId: project.id,
    projectName: project.name,
    syncedAt: now().toISOString(),
    files: manifestFiles,
    publicBaseUrl: (config.publicBaseUrl.trim() || minioObjectUtils.createDefaultPublicBaseUrl(config)).replace(
      /\/+$/g,
      '',
    ),
  };
  files.push(await createFileEntry(MIRROR_MANIFEST_FILE_NAME, storageObjectUtils.jsonBlob(manifest)));

  return files;
}

export const minioMirrorFiles = {
  MIRROR_MANIFEST_FILE_NAME,
  PROJECT_FILE_NAME,
  createMirrorFiles,
};
