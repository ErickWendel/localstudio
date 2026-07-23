import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';
import { evaluateStockMediaServiceContract } from './stock-media-service-contract-browser';

test('executes stock media service mapping and failure contracts in the browser runtime', async ({
  page,
}) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(evaluateStockMediaServiceContract);

  expect(result.invalidConfig).toBeNull();
  expect(result.providerState).toEqual({
    gifs: { configured: true, provider: 'giphy' },
    images: { configured: true, provider: 'unsplash' },
  });
  expect(result.recentImage).toMatchObject({
    authorName: 'Recent Author',
    authorUrl: 'https://unsplash.com/@recent',
    downloadLocation: 'https://api.unsplash.com/photos/unsplash-recent/download',
    height: 900,
    id: 'unsplash-recent',
    title: 'Recent editorial image',
    width: 1400,
  });
  expect(result.searchedImages).toEqual([
    expect.objectContaining({
      authorName: undefined,
      authorUrl: undefined,
      downloadLocation: undefined,
      height: 720,
      id: 'unsplash-description',
      title: 'Description fallback image',
      width: 1280,
    }),
    expect.objectContaining({
      height: 800,
      id: 'unsplash-default',
      title: 'Unsplash photo unsplash-default',
      width: 1200,
    }),
  ]);
  expect(result.gif).toMatchObject({
    authorUrl: undefined,
    height: 270,
    id: 'giphy-default',
    mediaUrl: 'https://media.example.test/original.gif',
    thumbnailUrl: 'https://media.example.test/preview.gif',
    title: 'GIPHY GIF giphy-default',
    videoUrl: 'https://media.example.test/fixed-height.mp4',
    width: 480,
  });
  expect(result.videoDownloadMimeType).toBe('video/mp4');
  expect(result.imageDownloadMimeType).toBe('image/jpeg');
  expect(result.invalidDownloadMessage).toBe('Stock media download URL is invalid.');
  expect(result.failedDownloadMessage).toBe('Stock media download failed.');
  expect(result.trackingFailureMessage).toBe('Unsplash download tracking failed.');
});
