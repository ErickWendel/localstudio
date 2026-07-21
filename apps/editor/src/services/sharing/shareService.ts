import { publicBasePath } from '../../app/routing/publicBasePath';
import { collectReferencedAssetIds } from '../../domain/assets/assetUsage';
import type { ProjectDocument } from '../../domain/documents/model';
import type {
  ShareMetadata,
  SharePublishOptions,
  ShareRecord,
  ShareService,
} from '../contracts/interfaces';
import { minioMirrorService } from '../mirror/minioMirrorService';
import type { MinioMirrorConfig } from '../mirror/minioMirrorService';
import { assetFileUtils } from '../storage/assetFileUtils';
import { storageObjectUtils } from '../storage/storageObjectUtils';

const PUBLIC_STORAGE_UNAVAILABLE_MESSAGE = 'Public sharing requires active external storage.';
const SHARE_POINTER_FILE_EXTENSION = 'json';

interface BrowserShareServiceOptions {
  basePath?: string;
  fetch?: typeof fetch;
  mirrorService?: InstanceType<typeof minioMirrorService.MinioMirrorService>;
  origin?: string;
}

interface PublicSharePayload extends ShareRecord {
  schemaVersion: 1;
}

interface ShareProgressReporter {
  active(label: string): void;
  complete(label: string): void;
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

function getProjectShareId(project: ProjectDocument) {
  const normalizedProjectId = project.id.trim().replace(/[^a-zA-Z0-9_-]+/g, '-');
  if (!normalizedProjectId) return createShareId();
  return `project-${normalizedProjectId}`;
}

function getProjectMirrorKey(projectName: string) {
  return projectName.trim().replace(/[\\/]+/g, '-');
}

function cloneProject(project: ProjectDocument): ProjectDocument {
  return JSON.parse(JSON.stringify(project)) as ProjectDocument;
}

function getMirrorFileKey(config: MinioMirrorConfig, projectName: string, path: string) {
  return storageObjectUtils.joinObjectKey(
    storageObjectUtils.normalizeObjectKeyPart(config.prefix),
    getProjectMirrorKey(projectName),
    path,
  );
}

function getSharePointerFileKey(config: MinioMirrorConfig, shareId: string) {
  return storageObjectUtils.joinObjectKey(
    storageObjectUtils.normalizeObjectKeyPart(config.prefix),
    'shares',
    `${shareId}.${SHARE_POINTER_FILE_EXTENSION}`,
  );
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

function createShareProgressReporter(total: number, options?: SharePublishOptions): ShareProgressReporter {
  let current = 0;
  const safeTotal = Math.max(1, total);

  function emit(label: string) {
    options?.onProgress?.({ current, total: safeTotal, label });
  }

  return {
    active: emit,
    complete(label: string) {
      current = Math.min(safeTotal, current + 1);
      emit(label);
    },
  };
}

function shouldUseMirroredObjectUrl(storage: 'inline' | 'file' | 'remote' | undefined, objectUrl: string | undefined) {
  if (storage === 'remote') return false;
  return storage === 'file' || assetFileUtils.isReadableObjectUrl(objectUrl);
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

  async createShare(project: ProjectDocument, options?: SharePublishOptions): Promise<ShareMetadata> {
    return this.publishShare(getProjectShareId(project), project, options);
  }

  async updateShare(
    shareId: string,
    project: ProjectDocument,
    options?: SharePublishOptions,
  ): Promise<ShareMetadata> {
    return this.publishShare(shareId, project, options);
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
    const shareUrl = this.mirrorService.getPublicObjectUrl(getSharePointerFileKey(config, shareId), config);
    return publicViewerUrl(this.origin, this.basePath, 'share', shareId, shareUrl);
  }

  getEmbedUrl(shareId: string): string {
    const config = this.mirrorService.loadConfig();
    if (!config) return publicViewerUrl(this.origin, this.basePath, 'embed', shareId, '');
    const shareUrl = this.mirrorService.getPublicObjectUrl(getSharePointerFileKey(config, shareId), config);
    return publicViewerUrl(this.origin, this.basePath, 'embed', shareId, shareUrl);
  }

  getEmbedHtml(shareId: string): string {
    return `<iframe src="${escapeHtmlAttribute(this.getEmbedUrl(shareId))}" width="960" height="540" style="border:0;aspect-ratio:16/9;width:100%;max-width:960px;" allowfullscreen></iframe>`;
  }

  getProjectShareMetadata(project: ProjectDocument): ShareMetadata {
    return this.toMetadata(
      {
        shareId: getProjectShareId(project),
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        project,
      },
      'published',
    );
  }

  private getShareSourceUrl() {
    if (typeof window === 'undefined') return undefined;
    return new URL(window.location.href).searchParams.get('src') ?? undefined;
  }

  private async publishShare(
    shareId: string,
    project: ProjectDocument,
    options?: SharePublishOptions,
  ): Promise<ShareMetadata> {
    const config = this.mirrorService.loadConfig();
    if (!config) throw new Error(PUBLIC_STORAGE_UNAVAILABLE_MESSAGE);

    const now = new Date().toISOString();
    const progress = createShareProgressReporter(1, options);
    progress.active('Preparing public share');
    const projectForShare = this.createPublicProject(project, config);
    const payload: PublicSharePayload = {
      schemaVersion: 1,
      shareId,
      createdAt: now,
      updatedAt: now,
      project: projectForShare,
    };
    progress.active('Publishing share link');
    await this.mirrorService.uploadPublicObject(getSharePointerFileKey(config, shareId), storageObjectUtils.jsonBlob(payload), config);
    progress.complete('Published share link');
    return this.toMetadata(payload, 'published');
  }

  private createPublicProject(
    project: ProjectDocument,
    config: MinioMirrorConfig,
  ): ProjectDocument {
    const projectForShare = cloneProject(project);
    const referencedAssetIds = collectReferencedAssetIds(projectForShare);

    for (const [assetId, asset] of Object.entries(projectForShare.assets)) {
      if (!referencedAssetIds.has(assetId)) continue;
      const fileName = asset.fileName ?? `${asset.id}.${assetFileUtils.getAssetFileExtension(asset.mimeType)}`;
      if (shouldUseMirroredObjectUrl(asset.storage, asset.objectUrl)) {
        const key = getMirrorFileKey(config, project.name, `assets/${fileName}`);
        projectForShare.assets[assetId] = {
          ...asset,
          objectUrl: this.mirrorService.getPublicObjectUrl(key, config),
          storage: 'remote',
          fileName,
        };
      }
    }

    for (const [fontId, font] of Object.entries(projectForShare.fonts ?? {})) {
      if (shouldUseMirroredObjectUrl(font.storage, font.objectUrl)) {
        const key = getMirrorFileKey(config, project.name, `fonts/${font.fileName}`);
        projectForShare.fonts![fontId] = {
          ...font,
          objectUrl: this.mirrorService.getPublicObjectUrl(key, config),
          storage: 'remote',
        };
      }
    }

    for (const [recordingId, recording] of Object.entries(projectForShare.recordings ?? {})) {
      const fileName =
        recording.audio.fileName ??
        `${recording.id}.${assetFileUtils.getAssetFileExtension(recording.audio.mimeType)}`;
      if (shouldUseMirroredObjectUrl(recording.audio.storage, recording.audio.objectUrl)) {
        const key = getMirrorFileKey(config, project.name, `recordings/${fileName}`);
        projectForShare.recordings![recordingId] = {
          ...recording,
          audio: {
            ...recording.audio,
            fileName,
            objectUrl: this.mirrorService.getPublicObjectUrl(key, config),
            storage: 'remote',
          },
        };
      }
    }

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
