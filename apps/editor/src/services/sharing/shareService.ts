import { publicBasePath } from '../../app/routing/publicBasePath';
import { collectReferencedAssetIds } from '../../domain/assets/assetUsage';
import type { ProjectDocument } from '../../domain/documents/model';
import type { ShareMetadata, ShareRecord, ShareService } from '../contracts/interfaces';
import { minioMirrorService } from '../mirror/minioMirrorService';
import type { MinioMirrorConfig } from '../mirror/minioMirrorService';
import { assetFileUtils } from '../storage/assetFileUtils';
import { storageObjectUtils } from '../storage/storageObjectUtils';

const PUBLIC_STORAGE_UNAVAILABLE_MESSAGE = 'Public sharing requires active external storage.';
const SHARE_FILE_NAME = 'share.json';

interface BrowserShareServiceOptions {
  basePath?: string;
  fetch?: typeof fetch;
  mirrorService?: InstanceType<typeof minioMirrorService.MinioMirrorService>;
  origin?: string;
}

interface PublicSharePayload extends ShareRecord {
  schemaVersion: 1;
}

function getDefaultOrigin() {
  if (typeof window === 'undefined') return 'http://localhost';
  return window.location.origin;
}

function getDefaultFetch() {
  if (typeof fetch === 'undefined') return undefined;
  return fetch.bind(globalThis);
}

