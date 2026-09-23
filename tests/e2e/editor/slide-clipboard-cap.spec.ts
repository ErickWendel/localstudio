import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { installFakeOpfs } from '../support/fake-opfs';
import { createTinyGifFixture } from '../support/test-assets';
import {
  installOversizedClipboardReader,
  listLocalAssetFiles,
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
  await installFakeOpfs(page, { directoryPicker: true });
  const editor = new EditorAppPage(page, getServer().baseURL);
  await editor.gotoNewProject();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: getServer().baseURL,
  });

  await editor.openTool('Assets');
  await page.getByLabel('Import media file').setInputFiles(await createTinyGifFixture(testInfo));
  await expect(page.getByText('localstudio-e2e-pixel.gif')).toBeVisible();

  await page.getByRole('button', { name: 'Save now' }).click();
  const sourceSetup = page.getByRole('dialog', { name: 'Save local project' });
  await sourceSetup.getByLabel('Project folder name').fill('E2E Source Deck');
  await sourceSetup.getByRole('button', { name: 'Choose folder' }).click();
  await expect(page.getByRole('button', { name: 'Copy Slide 1 to clipboard' })).toBeEnabled();

  await page.evaluate(installOversizedClipboardReader);
  await page.getByRole('button', { name: 'Copy Slide 1 to clipboard' }).click();

  await expect
    .poll(() => page.evaluate(readClipboardText), { timeout: 15_000 })
    .toContain('localstudio-clipboard:');
  const clipboardPayload = await page.evaluate(readClipboardText);
  expect(clipboardPayload).not.toContain('data:image/gif;base64,');
  await expect(
    page.getByText('Slide copied without media: file too large for the clipboard'),
  ).toHaveCount(0);

  const otherPage = await context.newPage();
  await installFakeOpfs(otherPage, { directoryPicker: true });
  const otherEditor = new EditorAppPage(otherPage, getServer().baseURL);
  await otherEditor.gotoNewProject();
  await otherPage.getByRole('button', { name: 'Save now' }).click();
  const destinationSetup = otherPage.getByRole('dialog', { name: 'Save local project' });
  await destinationSetup.getByLabel('Project folder name').fill('E2E Pasted Deck');
  await destinationSetup.getByRole('button', { name: 'Choose folder' }).click();
  await expect(otherPage.getByRole('button', { name: 'Copy Slide 1 to clipboard' })).toBeEnabled();
  await otherPage.evaluate(pasteClipboardText, clipboardPayload);
  await expect(otherPage.getByText('2 / 2')).toBeVisible();
  await expect.poll(() => otherPage.evaluate(readCanvasMediaSrc)).toMatch(/^blob:/);
  await expect
    .poll(() => otherPage.evaluate(listLocalAssetFiles, 'E2E Pasted Deck'), { timeout: 15_000 })
    .not.toEqual([]);
  await otherEditor.openTool('Layout');
  await expect(
    otherPage.getByRole('button', { name: 'localstudio-e2e-pixel.gif', exact: true }),
  ).toBeVisible();
  await otherPage.close();
});
