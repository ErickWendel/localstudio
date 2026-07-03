import type {
  StockMediaConfig,
  StockMediaItem,
  StockMediaProviderState,
  StockMediaService,
} from '../contracts/interfaces';
import { browserStorage, type BrowserKeyValueStorage } from '../browser/browserStorage';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { createApi } from 'unsplash-js';

const CONFIG_STORAGE_KEY = 'localstudio.ai.stock-media-config';
const DEFAULT_LIMIT = 30;

interface BrowserStockMediaServiceOptions {
  fetch?: typeof fetch;
  storage?: BrowserKeyValueStorage;
}

interface UnsplashPhotoResponse {
  id?: unknown;
  alt_description?: unknown;
  description?: unknown;
  width?: unknown;
  height?: unknown;
  urls?: {
    regular?: unknown;
    small?: unknown;
    thumb?: unknown;
  };
  links?: {
    download_location?: unknown;
  };
  user?: {
    name?: unknown;
    links?: {
      html?: unknown;
    };
  };
}

interface GiphyResponse {
  id?: unknown;
  title?: unknown;
  username?: unknown;
  url?: unknown;
  images?: {
    downsized_medium?: GiphyImageResponse;
    original?: GiphyImageResponse;
    fixed_width?: GiphyImageResponse;
    preview_gif?: GiphyImageResponse;
  };
}

interface GiphyImageResponse {
  url?: unknown;
  width?: unknown;
  height?: unknown;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readPositiveNumber(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(readString(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isSafeRemoteUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function readConfigFromStorage(storage: BrowserKeyValueStorage | undefined) {
  const rawValue = storage?.getItem(CONFIG_STORAGE_KEY);
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue) as Partial<StockMediaConfig>;
    const giphyApiKey = readString(parsed.giphyApiKey);
    const unsplashAccessKey = readString(parsed.unsplashAccessKey);
    if (!giphyApiKey && !unsplashAccessKey) return null;
    return { giphyApiKey, unsplashAccessKey };
  } catch {
    return null;
  }
}

function mapUnsplashPhoto(photo: UnsplashPhotoResponse): StockMediaItem | null {
  const mediaUrl = photo.urls?.regular;
  const thumbnailUrl = photo.urls?.small ?? photo.urls?.thumb ?? mediaUrl;
  if (!isNonEmptyString(photo.id) || !isSafeRemoteUrl(mediaUrl) || !isSafeRemoteUrl(thumbnailUrl))
    return null;

  return {
    id: photo.id,
    provider: 'unsplash',
    kind: 'image',
    title:
      readString(photo.alt_description) ||
      readString(photo.description) ||
      `Unsplash photo ${photo.id}`,
    authorName: readString(photo.user?.name) || undefined,
    authorUrl: isSafeRemoteUrl(photo.user?.links?.html) ? photo.user?.links?.html : undefined,
    thumbnailUrl,
    mediaUrl,
    width: readPositiveNumber(photo.width, 1200),
    height: readPositiveNumber(photo.height, 800),
    downloadLocation: isSafeRemoteUrl(photo.links?.download_location)
      ? photo.links?.download_location
      : undefined,
  };
}

function mapGiphyGif(gif: GiphyResponse): StockMediaItem | null {
  const media = gif.images?.downsized_medium ?? gif.images?.original;
  const thumbnail = gif.images?.fixed_width ?? gif.images?.preview_gif ?? media;
  if (!isNonEmptyString(gif.id) || !isSafeRemoteUrl(media?.url) || !isSafeRemoteUrl(thumbnail?.url))
    return null;

  return {
    id: gif.id,
    provider: 'giphy',
    kind: 'gif',
    title: readString(gif.title) || `GIPHY GIF ${gif.id}`,
    authorName: readString(gif.username) || undefined,
    authorUrl: isSafeRemoteUrl(gif.url) ? gif.url : undefined,
    thumbnailUrl: thumbnail.url,
    mediaUrl: media.url,
    width: readPositiveNumber(media.width, 480),
    height: readPositiveNumber(media.height, 270),
  };
}

export class BrowserStockMediaService implements StockMediaService {
  private readonly requestFetch: typeof fetch;
  private readonly storage: BrowserKeyValueStorage | undefined;

  constructor(options: BrowserStockMediaServiceOptions = {}) {
    this.requestFetch = options.fetch ?? fetch;
    this.storage = options.storage ?? browserStorage.getBrowserLocalStorage();
  }

  loadConfig(): StockMediaConfig | null {
    return readConfigFromStorage(this.storage);
  }

  saveConfig(config: StockMediaConfig): void {
    const normalizedConfig: StockMediaConfig = {
      giphyApiKey: config.giphyApiKey.trim(),
      unsplashAccessKey: config.unsplashAccessKey.trim(),
    };
    this.storage?.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalizedConfig));
  }

