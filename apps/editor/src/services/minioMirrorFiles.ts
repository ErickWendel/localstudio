import { collectReferencedAssetIds } from '../domain/assetUsage';
import type { Asset, ProjectDocument } from '../domain/model';
import { getAssetFileExtension, objectUrlToBlobIfReadable } from './assetFileUtils';
import type { MirrorFile, ProjectRepository } from './interfaces';
import type { MinioMirrorConfig } from './minioMirrorService';
import { sha256Hex } from './minioObjectUtils';
import { jsonBlob } from './storageObjectUtils';

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

export const MIRROR_MANIFEST_FILE_NAME = 'localstudio-mirror.json';
export const PROJECT_FILE_NAME = 'project.json';

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
  };
}

async function assetToBlob(asset: Asset, requestFetch: typeof fetch) {
  return objectUrlToBlobIfReadable(asset.objectUrl, requestFetch);
}

async function createFileEntry(path: string, blob: Blob): Promise<MirrorFile & MirrorManifestFile> {
  return {
    path,
    blob,
    size: blob.size,
    checksum: await sha256Hex(blob),
  };
}

export async function createMirrorFiles(
  project: ProjectDocument,
  repository: ProjectRepository,
  config: MinioMirrorConfig,
  options: { fetch?: typeof fetch; now?: () => Date } = {},
): Promise<MirrorFile[]> {
  const requestFetch = options.fetch ?? getDefaultFetch();
  const now = options.now ?? (() => new Date());
  const referencedAssetIds = collectReferencedAssetIds(project);
  const projectForMirror: ProjectDocument = {
    ...project,
    assets: {},
  };
  const files: Array<MirrorFile & MirrorManifestFile> = [];

  for (const [assetId, asset] of Object.entries(project.assets)) {
    if (!referencedAssetIds.has(assetId)) continue;
    const fileName = asset.fileName ?? `${asset.id}.${getAssetFileExtension(asset.mimeType)}`;
    const blob = await assetToBlob(asset, requestFetch);
    if (blob) {
      const assetForMirror: Asset = {
        ...asset,
        fileName,
        storage: 'file',
      };
      delete assetForMirror.objectUrl;
      projectForMirror.assets[assetId] = assetForMirror;
      files.push(await createFileEntry(`assets/${fileName}`, blob));
    } else {
      projectForMirror.assets[assetId] = { ...asset };
    }
  }

  files.push(await createFileEntry(PROJECT_FILE_NAME, jsonBlob(projectForMirror)));

  const versions = repository.getVersionHistory ? await repository.getVersionHistory() : [];
  files.push(
    await createFileEntry(
      'history/manifest.json',
      jsonBlob({
        schemaVersion: 1,
        projectId: project.id,
        latestVersionId: versions[0]?.id,
        versions,
      }),
    ),
  );

  for (const version of versions) {
    const versionProject = repository.loadVersion ? await repository.loadVersion(version.id) : null;
    if (!versionProject) continue;
    files.push(
      await createFileEntry(
        `history/versions/${version.fileName}`,
        jsonBlob(cloneProjectWithoutObjectUrls(versionProject)),
      ),
    );
  }

  files.push(
    await createFileEntry(
      'config/localstudio.json',
      jsonBlob({
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
    ...(config.publicBaseUrl.trim() ? { publicBaseUrl: config.publicBaseUrl.trim() } : {}),
  };
  files.push(await createFileEntry(MIRROR_MANIFEST_FILE_NAME, jsonBlob(manifest)));

  return files;
}
