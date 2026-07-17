import { vi } from 'vitest';
import type { ProjectDocument } from '../../../../src/domain/documents/model';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type {
  DownloadedStockMedia,
  StockMediaConfig,
  StockMediaItem,
  StockMediaProviderState,
  StockMediaService,
} from '../../../../src/services/contracts/interfaces';

const stockImage: StockMediaItem = {
  id: 'photo-1',
  provider: 'unsplash',
  kind: 'image',
  title: 'Mountain sunset',
  authorName: 'Ada Photo',
  thumbnailUrl: 'https://images.unsplash.com/photo-1?w=400',
  mediaUrl: 'https://images.unsplash.com/photo-1?w=1080',
  width: 1200,
  height: 800,
  downloadLocation: 'https://api.unsplash.com/photos/photo-1/download',
};

const stockGif: StockMediaItem = {
  id: 'gif-1',
  provider: 'giphy',
  kind: 'gif',
  title: 'Launch GIF',
  authorName: 'Motion Studio',
  thumbnailUrl: 'https://media.giphy.com/media/gif-1/200w.gif',
  mediaUrl: 'https://media.giphy.com/media/gif-1/giphy.gif',
  videoUrl: 'https://media.giphy.com/media/gif-1/giphy.mp4',
  width: 480,
  height: 270,
};

class ReadyStockMediaService implements StockMediaService {
  downloadedItems: Array<{ item: StockMediaItem; sourceUrl: string }> = [];
  trackedItems: StockMediaItem[] = [];

  loadConfig(): StockMediaConfig {
    return { giphyApiKey: 'giphy-key', unsplashAccessKey: 'unsplash-key' };
  }

  saveConfig(): void {
    return undefined;
  }

  clearConfig(): void {
    return undefined;
  }

  getProviderState(): StockMediaProviderState {
    return {
      gifs: { configured: true, provider: 'giphy' },
      images: { configured: true, provider: 'unsplash' },
    };
  }

  searchImages(): Promise<StockMediaItem[]> {
    return Promise.resolve([stockImage]);
  }

  searchGifs(): Promise<StockMediaItem[]> {
    return Promise.resolve([stockGif]);
  }

  downloadMedia(item: StockMediaItem, sourceUrl = item.mediaUrl): Promise<DownloadedStockMedia> {
    this.downloadedItems.push({ item, sourceUrl });
    return Promise.resolve({
      blob: new Blob(['stock-media'], {
        type: sourceUrl.endsWith('.mp4') ? 'video/mp4' : item.kind === 'gif' ? 'image/gif' : 'image/jpeg',
      }),
      mimeType: sourceUrl.endsWith('.mp4') ? 'video/mp4' : item.kind === 'gif' ? 'image/gif' : 'image/jpeg',
      objectUrl:
        sourceUrl === stockGif.videoUrl
          ? 'blob:giphy-video'
          : item.kind === 'gif'
            ? 'blob:giphy-gif'
            : 'blob:unsplash-image',
    });
  }

  trackImageDownload(item: StockMediaItem): Promise<void> {
    this.trackedItems.push(item);
    return Promise.resolve();
  }
}

class InvalidImageStockMediaService extends ReadyStockMediaService {
  override searchImages(): Promise<StockMediaItem[]> {
    return Promise.reject(new Error('Unsplash image search failed with 401 Unauthorized.'));
  }
}

function createProjectWithVideo(): ProjectDocument {
  const project = sampleProject.createSampleProject();
  project.assets['asset-video'] = {
    id: 'asset-video',
    type: 'video',
    name: 'Demo clip',
    mimeType: 'video/mp4',
    objectUrl: 'blob:video',
  };
  project.elements['video-demo'] = {
    id: 'video-demo',
    type: 'video',
    assetId: 'asset-video',
    x: 120,
    y: 80,
    width: 640,
    height: 360,
    rotation: 0,
    locked: false,
    visible: true,
    opacity: 1,
    loop: false,
    controls: true,
    muted: true,
    autoplayInPreview: true,
    trimStartSeconds: 0,
  };
  project.pages[0]?.elementIds.push('video-demo');
  return project;
}

function mockVideoMetadataLoad() {
  const createElement = document.createElement.bind(document);
  return vi
    .spyOn(document, 'createElement')
    .mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = createElement(tagName, options);
      if (tagName.toLowerCase() === 'video') {
        Object.defineProperty(element, 'videoWidth', { configurable: true, value: 1280 });
        Object.defineProperty(element, 'videoHeight', { configurable: true, value: 720 });
        Object.defineProperty(element, 'duration', { configurable: true, value: 8.5 });
        queueMicrotask(() => {
          element.dispatchEvent(new Event('loadedmetadata'));
        });
      }
      return element;
    });
}

function mockControllableVideoMetadataLoad() {
  const createElement = document.createElement.bind(document);
  let videoElement: HTMLElement | undefined;
  const createElementSpy = vi
    .spyOn(document, 'createElement')
    .mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = createElement(tagName, options);
      if (tagName.toLowerCase() === 'video') {
        Object.defineProperty(element, 'videoWidth', { configurable: true, value: 1280 });
        Object.defineProperty(element, 'videoHeight', { configurable: true, value: 720 });
        videoElement = element;
      }
      return element;
    });

  return {
    createElementSpy,
    hasMetadataTarget() {
      return Boolean(videoElement);
    },
    loadMetadata() {
      videoElement?.dispatchEvent(new Event('loadedmetadata'));
    },
  };
}

export const editorShellMediaFixtures = {
  InvalidImageStockMediaService,
  ReadyStockMediaService,
  createProjectWithVideo,
  mockControllableVideoMetadataLoad,
  mockVideoMetadataLoad,
  stockImage,
};
