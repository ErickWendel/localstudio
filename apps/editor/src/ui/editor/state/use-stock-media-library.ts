import { useEffect, useState } from 'react';
import { basicCommands } from '../../../domain/commands/elements/basicCommands';
import { fitImageWithinPage } from '../../../domain/images/imageSizing';
import type { ProjectDocument } from '../../../domain/documents/model';
import { createPrefixedId } from '../../../services/ids/idUtils';
import type {
  DownloadedStockMedia,
  StockMediaConfig,
  StockMediaItem,
  StockMediaProviderState,
  StockMediaService,
} from '../../../services/contracts/interfaces';

interface StockMediaSearchState {
  gifs: boolean;
  images: boolean;
}

export interface StockMediaErrorState {
  gifs?: string | undefined;
  images?: string | undefined;
}

interface UseStockMediaLibraryOptions {
  activePageId: string;
  commitProject: (
    updater: (currentProject: ProjectDocument) => ProjectDocument,
    options?: { selectedElementIds?: string[] },
  ) => void;
  project: ProjectDocument;
  setMediaSettingsOpen: (open: boolean) => void;
  stockMediaService: StockMediaService;
}

const STOCK_MEDIA_RECENT_LIMIT = 12;

export function useStockMediaLibrary({
  activePageId,
  commitProject,
  project,
  setMediaSettingsOpen,
  stockMediaService,
}: UseStockMediaLibraryOptions) {
  const [stockMediaConfig, setStockMediaConfig] = useState<StockMediaConfig | null>(() =>
    stockMediaService.loadConfig(),
  );
  const [stockMediaProviderState, setStockMediaProviderState] = useState<StockMediaProviderState>(
    () => stockMediaService.getProviderState(),
  );
  const [stockImageResults, setStockImageResults] = useState<StockMediaItem[]>([]);
  const [stockGifResults, setStockGifResults] = useState<StockMediaItem[]>([]);
  const [stockMediaRecentItems, setStockMediaRecentItems] = useState<StockMediaItem[]>([]);
  const [stockMediaSearching, setStockMediaSearching] = useState<StockMediaSearchState>({
    gifs: false,
    images: false,
  });
  const [stockMediaError, setStockMediaError] = useState<StockMediaErrorState>({});

  function refreshStockMediaConfig() {
    setStockMediaConfig(stockMediaService.loadConfig());
    setStockMediaProviderState(stockMediaService.getProviderState());
  }

  async function searchStockImages(query: string) {
    setStockMediaSearching((current) => ({ ...current, images: true }));
    setStockMediaError((current) => ({ ...current, images: undefined }));
    try {
      const results = await stockMediaService.searchImages(query);
      setStockImageResults(results);
      setStockMediaError((current) => ({ ...current, images: undefined }));
    } catch {
      setStockImageResults([]);
      setStockMediaError((current) => ({
        ...current,
        images: 'API Key is invalid',
      }));
    } finally {
      setStockMediaSearching((current) => ({ ...current, images: false }));
    }
  }

  async function searchStockGifs(query: string) {
    setStockMediaSearching((current) => ({ ...current, gifs: true }));
    setStockMediaError((current) => ({ ...current, gifs: undefined }));
    try {
      const results = await stockMediaService.searchGifs(query);
      setStockGifResults(results);
      setStockMediaError((current) => ({ ...current, gifs: undefined }));
    } catch {
      setStockGifResults([]);
      setStockMediaError((current) => ({
        ...current,
        gifs: 'API Key is invalid',
      }));
    } finally {
      setStockMediaSearching((current) => ({ ...current, gifs: false }));
    }
  }

  function saveStockMediaConfig(config: StockMediaConfig) {
    stockMediaService.saveConfig(config);
    refreshStockMediaConfig();
    setMediaSettingsOpen(false);
    void searchStockImages('');
    void searchStockGifs('');
  }

  function clearStockMediaConfig() {
    stockMediaService.clearConfig();
    refreshStockMediaConfig();
    setStockImageResults([]);
    setStockGifResults([]);
    setStockMediaError({});
  }

  function addRecentStockMedia(item: StockMediaItem) {
    setStockMediaRecentItems((currentItems) =>
      [
        item,
        ...currentItems.filter(
          (currentItem) => currentItem.provider !== item.provider || currentItem.id !== item.id,
        ),
      ].slice(0, STOCK_MEDIA_RECENT_LIMIT),
    );
  }

  async function downloadStockMedia(item: StockMediaItem, sourceUrl?: string) {
    return stockMediaService.downloadMedia(item, sourceUrl);
  }

  function setInsertError(item: StockMediaItem) {
    setStockMediaError((current) => ({
      ...current,
      [item.kind === 'image' ? 'images' : 'gifs']: 'Download failed',
    }));
  }

  async function insertRemoteImage(item: StockMediaItem) {
    if (item.kind !== 'image') return;
    const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
    if (!page) return;

    let media: DownloadedStockMedia;
    try {
      media = await downloadStockMedia(item);
    } catch {
      setInsertError(item);
      return;
    }

    const assetId = createPrefixedId('asset');
    const elementId = createPrefixedId('image');
    const fittedMedia = fitImageWithinPage({
      imageWidth: item.width,
      imageHeight: item.height,
      pageWidth: page.width,
      pageHeight: page.height,
    });

    commitProject(
      (currentProject) =>
        new basicCommands.AddImageElementCommand(activePageId, {
          asset: {
            id: assetId,
            type: 'image',
            name: item.title,
            mimeType: media.mimeType,
            objectUrl: media.objectUrl,
          },
          element: {
            id: elementId,
            type: 'image',
            assetId,
            x: fittedMedia.x,
            y: fittedMedia.y,
            width: fittedMedia.width,
            height: fittedMedia.height,
            rotation: 0,
            locked: false,
            visible: true,
            opacity: 1,
          },
        }).execute(currentProject),
      { selectedElementIds: [elementId] },
    );
    addRecentStockMedia(item);
    void stockMediaService.trackImageDownload(item).catch(() => undefined);
  }

  async function commitRemoteGifElement(item: StockMediaItem) {
    if (item.kind !== 'gif') return;
    const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
    if (!page) return;

    let media: DownloadedStockMedia;
    try {
      media = await downloadStockMedia(item);
    } catch {
      setInsertError(item);
      return;
    }

    const assetId = createPrefixedId('asset');
    const elementId = createPrefixedId('gif');
    const fittedMedia = fitImageWithinPage({
      imageWidth: item.width,
      imageHeight: item.height,
      pageWidth: page.width,
      pageHeight: page.height,
    });

    commitProject(
      (currentProject) =>
        new basicCommands.AddMediaElementCommand(activePageId, {
          asset: {
            id: assetId,
            type: 'gif',
            name: item.title,
            mimeType: media.mimeType,
            objectUrl: media.objectUrl,
          },
          element: {
            id: elementId,
            type: 'gif',
            assetId,
            x: fittedMedia.x,
            y: fittedMedia.y,
            width: fittedMedia.width,
            height: fittedMedia.height,
            rotation: 0,
            locked: false,
            visible: true,
            opacity: 1,
            playing: true,
          },
        }).execute(currentProject),
      { selectedElementIds: [elementId] },
    );
    addRecentStockMedia(item);
  }

  async function insertRemoteVideoElement(item: StockMediaItem, videoUrl: string) {
    if (item.kind !== 'gif') return;
    const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
    if (!page) return;

    let media: DownloadedStockMedia;
    try {
      media = await downloadStockMedia(item, videoUrl);
    } catch {
      setInsertError(item);
      return;
    }

    const assetId = createPrefixedId('asset');
    const elementId = createPrefixedId('video');
    const fittedMedia = fitImageWithinPage({
      imageWidth: item.width,
      imageHeight: item.height,
      pageWidth: page.width,
      pageHeight: page.height,
    });

    commitProject(
      (currentProject) =>
        new basicCommands.AddMediaElementCommand(activePageId, {
          asset: {
            id: assetId,
            type: 'video',
            name: item.title,
            mimeType: media.mimeType,
            objectUrl: media.objectUrl,
          },
          element: {
            id: elementId,
            type: 'video',
            assetId,
            x: fittedMedia.x,
            y: fittedMedia.y,
            width: fittedMedia.width,
            height: fittedMedia.height,
            rotation: 0,
            locked: false,
            visible: true,
            opacity: 1,
            loop: true,
            controls: true,
            muted: true,
            autoplayInPreview: true,
            trimStartSeconds: 0,
            repeatMode: 'loop',
          },
        }).execute(currentProject),
      { selectedElementIds: [elementId] },
    );
    addRecentStockMedia(item);
  }

  async function insertRemoteGif(item: StockMediaItem) {
    if (item.kind !== 'gif') return;
    if (item.videoUrl) {
      await insertRemoteVideoElement(item, item.videoUrl);
    } else {
      await commitRemoteGifElement(item);
    }
  }

  function insertStockMedia(item: StockMediaItem) {
    if (item.kind === 'gif') {
      void insertRemoteGif(item);
      return;
    }
    void insertRemoteImage(item);
  }

  useEffect(() => {
    const searchTimeouts: number[] = [];
    if (stockMediaProviderState.images.configured && stockImageResults.length === 0) {
      searchTimeouts.push(window.setTimeout(() => void searchStockImages(''), 0));
    }
    if (stockMediaProviderState.gifs.configured && stockGifResults.length === 0) {
      searchTimeouts.push(window.setTimeout(() => void searchStockGifs(''), 0));
    }
    return () => {
      searchTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
    // The stock search functions are declared in this hook and intentionally not dependencies:
    // adding them would rerun this bootstrap effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stockGifResults.length,
    stockImageResults.length,
    stockMediaProviderState.gifs.configured,
    stockMediaProviderState.images.configured,
  ]);

  return {
    clearStockMediaConfig,
    insertStockMedia,
    saveStockMediaConfig,
    searchStockGifs,
    searchStockImages,
    stockGifResults,
    stockImageResults,
    stockMediaConfig,
    stockMediaError,
    stockMediaProviderState,
    stockMediaRecentItems,
    stockMediaSearching,
  };
}