function createShareId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `share-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneProject(project: ProjectDocument): ProjectDocument {
  return JSON.parse(JSON.stringify(project)) as ProjectDocument;
}

function getShareRootKey(config: MinioMirrorConfig, shareId: string) {
  return storageObjectUtils.joinObjectKey(storageObjectUtils.normalizeObjectKeyPart(config.prefix), 'public-shares', shareId);
}

function getShareFileKey(config: MinioMirrorConfig, shareId: string) {
  return storageObjectUtils.joinObjectKey(getShareRootKey(config, shareId), SHARE_FILE_NAME);
}

function publicViewerUrl(origin: string, basePath: string, route: 'share' | 'embed', shareId: string, shareUrl: string) {
  const url = new URL(`${origin}${basePath}`);
  url.searchParams.set(route, shareId);
  if (shareUrl) url.searchParams.set('src', shareUrl);
  return url.toString();
}

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export class BrowserShareService implements ShareService {
  private readonly basePath: string;
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly mirrorService: InstanceType<typeof minioMirrorService.MinioMirrorService>;
  private readonly origin: string;

  constructor(options: BrowserShareServiceOptions = {}) {
    this.basePath = publicBasePath.normalizeBasePath(options.basePath ?? publicBasePath.getPublicBasePath());
    this.fetchImpl = options.fetch ?? getDefaultFetch();
    this.mirrorService = options.mirrorService ?? new minioMirrorService.MinioMirrorService();
    this.origin = options.origin ?? getDefaultOrigin();
  }

  async createShare(project: ProjectDocument): Promise<ShareMetadata> {
    return this.publishShare(createShareId(), project);
  }

  async updateShare(shareId: string, project: ProjectDocument): Promise<ShareMetadata> {
    return this.publishShare(shareId, project);
  }

  async getShare(shareId: string): Promise<ShareRecord | null> {
    const sourceUrl = this.getShareSourceUrl();
    if (!sourceUrl) return null;

    try {
      const response = await (this.fetchImpl ?? getDefaultFetch())?.(sourceUrl, {
        headers: { accept: 'application/json' },
      });
      if (!response?.ok) return null;
      const payload = (await response.json()) as Partial<PublicSharePayload>;
      if (payload.shareId !== shareId || !payload.project) return null;
      return {
        shareId,
        createdAt: payload.createdAt ?? new Date().toISOString(),
        updatedAt: payload.updatedAt ?? payload.createdAt ?? new Date().toISOString(),
        project: cloneProject(payload.project),
      };
    } catch {
      return null;
    }
  }

  getPublicUrl(shareId: string): string {
    const config = this.mirrorService.loadConfig();
    if (!config) return publicViewerUrl(this.origin, this.basePath, 'share', shareId, '');
    const shareUrl = this.mirrorService.getPublicObjectUrl(getShareFileKey(config, shareId), config);
    return publicViewerUrl(this.origin, this.basePath, 'share', shareId, shareUrl);
  }

  getEmbedUrl(shareId: string): string {
    const config = this.mirrorService.loadConfig();
    if (!config) return publicViewerUrl(this.origin, this.basePath, 'embed', shareId, '');
    const shareUrl = this.mirrorService.getPublicObjectUrl(getShareFileKey(config, shareId), config);
    return publicViewerUrl(this.origin, this.basePath, 'embed', shareId, shareUrl);
  }

  getEmbedHtml(shareId: string): string {
    return `<iframe src="${escapeHtmlAttribute(this.getEmbedUrl(shareId))}" width="960" height="540" style="border:0;aspect-ratio:16/9;width:100%;max-width:960px;" allowfullscreen></iframe>`;
  }

  private getShareSourceUrl() {
    if (typeof window === 'undefined') return undefined;
    return new URL(window.location.href).searchParams.get('src') ?? undefined;
  }

  private async publishShare(shareId: string, project: ProjectDocument): Promise<ShareMetadata> {
    const config = this.mirrorService.loadConfig();
    if (!config) throw new Error(PUBLIC_STORAGE_UNAVAILABLE_MESSAGE);

    const now = new Date().toISOString();
    const projectForShare = await this.createPublicProject(project, config, shareId);
    const payload: PublicSharePayload = {
      schemaVersion: 1,
      shareId,
      createdAt: now,
      updatedAt: now,
      project: projectForShare,
    };
    await this.mirrorService.uploadPublicObject(getShareFileKey(config, shareId), storageObjectUtils.jsonBlob(payload), config);
    return this.toMetadata(payload, 'published');
  }

  private async createPublicProject(
    project: ProjectDocument,
    config: MinioMirrorConfig,
    shareId: string,
  ): Promise<ProjectDocument> {
    const projectForShare = cloneProject(project);
    const referencedAssetIds = collectReferencedAssetIds(projectForShare);

    await Promise.all(
      Object.entries(projectForShare.assets).map(async ([assetId, asset]) => {
        if (!referencedAssetIds.has(assetId)) return;
        const blob = await assetFileUtils.objectUrlToBlobIfReadable(asset.objectUrl, this.fetchImpl);
        if (!blob) return;

        const fileName = asset.fileName ?? `${asset.id}.${assetFileUtils.getAssetFileExtension(asset.mimeType)}`;
        const key = storageObjectUtils.joinObjectKey(getShareRootKey(config, shareId), 'assets', fileName);
        await this.mirrorService.uploadPublicObject(key, blob, config);
        projectForShare.assets[assetId] = {
          ...asset,
          objectUrl: this.mirrorService.getPublicObjectUrl(key, config),
          storage: 'remote',
          fileName,
        };
      }),
    );

    await Promise.all(
      Object.entries(projectForShare.fonts ?? {}).map(async ([fontId, font]) => {
        const blob = await assetFileUtils.objectUrlToBlobIfReadable(font.objectUrl, this.fetchImpl);
        if (!blob) return;

        const key = storageObjectUtils.joinObjectKey(getShareRootKey(config, shareId), 'fonts', font.fileName);
        await this.mirrorService.uploadPublicObject(key, blob, config);
        projectForShare.fonts![fontId] = {
          ...font,
          objectUrl: this.mirrorService.getPublicObjectUrl(key, config),
          storage: 'remote',
        };
      }),
    );

    return projectForShare;
  }

  private toMetadata(record: ShareRecord, status: ShareMetadata['status']): ShareMetadata {
    return {
      shareId: record.shareId,
      publicUrl: this.getPublicUrl(record.shareId),
      embedUrl: this.getEmbedUrl(record.shareId),
      embedHtml: this.getEmbedHtml(record.shareId),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      status,
    };
  }
}