  clearConfig(): void {
    this.storage?.removeItem?.(CONFIG_STORAGE_KEY);
  }

  getProviderState(): StockMediaProviderState {
    const config = this.loadConfig();
    return {
      gifs: { configured: Boolean(config?.giphyApiKey), provider: 'giphy' },
      images: { configured: Boolean(config?.unsplashAccessKey), provider: 'unsplash' },
    };
  }

  async searchImages(query: string): Promise<StockMediaItem[]> {
    const accessKey = this.loadConfig()?.unsplashAccessKey;
    if (!accessKey) return [];

    const normalizedQuery = query.trim();
    const unsplash = createApi({ accessKey, fetch: this.requestFetch });
    const result = normalizedQuery
      ? await unsplash.GET('/search/photos', {
          params: { query: { query: normalizedQuery, page: 1, per_page: DEFAULT_LIMIT } },
        })
      : await unsplash.GET('/photos', {
          params: { query: { page: 1, per_page: DEFAULT_LIMIT } },
        });
    if (result.error) throw new Error('Unsplash image search failed.');

    const payload = result.data as
      | { results?: UnsplashPhotoResponse[] }
      | UnsplashPhotoResponse[]
      | undefined;
    const photos = Array.isArray(payload) ? payload : (payload?.results ?? []);
    return photos.map(mapUnsplashPhoto).filter((item): item is StockMediaItem => Boolean(item));
  }

  async searchGifs(query: string): Promise<StockMediaItem[]> {
    const apiKey = this.loadConfig()?.giphyApiKey;
    if (!apiKey) return [];

    const normalizedQuery = query.trim();
    const giphy = new GiphyFetch(apiKey);
    const payload = await this.withConfiguredFetch(() =>
      normalizedQuery
        ? giphy.search(normalizedQuery, { limit: DEFAULT_LIMIT, rating: 'g' })
        : giphy.trending({ limit: DEFAULT_LIMIT, rating: 'g' }),
    );
    return (payload.data ?? []).map(mapGiphyGif).filter((item): item is StockMediaItem => Boolean(item));
  }

  private async withConfiguredFetch<T>(operation: () => Promise<T>): Promise<T> {
    if (this.requestFetch === globalThis.fetch) return operation();
    const previousFetch = globalThis.fetch;
    globalThis.fetch = this.requestFetch;
    try {
      return await operation();
    } finally {
      globalThis.fetch = previousFetch;
    }
  }

  async trackImageDownload(item: StockMediaItem): Promise<void> {
    const accessKey = this.loadConfig()?.unsplashAccessKey;
    if (!accessKey || item.provider !== 'unsplash' || !isSafeRemoteUrl(item.downloadLocation)) {
      return;
    }
    const unsplash = createApi({ accessKey, fetch: this.requestFetch });
    const result = await unsplash.GET('/photos/{id}/download', {
      params: { path: { id: item.id } },
    });
    if (result.error) throw new Error('Unsplash download tracking failed.');
  }
}
