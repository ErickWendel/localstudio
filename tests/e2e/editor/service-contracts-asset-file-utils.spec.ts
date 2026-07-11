import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes asset file utility contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(async () => {
    const { assetFileUtils } = (await import(
      '/editor/src/services/storage/assetFileUtils.ts'
    )) as typeof import('../../../apps/editor/src/services/storage/assetFileUtils');

    const dataUrl = 'data:image/png;base64,aW1hZ2UtYnl0ZXM=';
    const remoteBlobText = await assetFileUtils
      .objectUrlToBlob('https://example.test/image.png', () =>
        Promise.resolve(new Response('remote-image')),
      )
      .then((blob) => blob.text());
    const unreadableBlob = await assetFileUtils.objectUrlToBlobIfReadable(
      'https://example.test/no-fetch.png',
      undefined,
    );
    const readableBlob = await assetFileUtils.objectUrlToBlobIfReadable(dataUrl, undefined);

    return {
      extensions: [
        assetFileUtils.getAssetFileExtension('image/jpeg'),
        assetFileUtils.getAssetFileExtension('image/gif'),
        assetFileUtils.getAssetFileExtension('image/webp'),
        assetFileUtils.getAssetFileExtension('video/mp4'),
        assetFileUtils.getAssetFileExtension('video/webm'),
        assetFileUtils.getAssetFileExtension('video/quicktime'),
        assetFileUtils.getAssetFileExtension('application/octet-stream'),
      ],
      readableBlobText: readableBlob ? await readableBlob.text() : '',
      remoteBlobText,
      unreadableBlob,
    };
  });

  expect(result).toEqual({
    extensions: ['jpg', 'gif', 'webp', 'mp4', 'webm', 'mov', 'png'],
    readableBlobText: 'image-bytes',
    remoteBlobText: 'remote-image',
    unreadableBlob: undefined,
  });
});
