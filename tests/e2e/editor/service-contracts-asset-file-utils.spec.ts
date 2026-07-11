import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { evaluateAssetFileUtilsContract } from './asset-file-utils-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes asset file utility contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(evaluateAssetFileUtilsContract);

  expect(result).toEqual({
    extensions: ['jpg', 'gif', 'webp', 'mp4', 'webm', 'mov', 'png'],
    readableBlobText: 'image-bytes',
    remoteBlobText: 'remote-image',
    unreadableBlob: undefined,
  });
});
