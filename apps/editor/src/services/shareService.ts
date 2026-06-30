import type { ProjectDocument } from '../domain/model';
import type { ShareMetadata, ShareRecord, ShareService } from './interfaces';

const SHARE_STORAGE_KEY = 'localstudio.ai.public-shares.v1';

interface ShareStore {
  records: Record<string, ShareRecord>;
}

interface BrowserShareServiceOptions {
  origin?: string;
  storage?: Storage;
}

function getDefaultOrigin() {
  if (typeof window === 'undefined') return 'http://localhost';
  return window.location.origin;
}

function getDefaultStorage() {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}

function createShareId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `share-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStore(storage: Storage | undefined): ShareStore {
  if (!storage) return { records: {} };

  const rawStore = storage.getItem(SHARE_STORAGE_KEY);
  if (!rawStore) return { records: {} };

  try {
    const parsedStore = JSON.parse(rawStore) as Partial<ShareStore>;
    return { records: parsedStore.records ?? {} };
  } catch {
    return { records: {} };
  }
}

function writeStore(storage: Storage | undefined, store: ShareStore) {
  storage?.setItem(SHARE_STORAGE_KEY, JSON.stringify(store));
}

function cloneProject(project: ProjectDocument): ProjectDocument {
  return JSON.parse(JSON.stringify(project)) as ProjectDocument;
}

function nextUpdatedAt(currentUpdatedAt: string) {
  const now = Date.now();
  const current = Date.parse(currentUpdatedAt);
  return new Date(Number.isFinite(current) && now <= current ? current + 1 : now).toISOString();
}

export class BrowserShareService implements ShareService {
  private readonly origin: string;
  private readonly storage: Storage | undefined;

  constructor(options: BrowserShareServiceOptions = {}) {
    this.origin = options.origin ?? getDefaultOrigin();
    this.storage = options.storage ?? getDefaultStorage();
  }

  createShare(project: ProjectDocument): Promise<ShareMetadata> {
    const now = new Date().toISOString();
    const shareId = createShareId();
    const record: ShareRecord = {
      shareId,
      createdAt: now,
      updatedAt: now,
      project: cloneProject(project),
    };
    const store = readStore(this.storage);
    store.records[shareId] = record;
    writeStore(this.storage, store);
    return Promise.resolve(this.toMetadata(record, 'published'));
  }

  updateShare(shareId: string, project: ProjectDocument): Promise<ShareMetadata> {
    const store = readStore(this.storage);
    const existingRecord = store.records[shareId];
    if (!existingRecord) return Promise.reject(new Error(`Share ${shareId} was not found.`));

    const record: ShareRecord = {
      ...existingRecord,
      updatedAt: nextUpdatedAt(existingRecord.updatedAt),
      project: cloneProject(project),
    };
    store.records[shareId] = record;
    writeStore(this.storage, store);
    return Promise.resolve(this.toMetadata(record, 'published'));
  }

  getShare(shareId: string): Promise<ShareRecord | null> {
    const store = readStore(this.storage);
    return Promise.resolve(store.records[shareId] ?? null);
  }

  getPublicUrl(shareId: string): string {
    return `${this.origin}/s/${shareId}`;
  }

  getEmbedUrl(shareId: string): string {
    return `${this.origin}/embed/${shareId}`;
  }

  getEmbedHtml(shareId: string): string {
    return `<iframe src="${this.getEmbedUrl(shareId)}" width="960" height="540" style="border:0;aspect-ratio:16/9;width:100%;max-width:960px;" allowfullscreen></iframe>`;
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
