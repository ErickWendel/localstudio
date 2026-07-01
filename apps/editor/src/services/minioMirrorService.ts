import type {
  MirrorFile,
  MirrorProjectSummary,
  MirrorService,
  MirrorState,
  ProjectRepository,
} from './interfaces';
import type { Asset, ProjectDocument } from '../domain/model';

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
}

interface MirrorManifestFile {
  path: string;
  size: number;
  checksum: string;
}

export interface MirrorManifest {
  schemaVersion: 1;
  projectId: string;
  projectName: string;
  syncedAt: string;
  publicBaseUrl?: string;
  files: Record<string, MirrorManifestFile>;
}

const CONFIG_STORAGE_KEY = 'localstudio.minioMirror.config';
const MIRROR_MANIFEST_FILE_NAME = 'localstudio-mirror.json';
const PROJECT_FILE_NAME = 'project.json';

export const DEFAULT_MINIO_MIRROR_CONFIG: MinioMirrorConfig = {
  accessKey: 'localstudio',
  bucket: 'localstudio',
  endpoint: 'http://localhost:9000',
  pathStyle: true,
  publicBaseUrl: 'http://localhost:9000/localstudio',
  region: 'us-east-1',
  secretKey: 'localstudio123',
  prefix: 'mirrors',
};

function normalizePrefix(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

function joinKey(...parts: string[]) {
  return parts
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

function getProjectMirrorKey(projectName: string) {
  return projectName.trim().replace(/[\\/]+/g, '-');
}

function encodeKeyPath(key: string) {
  return key.split('/').map(encodeURIComponent).join('/');
}

function textBlob(value: unknown) {
  return new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
}

function isDataUrl(value: string | undefined): value is string {
  return Boolean(value?.startsWith('data:'));
}

function isBlobUrl(value: string | undefined): value is string {
  return Boolean(value?.startsWith('blob:'));
}

function dataUrlToBlob(dataUrl: string) {
  const [metadata, base64 = ''] = dataUrl.split(',');
  const mimeType = metadata?.match(/^data:(.*?);base64$/)?.[1] ?? 'application/octet-stream';
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

function getDefaultFetch() {
  if (typeof window !== 'undefined') return window.fetch.bind(window);
  return globalThis.fetch.bind(globalThis);
}

function getAssetFileExtension(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'video/mp4') return 'mp4';
  if (mimeType === 'video/webm') return 'webm';
  if (mimeType === 'video/quicktime') return 'mov';
  return 'png';
}

function collectReferencedAssetIds(project: ProjectDocument) {
  const referencedAssetIds = new Set<string>();
  for (const element of Object.values(project.elements)) {
    if (element.type === 'image' || element.type === 'gif' || element.type === 'video') {
      referencedAssetIds.add(element.assetId);
    }
  }
  for (const page of project.pages) {
    if (page.background.type === 'asset') referencedAssetIds.add(page.background.assetId);
  }
  return referencedAssetIds;
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
  if (!asset.objectUrl) return undefined;
  if (isDataUrl(asset.objectUrl)) return dataUrlToBlob(asset.objectUrl);
  if (!isBlobUrl(asset.objectUrl)) return undefined;
  return requestFetch(asset.objectUrl).then((response) => response.blob());
}

async function sha256Hex(blob: Blob) {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
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

  files.push(await createFileEntry(PROJECT_FILE_NAME, textBlob(projectForMirror)));

  const versions = repository.getVersionHistory ? await repository.getVersionHistory() : [];
  files.push(
    await createFileEntry(
      'history/manifest.json',
      textBlob({
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
        textBlob(cloneProjectWithoutObjectUrls(versionProject)),
      ),
    );
  }

  files.push(
    await createFileEntry(
      'config/localstudio.json',
      textBlob({
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
  files.push(await createFileEntry(MIRROR_MANIFEST_FILE_NAME, textBlob(manifest)));

  return files;
}

function toArrayBuffer(value: ArrayBuffer | Uint8Array) {
  if (value instanceof ArrayBuffer) return value;
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, value: string) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value)),
  );
}

async function hmacHex(key: ArrayBuffer | Uint8Array, value: string) {
  return Array.from(await hmacSha256(key, value), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function getSigningKey(config: MinioMirrorConfig, dateStamp: string) {
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${config.secretKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, config.region);
  const kService = await hmacSha256(kRegion, 's3');
  return hmacSha256(kService, 'aws4_request');
}

function createObjectUrl(config: MinioMirrorConfig, key = '', query: Record<string, string> = {}) {
  const endpoint = new URL(config.endpoint);
  const encodedKey = encodeKeyPath(key);
  const url = config.pathStyle
    ? new URL(
        `${endpoint.origin}/${encodeURIComponent(config.bucket)}${encodedKey ? `/${encodedKey}` : ''}`,
      )
    : new URL(`${endpoint.protocol}//${config.bucket}.${endpoint.host}/${encodedKey}`);
  for (const [name, value] of Object.entries(query)) {
    url.searchParams.set(name, value);
  }
  return url;
}

function createPublicObjectUrl(config: MinioMirrorConfig, key: string) {
  const publicBaseUrl = config.publicBaseUrl.trim().replace(/\/+$/g, '');
  return `${publicBaseUrl}/${encodeKeyPath(key)}`;
}

async function createSignedHeaders(
  config: MinioMirrorConfig,
  method: string,
  url: URL,
  contentType?: string,
) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    host: url.host,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'x-amz-date': amzDate,
  };
  if (contentType) headers['content-type'] = contentType;

  const canonicalHeaders = Object.entries(headers)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}:${value.trim()}\n`)
    .join('');
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalQuery = Array.from(url.searchParams.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join('&');
  const canonicalRequest = [
    method,
    url.pathname,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(canonicalRequest))
      .then((hash) =>
        Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join(''),
      ),
  ].join('\n');
  const signature = await hmacHex(await getSigningKey(config, dateStamp), stringToSign);

  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function getProjectRoot(config: MinioMirrorConfig, projectKey: string) {
  return joinKey(normalizePrefix(config.prefix), projectKey);
}

function getProjectFileKey(config: MinioMirrorConfig, projectKey: string, path: string) {
  return joinKey(getProjectRoot(config, projectKey), path);
}

function parseMirrorProjects(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(document.querySelectorAll('Contents Key'))
    .map((node) => node.textContent ?? '')
    .filter((key) => key.endsWith(`/${MIRROR_MANIFEST_FILE_NAME}`));
}

export class MinioMirrorService implements MirrorService<MinioMirrorConfig> {
  private readonly requestFetch: typeof fetch;
  private readonly now: () => Date;

  constructor(options: MinioMirrorServiceOptions = {}) {
    this.requestFetch = options.fetch ?? getDefaultFetch();
    this.now = options.now ?? (() => new Date());
  }

  loadConfig(): MinioMirrorConfig | null {
    if (typeof window === 'undefined') return null;
    const rawConfig = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    return rawConfig ? (JSON.parse(rawConfig) as MinioMirrorConfig) : null;
  }

  saveConfig(config: MinioMirrorConfig): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  }

  clearConfig(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(CONFIG_STORAGE_KEY);
  }

  async syncProject(
    project: ProjectDocument,
    repository: ProjectRepository,
    config: MinioMirrorConfig,
  ): Promise<MirrorState> {
    const files = await createMirrorFiles(project, repository, config, {
      fetch: this.requestFetch,
      now: this.now,
    });
    const projectKey = getProjectMirrorKey(project.name);
    const remoteManifest = await this.loadRemoteManifest(projectKey, config);

    for (const file of files) {
      const nextChecksum = await sha256Hex(file.blob);
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
    const url = createObjectUrl(config, '', {
      'list-type': '2',
      'max-keys': '1000',
      prefix: normalizePrefix(config.prefix) ? `${normalizePrefix(config.prefix)}/` : '',
    });
    const response = await this.signedFetch(url, 'GET', config);
    if (!response.ok) throw new Error(`Could not list MinIO mirrors (${response.status}).`);
    const manifestKeys = parseMirrorProjects(await response.text());
    const manifests = await Promise.all(
      manifestKeys.map(async (key) => {
        const response = await this.signedFetch(createObjectUrl(config, key), 'GET', config);
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
      createObjectUrl(config, getProjectFileKey(config, projectKey, MIRROR_MANIFEST_FILE_NAME)),
      'GET',
      config,
    );
    if (!manifestResponse.ok)
      throw new Error(`Could not download MinIO mirror manifest (${manifestResponse.status}).`);
    const manifest = (await manifestResponse.json()) as MirrorManifest;
    const files = await Promise.all(
      Object.keys(manifest.files).map(async (path) => {
        const response = await this.signedFetch(
          createObjectUrl(config, getProjectFileKey(config, projectKey, path)),
          'GET',
          config,
        );
        if (!response.ok)
          throw new Error(`Could not download mirrored file ${path} (${response.status}).`);
        return { path, blob: await response.blob() };
      }),
    );
    files.push({ path: MIRROR_MANIFEST_FILE_NAME, blob: textBlob(manifest) });
    return files;
  }

  getPublicObjectUrl(key: string, config: MinioMirrorConfig): string {
    return createPublicObjectUrl(config, key);
  }

  async uploadPublicObject(key: string, blob: Blob, config: MinioMirrorConfig): Promise<void> {
    await this.putObject(key, blob, config);
  }

  private async loadRemoteManifest(projectKey: string, config: MinioMirrorConfig) {
    const response = await this.signedFetch(
      createObjectUrl(config, getProjectFileKey(config, projectKey, MIRROR_MANIFEST_FILE_NAME)),
      'GET',
      config,
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Could not read MinIO mirror manifest (${response.status}).`);
    return (await response.json()) as MirrorManifest;
  }

  private async putObject(key: string, blob: Blob, config: MinioMirrorConfig) {
    const response = await this.signedFetch(
      createObjectUrl(config, key),
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
      headers: await createSignedHeaders(config, method, url, contentType),
      method,
    };
    if (body) init.body = body;
    return this.requestFetch(url, init);
  }
}
