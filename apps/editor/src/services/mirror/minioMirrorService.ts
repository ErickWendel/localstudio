import type {
  MirrorFile,
  MirrorProjectSummary,
  MirrorService,
  MirrorState,
  MirrorSyncProgress,
  ProjectRepository,
} from '../contracts/interfaces';
import type { ProjectDocument } from '../../domain/documents/model';
import type { BrowserKeyValueStorage } from '../browser/browserStorage';
import { browserStorage } from '../browser/browserStorage';
import { storageObjectUtils } from '../storage/storageObjectUtils';
import { minioObjectUtils } from './minioObjectUtils';
import type { MirrorManifest } from './minioMirrorFiles';
import { minioMirrorFiles } from './minioMirrorFiles';

export interface MinioMirrorConfig {
  endpoint: string;
  bucket: string;
  region: string;
  accessKey?: string;
  secretKey?: string;
  writerAccessKey?: string;
  writerSecretKey?: string;
  readerAccessKey?: string;
  readerSecretKey?: string;
  pathStyle: boolean;
  publicBaseUrl: string;
  prefix: string;
}

export interface MinioMirrorCredentials {
  accessKey: string;
  secretKey: string;
}

interface MinioMirrorServiceOptions {
  fetch?: typeof fetch;
  now?: () => Date;
  storage?: BrowserKeyValueStorage;
}

const CONFIG_STORAGE_KEY = 'localstudio.minioMirror.config';

const DEFAULT_MINIO_MIRROR_CONFIG: MinioMirrorConfig = {
  accessKey: 'localstudio-writer',
  bucket: 'localstudio',
  endpoint: 'http://localhost:9000',
  pathStyle: true,
  publicBaseUrl: 'http://localhost:9000/localstudio',
  region: 'us-east-1',
  secretKey: 'localstudio-writer',
  writerAccessKey: 'localstudio-writer',
  writerSecretKey: 'localstudio-writer',
  readerAccessKey: 'localstudio-reader',
  readerSecretKey: 'localstudio-reader',
  prefix: 'mirrors',
};

const LOCAL_MINIO_SPLIT_CREDENTIALS = {
  accessKey: 'localstudio-writer',
  secretKey: 'localstudio-writer',
  writerAccessKey: 'localstudio-writer',
  writerSecretKey: 'localstudio-writer',
  readerAccessKey: 'localstudio-reader',
  readerSecretKey: 'localstudio-reader',
} as const;

const LEGACY_LOCAL_MINIO_CREDENTIALS = {
  accessKey: 'localstudio',
  secretKey: 'localstudio123',
} as const;

const DELETE_BATCH_SIZE = 25;

function getProjectMirrorKey(projectName: string) {
  return projectName.trim().replace(/[\\/]+/g, '-');
}

function getDefaultFetch() {
  if (typeof window !== 'undefined') return window.fetch.bind(window);
  return globalThis.fetch.bind(globalThis);
}

function getProjectRoot(config: MinioMirrorConfig, projectKey: string) {
  return storageObjectUtils.joinObjectKey(
    storageObjectUtils.normalizeObjectKeyPart(config.prefix),
    projectKey,
  );
}

function getProjectFileKey(config: MinioMirrorConfig, projectKey: string, path: string) {
  return storageObjectUtils.joinObjectKey(getProjectRoot(config, projectKey), path);
}

function isLegacyLocalMinioConfig(config: MinioMirrorConfig) {
  return (
    !config.writerAccessKey &&
    !config.writerSecretKey &&
    !config.readerAccessKey &&
    !config.readerSecretKey &&
    config.accessKey === LEGACY_LOCAL_MINIO_CREDENTIALS.accessKey &&
    config.secretKey === LEGACY_LOCAL_MINIO_CREDENTIALS.secretKey &&
    config.endpoint.replace(/\/+$/g, '') === DEFAULT_MINIO_MIRROR_CONFIG.endpoint &&
    config.bucket === DEFAULT_MINIO_MIRROR_CONFIG.bucket
  );
}

function normalizeMirrorConfig(config: MinioMirrorConfig): MinioMirrorConfig {
  if (isLegacyLocalMinioConfig(config)) {
    return {
      ...config,
      ...LOCAL_MINIO_SPLIT_CREDENTIALS,
    };
  }
  return config;
}

function getWriterCredentials(config: MinioMirrorConfig): MinioMirrorCredentials {
  return {
    accessKey: config.writerAccessKey || config.accessKey || '',
    secretKey: config.writerSecretKey || config.secretKey || '',
  };
}

