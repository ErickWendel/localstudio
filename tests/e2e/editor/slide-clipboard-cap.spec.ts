import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { createTinyGifFixture } from '../support/test-assets';
import { installOversizedClipboardReader, pasteClipboardText } from './slide-clipboard-cap-browser';

const getServer = withIsolatedDevServer(test);

test('warns when a copied slide exceeds the clipboard media cap and keeps the asset reference', async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const editor = new EditorAppPage(page, getServer().baseURL);
  await editor.gotoNewProject();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: getServer().baseURL,
  });

  await editor.openTool('Assets');
  await page.getByLabel('Import media file').setInputFiles(await createTinyGifFixture(testInfo));
  await expect(page.getByText('localstudio-e2e-pixel.gif')).toBeVisible();

  await page.evaluate(installOversizedClipboardReader);
  await page
    .getByRole('button', { name: 'Copy Slide 1 to clipboard' })
    .evaluate((button: HTMLButtonElement) => button.click());

  await expect(
    page.getByText('Slide copied without media: file too large for the clipboard'),
  ).toBeVisible();
  const clipboardPayload = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardPayload).toContain('blob:');
  expect(clipboardPayload).not.toContain('data:image/gif;base64,aaa');

  await page.evaluate(pasteClipboardText, clipboardPayload);
  await expect(page.getByText('2 / 2')).toBeVisible();
  await editor.openTool('Layout');
  await expect(page.getByRole('button', { name: 'localstudio-e2e-pixel.gif', exact: true })).toBeVisible();
});
