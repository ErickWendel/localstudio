import type { Asset } from '../../domain/documents/model';
import type { StockMediaItem, StockMediaService } from '../contracts/interfaces';

export interface AuthoringMediaResult {
  attribution: {
    authorName?: string | undefined;
    authorUrl?: string | undefined;
    provider: 'giphy' | 'unsplash';
  };
  dimensions: { height: number; width: number };
  kind: 'gif' | 'image';
  mediaRef: string;
  previewUrl: string;
  provider: 'giphy' | 'unsplash';
  title: string;
}

export interface AuthoringMediaSearchResult {
  items: AuthoringMediaResult[];
  kind: 'gif' | 'image';
  limit: number;
  provider: 'giphy' | 'unsplash';
  total: number;
}

interface AuthoringMediaCapabilityOptions {
  stockMediaService: StockMediaService;
}

const MAX_MEDIA_RESULTS = 30;
const MAX_MEDIA_REFERENCES = 200;
const MAX_SEARCH_TERM_LENGTH = 200;

function createMediaRef(item: StockMediaItem) {
  return `stock:${item.provider}:${item.kind}:${encodeURIComponent(item.id)}`;
}

function hashReference(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export class AuthoringMediaCapability {
  private readonly mediaReferences = new Map<string, StockMediaItem>();

  constructor(private readonly options: AuthoringMediaCapabilityOptions) {}

  async search(input: {
    kind: 'gif' | 'image';
    limit?: number | undefined;
    term: string;
  }): Promise<AuthoringMediaSearchResult> {
    const providerState = this.options.stockMediaService.getProviderState();
    const configured =
      input.kind === 'image' ? providerState.images.configured : providerState.gifs.configured;
    const provider = input.kind === 'image' ? 'unsplash' : 'giphy';
    if (!configured) {
      throw new Error(
        `Configure ${provider === 'unsplash' ? 'Unsplash' : 'GIPHY'} in Media integrations before searching ${input.kind === 'image' ? 'images' : 'GIFs'}.`,
      );
    }

    const term = input.term.trim();
    if (term.length > MAX_SEARCH_TERM_LENGTH) {
      throw new Error(`Media search terms must be ${MAX_SEARCH_TERM_LENGTH} characters or fewer.`);
    }
    const limit = Math.max(1, Math.min(MAX_MEDIA_RESULTS, Math.floor(input.limit ?? 12)));
    const results =
      input.kind === 'image'
        ? await this.options.stockMediaService.searchImages(term)
        : await this.options.stockMediaService.searchGifs(term);
    const unique = new Map<string, StockMediaItem>();
    results.forEach((item) => {
      if (item.kind !== input.kind || item.provider !== provider) return;
      unique.set(createMediaRef(item), item);
    });
    const selected = [...unique.entries()].slice(0, limit);
    selected.forEach(([mediaRef, item]) => this.remember(mediaRef, item));
    return {
      items: selected.map(([mediaRef, item]) => ({
        attribution: {
          ...(item.authorName ? { authorName: item.authorName } : {}),
          ...(item.authorUrl ? { authorUrl: item.authorUrl } : {}),
          provider: item.provider,
        },
        dimensions: { height: item.height, width: item.width },
        kind: item.kind,
        mediaRef,
        previewUrl: item.thumbnailUrl,
        provider: item.provider,
        title: item.title,
      })),
      kind: input.kind,
      limit,
      provider,
      total: unique.size,
    };
  }

  async resolveMediaRef(mediaRef: string): Promise<Asset> {
    const item = this.mediaReferences.get(mediaRef);
    if (!item) throw new Error(`Unknown or expired mediaRef: ${mediaRef}. Search media again.`);
    const downloaded = await this.options.stockMediaService.downloadMedia(item);
    if (item.provider === 'unsplash') await this.options.stockMediaService.trackImageDownload(item);
    return {
      id: `asset-stock-${hashReference(mediaRef)}`,
      type: item.kind,
      name: item.title,
      mimeType: downloaded.mimeType,
      objectUrl: downloaded.objectUrl,
      storage: 'inline',
    };
  }

  private remember(mediaRef: string, item: StockMediaItem) {
    this.mediaReferences.delete(mediaRef);
    this.mediaReferences.set(mediaRef, item);
    while (this.mediaReferences.size > MAX_MEDIA_REFERENCES) {
      const oldest = this.mediaReferences.keys().next().value;
      if (!oldest) break;
      this.mediaReferences.delete(oldest);
    }
  }
}