function getReaderCredentials(config: MinioMirrorConfig): MinioMirrorCredentials {
  return {
    accessKey: config.readerAccessKey || config.writerAccessKey || config.accessKey || '',
    secretKey: config.readerSecretKey || config.writerSecretKey || config.secretKey || '',
  };
}

function parseMirrorProjects(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(document.querySelectorAll('Contents Key'))
    .map((node) => node.textContent ?? '')
    .filter((key) => key.endsWith(`/${minioMirrorFiles.MIRROR_MANIFEST_FILE_NAME}`));
}

function parseObjectList(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  return {
    keys: Array.from(document.querySelectorAll('Contents Key'))
      .map((node) => node.textContent ?? '')
      .filter(Boolean),
    nextContinuationToken:
      document.querySelector('NextContinuationToken')?.textContent?.trim() || undefined,
    truncated: document.querySelector('IsTruncated')?.textContent?.trim() === 'true',
  };
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

class MinioMirrorService implements MirrorService<MinioMirrorConfig> {
  private readonly requestFetch: typeof fetch;
  private readonly now: () => Date;
  private readonly storage: BrowserKeyValueStorage | undefined;

  constructor(options: MinioMirrorServiceOptions = {}) {
    this.requestFetch = options.fetch ?? getDefaultFetch();
    this.now = options.now ?? (() => new Date());
    this.storage = options.storage ?? browserStorage.getBrowserLocalStorage();
  }

  loadConfig(): MinioMirrorConfig | null {
    const config = browserStorage.readStorageJson<MinioMirrorConfig>(this.storage, CONFIG_STORAGE_KEY);
    return config ? normalizeMirrorConfig(config) : null;
  }

  saveConfig(config: MinioMirrorConfig): void {
    browserStorage.writeStorageJson(this.storage, CONFIG_STORAGE_KEY, config);
  }

  clearConfig(): void {
    this.storage?.removeItem?.(CONFIG_STORAGE_KEY);
  }

  async syncProject(
    project: ProjectDocument,
    repository: ProjectRepository,
    config: MinioMirrorConfig,
    options?: { onProgress?: (progress: MirrorSyncProgress) => void },
  ): Promise<MirrorState> {
    const files = await minioMirrorFiles.createMirrorFiles(project, repository, config, {
      fetch: this.requestFetch,
      now: this.now,
    });
    const projectKey = getProjectMirrorKey(project.name);
    const remoteManifest = await this.loadRemoteManifest(projectKey, config);
    const totalFiles = Math.max(files.length, 1);
    let completedFiles = 0;

    options?.onProgress?.({
      current: completedFiles,
      label: 'Checking mirror files',
      total: totalFiles,
    });

    for (const file of files) {
      options?.onProgress?.({
        current: completedFiles,
        label: `Mirroring ${file.path}`,
        total: totalFiles,
      });
      const nextChecksum = await minioObjectUtils.sha256Hex(file.blob);
      if (remoteManifest?.files[file.path]?.checksum !== nextChecksum) {
        await this.putObject(getProjectFileKey(config, projectKey, file.path), file.blob, config);
      }
      completedFiles += 1;
      options?.onProgress?.({
        current: completedFiles,
        label: `Mirrored ${file.path}`,
        total: totalFiles,
      });
    }

    return {
      enabled: true,
      status: 'synced',
      lastSyncedAt: this.now().toISOString(),
    };
  }

  async listProjects(config: MinioMirrorConfig): Promise<MirrorProjectSummary[]> {
    const url = minioObjectUtils.createObjectUrl(config, '', {
      'list-type': '2',
      'max-keys': '1000',
      prefix: storageObjectUtils.normalizeObjectKeyPart(config.prefix)
        ? `${storageObjectUtils.normalizeObjectKeyPart(config.prefix)}/`
        : '',
    });
    const response = await this.signedFetch(url, 'GET', config, getReaderCredentials(config));
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error(
          'Reader credentials cannot list the bucket or prefix (403). Grant read-only ListBucket on the bucket for Test/Import Remote, and GetObject on mirrored objects for public deck loading. Also verify the reader secret and region.',
        );
      }
      throw new Error(`Could not list MinIO mirrors (${response.status}).`);
    }
    const manifestKeys = parseMirrorProjects(await response.text());
    const manifests = await Promise.all(
      manifestKeys.map(async (key) => {
        const response = await this.signedFetch(
          minioObjectUtils.createObjectUrl(config, key),
          'GET',
          config,
          getReaderCredentials(config),
        );
        if (!response.ok) return undefined;
        const manifest = (await response.json()) as MirrorManifest;
        const keyParts = key.split('/');
        return {
          id: keyParts.at(-2) ?? manifest.projectName,
          name: manifest.projectName,
          syncedAt: manifest.syncedAt,
        };
      }),
    );
    return manifests.filter((item): item is MirrorProjectSummary => Boolean(item));
  }

  async downloadProject(projectKey: string, config: MinioMirrorConfig): Promise<MirrorFile[]> {
    const manifestResponse = await this.signedFetch(
      minioObjectUtils.createObjectUrl(
        config,
        getProjectFileKey(config, projectKey, minioMirrorFiles.MIRROR_MANIFEST_FILE_NAME),
      ),
      'GET',
      config,
      getReaderCredentials(config),
    );
    if (!manifestResponse.ok)
      throw new Error(`Could not download MinIO mirror manifest (${manifestResponse.status}).`);
    const manifest = (await manifestResponse.json()) as MirrorManifest;
    const files = await Promise.all(
      Object.keys(manifest.files).map(async (path) => {
        const response = await this.signedFetch(
          minioObjectUtils.createObjectUrl(config, getProjectFileKey(config, projectKey, path)),
          'GET',
          config,
          getReaderCredentials(config),
        );
        if (!response.ok)
          throw new Error(`Could not download mirrored file ${path} (${response.status}).`);
        return { path, blob: await response.blob() };
      }),
    );
    files.push({
      path: minioMirrorFiles.MIRROR_MANIFEST_FILE_NAME,
      blob: storageObjectUtils.jsonBlob(manifest),
    });
    return files;
  }

  async deleteProject(projectKey: string, config: MinioMirrorConfig): Promise<void> {
    const projectPrefix = `${getProjectRoot(config, projectKey)}/`;
    let continuationToken: string | undefined;
    do {
      const url = minioObjectUtils.createObjectUrl(config, '', {
        ...(continuationToken ? { 'continuation-token': continuationToken } : {}),
        'list-type': '2',
        'max-keys': '1000',
        prefix: projectPrefix,
      });
      const listResponse = await this.signedFetch(url, 'GET', config, getWriterCredentials(config));
      if (!listResponse.ok)
        throw new Error(`Could not list MinIO mirror objects (${listResponse.status}).`);

      const objectList = parseObjectList(await listResponse.text());
      for (const batch of chunkArray(objectList.keys, DELETE_BATCH_SIZE)) {
        await Promise.all(
          batch.map(async (key) => {
            const response = await this.signedFetch(
              minioObjectUtils.createObjectUrl(config, key),
              'DELETE',
              config,
              getWriterCredentials(config),
            );
            if (!response.ok)
              throw new Error(`Could not delete mirrored object ${key} (${response.status}).`);
          }),
        );
      }
      continuationToken = objectList.truncated ? objectList.nextContinuationToken : undefined;
    } while (continuationToken);
  }

  getPublicObjectUrl(key: string, config: MinioMirrorConfig): string {
    return minioObjectUtils.createPublicObjectUrl(config, key);
  }

  async uploadPublicObject(key: string, blob: Blob, config: MinioMirrorConfig): Promise<void> {
    await this.putObject(key, blob, config);
  }

  private async loadRemoteManifest(projectKey: string, config: MinioMirrorConfig) {
    const response = await this.signedFetch(
      minioObjectUtils.createObjectUrl(
        config,
        getProjectFileKey(config, projectKey, minioMirrorFiles.MIRROR_MANIFEST_FILE_NAME),
      ),
      'GET',
      config,
      getWriterCredentials(config),
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Could not read MinIO mirror manifest (${response.status}).`);
    return (await response.json()) as MirrorManifest;
  }

  private async putObject(key: string, blob: Blob, config: MinioMirrorConfig) {
    const response = await this.signedFetch(
      minioObjectUtils.createObjectUrl(config, key),
      'PUT',
      config,
      getWriterCredentials(config),
      blob,
      blob.type,
    );
    if (!response.ok) throw new Error(`Could not upload ${key} to MinIO (${response.status}).`);
  }

  private async signedFetch(
    url: URL,
    method: string,
    config: MinioMirrorConfig,
    credentials: MinioMirrorCredentials,
    body?: Blob,
    contentType?: string,
  ) {
    const init: RequestInit = {
      headers: await minioObjectUtils.createSignedHeaders(
        config,
        method,
        url,
        credentials,
        contentType,
      ),
      method,
    };
    if (body) init.body = body;
    return this.requestFetch(url, init);
  }
}

export const minioMirrorService = {
  createMirrorFiles: minioMirrorFiles.createMirrorFiles,
  DEFAULT_MINIO_MIRROR_CONFIG,
  MinioMirrorService,
};
