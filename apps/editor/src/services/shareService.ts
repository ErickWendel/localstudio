import { getPublicBasePath, normalizeBasePath } from '../app/publicBasePath';
import type { Asset, ProjectDocument } from '../domain/model';
import type { ShareMetadata, ShareRecord, ShareService } from './interfaces';
import {
  MinioMirrorService,
  type MinioMirrorConfig,
} from './minioMirrorService';

const PUBLIC_STORAGE_UNAVAILABLE_MESSAGE = 'Public sharing requires active external storage.';
const SHARE_FILE_NAME = 'share.json';

interface BrowserShareServiceOptions {
  basePath?: string;
  fetch?: typeof fetch;
  mirrorService?: MinioMirrorService;
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

function normalizePrefix(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

function joinKey(...parts: string[]) {
  return parts
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

function getShareRootKey(config: MinioMirrorConfig, shareId: string) {
  return joinKey(normalizePrefix(config.prefix), 'public-shares', shareId);
}

function getShareFileKey(config: MinioMirrorConfig, shareId: string) {
  return joinKey(getShareRootKey(config, shareId), SHARE_FILE_NAME);
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

function textBlob(value: unknown) {
  return new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
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

async function assetToBlob(asset: Asset, requestFetch: typeof fetch | undefined) {
  if (!asset.objectUrl) return undefined;
  if (isDataUrl(asset.objectUrl)) return dataUrlToBlob(asset.objectUrl);
  if (!isBlobUrl(asset.objectUrl)) return undefined;
  if (!requestFetch) return undefined;
  return requestFetch(asset.objectUrl).then((response) => response.blob());
}

function publicViewerUrl(origin: string, basePath: string, route: 's' | 'embed', shareId: string, shareUrl: string) {
  const url = new URL(`${origin}${basePath}${route}/${encodeURIComponent(shareId)}`);
  url.searchParams.set('src', shareUrl);
  return url.toString();
}

export class BrowserShareService implements ShareService {
  private readonly basePath: string;
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly mirrorService: MinioMirrorService;
  private readonly origin: string;

  constructor(options: BrowserShareServiceOptions = {}) {
    this.basePath = normalizeBasePath(options.basePath ?? getPublicBasePath());
    this.fetchImpl = options.fetch ?? getDefaultFetch();
    this.mirrorService = options.mirrorService ?? new MinioMirrorService();
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
    if (!config) return `${this.origin}${this.basePath}s/${shareId}`;
    const shareUrl = this.mirrorService.getPublicObjectUrl(getShareFileKey(config, shareId), config);
    return publicViewerUrl(this.origin, this.basePath, 's', shareId, shareUrl);
  }

  getEmbedUrl(shareId: string): string {
    const config = this.mirrorService.loadConfig();
    if (!config) return `${this.origin}${this.basePath}embed/${shareId}`;
    const shareUrl = this.mirrorService.getPublicObjectUrl(getShareFileKey(config, shareId), config);
    return publicViewerUrl(this.origin, this.basePath, 'embed', shareId, shareUrl);
  }

  getEmbedHtml(shareId: string): string {
    return `<iframe src="${this.getEmbedUrl(shareId)}" width="960" height="540" style="border:0;aspect-ratio:16/9;width:100%;max-width:960px;" allowfullscreen></iframe>`;
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
    await this.mirrorService.uploadPublicObject(getShareFileKey(config, shareId), textBlob(payload), config);
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
        const blob = await assetToBlob(asset, this.fetchImpl);
        if (!blob) return;

        const fileName = asset.fileName ?? `${asset.id}.${getAssetFileExtension(asset.mimeType)}`;
        const key = joinKey(getShareRootKey(config, shareId), 'assets', fileName);
        await this.mirrorService.uploadPublicObject(key, blob, config);
        projectForShare.assets[assetId] = {
          ...asset,
          objectUrl: this.mirrorService.getPublicObjectUrl(key, config),
          storage: 'remote',
          fileName,
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
