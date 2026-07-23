import type { StockMediaItem } from '../../../apps/editor/src/services/contracts/interfaces';

export async function evaluateStockMediaServiceContract() {
  const { BrowserStockMediaService } = (await import(
    '/editor/src/services/stock-media/stockMediaService.ts'
  )) as typeof import('../../../apps/editor/src/services/stock-media/stockMediaService');
  const storedValues = new Map<string, string>();
  const jsonResponse = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), {
      headers: { 'content-type': 'application/json' },
      status,
    });
  const captureError = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    return 'missing-error';
  };
  const summarizeItem = (item: StockMediaItem) => ({
    authorName: item.authorName,
    authorUrl: item.authorUrl,
    downloadLocation: item.downloadLocation,
    height: item.height,
    id: item.id,
    kind: item.kind,
    mediaUrl: item.mediaUrl,
    provider: item.provider,
    thumbnailUrl: item.thumbnailUrl,
    title: item.title,
    videoUrl: item.videoUrl,
    width: item.width,
  });
  const requestFetch = async (input: RequestInfo | URL) => {
    await Promise.resolve();
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('api.unsplash.com/search/photos')) {
      return jsonResponse({
        results: [
          {
            description: 'Description fallback image',
            height: '720',
            id: 'unsplash-description',
            links: { download_location: 'http://unsafe.example.test/download' },
            urls: {
              regular: 'https://images.example.test/description.jpg',
              thumb: 'https://images.example.test/description-thumb.jpg',
            },
            user: { links: { html: 'http://unsafe.example.test/author' }, name: '  ' },
            width: '1280',
          },
          {
            height: 0,
            id: 'unsplash-default',
            urls: {
              regular: 'https://images.example.test/default.jpg',
            },
            width: 'bad-width',
          },
          {
            id: 'unsplash-invalid',
            urls: {
              regular: 'http://unsafe.example.test/image.jpg',
              small: 'https://images.example.test/invalid-thumb.jpg',
            },
          },
        ],
      });
    }
    if (url.includes('api.unsplash.com/photos') && url.includes('/download')) {
      return jsonResponse({ errors: ['tracking failed'] }, 500);
    }
    if (url.includes('api.unsplash.com/photos')) {
      return jsonResponse([
        {
          alt_description: 'Recent editorial image',
          height: 900,
          id: 'unsplash-recent',
          links: { download_location: 'https://api.unsplash.com/photos/unsplash-recent/download' },
          urls: {
            regular: 'https://images.example.test/recent.jpg',
            small: 'https://images.example.test/recent-small.jpg',
          },
          user: { links: { html: 'https://unsplash.com/@recent' }, name: 'Recent Author' },
          width: 1400,
        },
      ]);
    }
    if (url.includes('api.giphy.com')) {
      return jsonResponse({
        data: [
          {
            id: 'giphy-default',
            images: {
              fixed_height: {
                height: '160',
                mp4: 'https://media.example.test/fixed-height.mp4',
                url: 'https://media.example.test/fixed-height.gif',
                width: '240',
              },
              original: {
                height: 'bad-height',
                url: 'https://media.example.test/original.gif',
                width: 'bad-width',
              },
              preview_gif: {
                height: '80',
                url: 'https://media.example.test/preview.gif',
                width: '120',
              },
            },
            url: 'http://unsafe.example.test/gif',
          },
        ],
        meta: { msg: 'OK', response_id: 'stock-contract', status: 200 },
        pagination: { count: 1, offset: 0, total_count: 1 },
      });
    }
    if (url.includes('download-fails')) {
      return new Response('not found', { status: 404 });
    }
    return new Response('media-bytes', {
      headers: { 'content-type': '' },
      status: 200,
    });
  };
  const service = new BrowserStockMediaService({
    fetch: requestFetch,
    storage: {
      getItem: (key) => storedValues.get(key) ?? null,
      removeItem: (key) => {
        storedValues.delete(key);
      },
      setItem: (key, value) => {
        storedValues.set(key, value);
      },
    },
  });

  storedValues.set('localstudio.ai.stock-media-config', '{not json');
  const invalidConfig = service.loadConfig();
  service.saveConfig({ giphyApiKey: ' giphy-key ', unsplashAccessKey: ' unsplash-key ' });
  const providerState = service.getProviderState();
  const recentImages = await service.searchImages(' ');
  const searchedImages = await service.searchImages('dashboard');
  const gifs = await service.searchGifs(' ');
  const gif = gifs[0];
  const searchedImage = searchedImages[0];
  const recentImage = recentImages[0];
  const videoDownload = await service.downloadMedia(gif, gif.videoUrl);
  const imageDownload = await service.downloadMedia(searchedImage);
  const invalidDownloadMessage = await captureError(() =>
    service.downloadMedia({ ...searchedImage, mediaUrl: 'http://unsafe.example.test/image.jpg' }),
  );
  const failedDownloadMessage = await captureError(() =>
    service.downloadMedia({ ...searchedImage, mediaUrl: 'https://media.example.test/download-fails' }),
  );
  const trackingFailureMessage = await captureError(() =>
    service.trackImageDownload({
      ...recentImage,
      downloadLocation: 'https://api.unsplash.com/photos/unsplash-recent/download',
    }),
  );
  service.clearConfig();

  return {
    failedDownloadMessage,
    gif: summarizeItem(gif),
    imageDownloadMimeType: imageDownload.mimeType,
    invalidConfig,
    invalidDownloadMessage,
    providerState,
    recentImage: summarizeItem(recentImage),
    searchedImages: searchedImages.map(summarizeItem),
    trackingFailureMessage,
    videoDownloadMimeType: videoDownload.mimeType,
  };
}
