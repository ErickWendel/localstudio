import { describe, expect, it, vi } from 'vitest';
import { BrowserStockMediaService } from '../../../src/services/stock-media/stockMediaService';

function getRequestUrl(input: RequestInfo | URL) {
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return input;
}

describe('BrowserStockMediaService', () => {
  it('stores media integration keys in localStorage', () => {
    const service = new BrowserStockMediaService();

    service.saveConfig({ giphyApiKey: 'giphy-key', unsplashAccessKey: 'unsplash-key' });

    expect(service.loadConfig()).toEqual({
      giphyApiKey: 'giphy-key',
      unsplashAccessKey: 'unsplash-key',
    });

    service.clearConfig();

    expect(service.loadConfig()).toBeNull();
  });

  it('reports provider readiness from saved config', () => {
    const service = new BrowserStockMediaService();

    expect(service.getProviderState()).toEqual({
      gifs: { configured: false, provider: 'giphy' },
      images: { configured: false, provider: 'unsplash' },
    });

    service.saveConfig({ giphyApiKey: 'giphy-key', unsplashAccessKey: 'unsplash-key' });

    expect(service.getProviderState()).toEqual({
      gifs: { configured: true, provider: 'giphy' },
      images: { configured: true, provider: 'unsplash' },
    });
  });

  it('maps Unsplash search results and tracks the photo download URL', async () => {
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:unsplash-photo');
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      const headers = input instanceof Request ? input.headers : undefined;
      if (url.startsWith('https://api.unsplash.com/search/photos')) {
        expect(headers?.get('authorization')).toBe('Client-ID unsplash-key');
        return Promise.resolve(
          Response.json({
            results: [
              {
                id: 'photo-1',
                alt_description: 'Mountain sunset',
                width: 2400,
                height: 1600,
                urls: {
                  regular: 'https://images.unsplash.com/photo-1?ixid=abc&fm=jpg&w=1080',
                  small: 'https://images.unsplash.com/photo-1?ixid=abc&fm=jpg&w=400',
                },
                links: {
                  download_location: 'https://api.unsplash.com/photos/photo-1/download',
                },
                user: {
                  name: 'Ada Photo',
                  links: { html: 'https://unsplash.com/@ada' },
                },
              },
            ],
          }),
        );
      }
      if (url === 'https://api.unsplash.com/photos/photo-1/download') {
        expect(headers?.get('authorization')).toBe('Client-ID unsplash-key');
        return Promise.resolve(Response.json({ url: 'https://images.unsplash.com/downloaded' }));
      }
      if (url === 'https://images.unsplash.com/photo-1?ixid=abc&fm=jpg&w=1080') {
        return Promise.resolve(
          new Response('photo-bytes', { headers: { 'content-type': 'image/jpeg' } }),
        );
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });
    const service = new BrowserStockMediaService({ fetch: fetchMock });
    service.saveConfig({ unsplashAccessKey: 'unsplash-key', giphyApiKey: '' });

    const results = await service.searchImages('mountain');

    expect(results).toEqual([
      {
        id: 'photo-1',
        provider: 'unsplash',
        kind: 'image',
        title: 'Mountain sunset',
        authorName: 'Ada Photo',
        authorUrl: 'https://unsplash.com/@ada',
        thumbnailUrl: 'https://images.unsplash.com/photo-1?ixid=abc&fm=jpg&w=400',
        mediaUrl: 'https://images.unsplash.com/photo-1?ixid=abc&fm=jpg&w=1080',
        width: 2400,
        height: 1600,
        downloadLocation: 'https://api.unsplash.com/photos/photo-1/download',
      },
    ]);

    await expect(service.downloadMedia(results[0]!)).resolves.toMatchObject({
      mimeType: 'image/jpeg',
      objectUrl: 'blob:unsplash-photo',
    });
    await service.trackImageDownload(results[0]!);

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('maps GIPHY search results to animated GIF media', async () => {
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:giphy-video');
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const rawUrl = getRequestUrl(input);
      if (rawUrl === 'https://media.giphy.com/media/gif-1/giphy.mp4') {
        return Promise.resolve(
          new Response('video-bytes', { headers: { 'content-type': 'video/mp4' } }),
        );
      }
      const url = new URL(rawUrl);
      if (url.origin !== 'https://api.giphy.com') {
        return Promise.resolve(new Response('', { status: 404 }));
      }
      expect(url.pathname).toBe('/v1/gifs/search');
      expect(url.searchParams.get('api_key')).toBe('giphy-key');
      expect(url.searchParams.get('limit')).toBe('30');
      expect(url.searchParams.get('q')).toBe('launch');
      return Promise.resolve(
        Response.json({
          data: [
            {
              id: 'gif-1',
              title: 'Launch GIF',
              username: 'Motion Studio',
              url: 'https://giphy.com/gifs/gif-1',
              images: {
                downsized_medium: {
                  url: 'https://media.giphy.com/media/gif-1/giphy.gif',
                  width: '480',
                  height: '270',
                },
                original: {
                  url: 'https://media.giphy.com/media/gif-1/original.gif',
                  mp4: 'https://media.giphy.com/media/gif-1/giphy.mp4',
                  width: '480',
                  height: '270',
                },
                fixed_width: {
                  url: 'https://media.giphy.com/media/gif-1/200w.gif',
                  mp4: 'https://media.giphy.com/media/gif-1/200w.mp4',
                  width: '200',
                  height: '113',
                },
              },
            },
          ],
          meta: { response_id: 'response-1', status: 200, msg: 'OK' },
        }),
      );
    });
    const service = new BrowserStockMediaService({ fetch: fetchMock });
    service.saveConfig({ unsplashAccessKey: '', giphyApiKey: 'giphy-key' });

    const results = await service.searchGifs('launch');

    expect(results).toEqual([
      {
        id: 'gif-1',
        provider: 'giphy',
        kind: 'gif',
        title: 'Launch GIF',
        authorName: 'Motion Studio',
        authorUrl: 'https://giphy.com/gifs/gif-1',
        thumbnailUrl: 'https://media.giphy.com/media/gif-1/200w.gif',
        mediaUrl: 'https://media.giphy.com/media/gif-1/giphy.gif',
        videoUrl: 'https://media.giphy.com/media/gif-1/giphy.mp4',
        width: 480,
        height: 270,
      },
    ]);
    createObjectUrl.mockClear();
    await expect(service.downloadMedia(results[0]!, results[0]!.videoUrl)).resolves.toMatchObject({
      mimeType: 'video/mp4',
      objectUrl: 'blob:giphy-video',
    });
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
  });
});
