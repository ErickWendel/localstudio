import type {
  MirrorFile,
  MirrorProjectSummary,
  MirrorService,
  MirrorState,
  ProjectRepository,
} from '../interfaces';
import type { ProjectDocument } from '../../domain/model';
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
  accessKey: string;
  secretKey: string;
  pathStyle: boolean;
  publicBaseUrl: string;
  prefix: string;
}

interface MinioMirrorServiceOptions {
  fetch?: typeof fetch;
  now?: () => Date;
  storage?: BrowserKeyValueStorage;
}

const CONFIG_STORAGE_KEY = 'localstudio.minioMirror.config';

const DEFAULT_MINIO_MIRROR_CONFIG: MinioMirrorConfig = {
  accessKey: 'localstudio',
  bucket: 'localstudio',
  endpoint: 'http://localhost:9000',
  pathStyle: true,
  publicBaseUrl: 'http://localhost:9000/localstudio',
  region: 'us-east-1',
  secretKey: 'localstudio123',
  prefix: 'mirrors',
};

function getProjectMirrorKey(projectName: string) {
  return projectName.trim().replace(/[\\/]+/g, '-');
}

function getDefaultFetch() {
  if (typeof window !== 'undefined') return window.fetch.bind(window);
  return globalThis.fetch.bind(globalThis);
}

function getProjectRoot(config: MinioMirrorConfig, projectKey: string) {
  return storageObjectUtils.joinObjectKey(storageObjectUtils.normalizeObjectKeyPart(config.prefix), projectKey);
}

function getProjectFileKey(config: MinioMirrorConfig, projectKey: string, path: string) {
  return storageObjectUtils.joinObjectKey(getProjectRoot(config, projectKey), path);
}

function parseMirrorProjects(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(document.querySelectorAll('Contents Key'))
    .map((node) => node.textContent ?? '')
    .filter((key) => key.endsWith(`/${minioMirrorFiles.MIRROR_MANIFEST_FILE_NAME}`));
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
    return browserStorage.readStorageJson<MinioMirrorConfig>(this.storage, CONFIG_STORAGE_KEY);
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
  ): Promise<MirrorState> {
    const files = await minioMirrorFiles.createMirrorFiles(project, repository, config, {
      fetch: this.requestFetch,
      now: this.now,
    });
    const projectKey = getProjectMirrorKey(project.name);
    const remoteManifest = await this.loadRemoteManifest(projectKey, config);

    for (const file of files) {
      const nextChecksum = await minioObjectUtils.sha256Hex(file.blob);
      if (remoteManifest?.files[file.path]?.checksum === nextChecksum) continue;
      await this.putObject(getProjectFileKey(config, projectKey, file.path), file.blob, config);
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
      prefix: storageObjectUtils.normalizeObjectKeyPart(config.prefix) ? `${storageObjectUtils.normalizeObjectKeyPart(config.prefix)}/` : '',
    });
    const response = await this.signedFetch(url, 'GET', config);
    if (!response.ok) throw new Error(`Could not list MinIO mirrors (${response.status}).`);
    const manifestKeys = parseMirrorProjects(await response.text());
    const manifests = await Promise.all(
      manifestKeys.map(async (key) => {
        const response = await this.signedFetch(minioObjectUtils.createObjectUrl(config, key), 'GET', config);
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
      minioObjectUtils.createObjectUrl(config, getProjectFileKey(config, projectKey, minioMirrorFiles.MIRROR_MANIFEST_FILE_NAME)),
      'GET',
      config,
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
        );
        if (!response.ok)
          throw new Error(`Could not download mirrored file ${path} (${response.status}).`);
        return { path, blob: await response.blob() };
      }),
    );
    files.push({ path: minioMirrorFiles.MIRROR_MANIFEST_FILE_NAME, blob: storageObjectUtils.jsonBlob(manifest) });
    return files;
  }

  getPublicObjectUrl(key: string, config: MinioMirrorConfig): string {
    return minioObjectUtils.createPublicObjectUrl(config, key);
  }

  async uploadPublicObject(key: string, blob: Blob, config: MinioMirrorConfig): Promise<void> {
    await this.putObject(key, blob, config);
  }

  private async loadRemoteManifest(projectKey: string, config: MinioMirrorConfig) {
    const response = await this.signedFetch(
      minioObjectUtils.createObjectUrl(config, getProjectFileKey(config, projectKey, minioMirrorFiles.MIRROR_MANIFEST_FILE_NAME)),
      'GET',
      config,
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
      blob,
      blob.type,
    );
    if (!response.ok) throw new Error(`Could not upload ${key} to MinIO (${response.status}).`);
  }

  private async signedFetch(
    url: URL,
    method: string,
    config: MinioMirrorConfig,
    body?: Blob,
    contentType?: string,
  ) {
    const init: RequestInit = {
      headers: await minioObjectUtils.createSignedHeaders(config, method, url, contentType),
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
