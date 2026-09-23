import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { createTinyGifFixture } from '../support/test-assets';
import {
  installOversizedClipboardReader,
  pasteClipboardText,
  readCanvasMediaSrc,
  readClipboardText,
} from './slide-clipboard-cap-browser';

const getServer = withIsolatedDevServer(test);

test('copies a slide with oversized media and pastes it in another tab', async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(90_000);
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

  await expect
    .poll(() => page.evaluate(readClipboardText), { timeout: 15_000 })
    .toContain('localstudio-clipboard:');
  const clipboardPayload = await page.evaluate(readClipboardText);
  expect(clipboardPayload).not.toContain('data:image/gif;base64,');
  await expect(
    page.getByText('Slide copied without media: file too large for the clipboard'),
  ).toHaveCount(0);

  const otherPage = await context.newPage();
  const otherEditor = new EditorAppPage(otherPage, getServer().baseURL);
  await otherEditor.gotoNewProject();
  await otherPage.evaluate(pasteClipboardText, clipboardPayload);
  await expect(otherPage.getByText('2 / 2')).toBeVisible();
  await expect.poll(() => otherPage.evaluate(readCanvasMediaSrc)).toMatch(/^blob:/);
  await otherEditor.openTool('Layout');
  await expect(
    otherPage.getByRole('button', { name: 'localstudio-e2e-pixel.gif', exact: true }),
  ).toBeVisible();
  await otherPage.close();
});
