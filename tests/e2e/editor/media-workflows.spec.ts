import { EditorAppPage } from '../pages/editor-app.page';
import {
  createTinyGifFixture,
  createTinyPngFixture,
  getBigBuckBunnyMp4Fixture,
} from '../support/test-assets';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import type { Page } from '@playwright/test';

const getServer = withIsolatedDevServer(test);

test.describe('editor media workflow journey', () => {
  test('imports an image asset, manipulates it on canvas, and removes it', async ({ page }, testInfo) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.openTool('Assets');
    const imagePath = await createTinyPngFixture(testInfo);
    await page.getByLabel('Import media file').setInputFiles(imagePath);
    await expect(page.getByText('localstudio-e2e-pixel.png')).toBeVisible();

    await editor.openTool('Layout');
    await expect(page.getByRole('button', { name: 'localstudio-e2e-pixel.png', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Flip' })).toBeVisible();
    await page.getByRole('button', { name: 'Flip' }).click();
    await page.getByRole('button', { name: 'Crop' }).click();
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
    await expect(page.getByLabel('Crop top left')).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();

    await editor.openTool('Design');
    await page
      .getByRole('tablist', { name: 'Movie inspector sections' })
      .getByRole('tab', { name: 'Arrange' })
      .click();
    await page.getByLabel('Selected element width').fill('360');
    await expect(page.getByLabel('Selected element width')).toHaveValue('360');

    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'Delete localstudio-e2e-pixel.png' }).click();
    await expect(page.getByRole('button', { name: 'localstudio-e2e-pixel.png', exact: true })).toBeHidden();
  });

  test('replaces selected image grid placeholders with local image, GIF, and video media', async ({
    page,
  }, testInfo) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    const pngPath = await createTinyPngFixture(testInfo);
    const gifPath = await createTinyGifFixture(testInfo);

    await replacePlaceholderWithMedia(editor, page, pngPath, 'localstudio-e2e-pixel.png');
    await replacePlaceholderWithMedia(editor, page, gifPath, 'localstudio-e2e-pixel.gif');
    await replacePlaceholderWithMedia(
      editor,
      page,
      getBigBuckBunnyMp4Fixture(),
      'Big_Buck_Bunny_360_10s_1MB.mp4',
    );
  });
});

async function replacePlaceholderWithMedia(
  editor: EditorAppPage,
  page: Page,
  filePath: string,
  expectedAssetName: string,
) {
  await editor.openTool('Layout');
  await page.getByRole('button', { name: 'Insert 1 image grid' }).click();
  await page.getByRole('button', { name: 'Web AI placeholder image', exact: true }).first().click();

  await editor.openTool('Assets');
  await page.getByLabel('Import media file').setInputFiles(filePath);
  await expect(page.getByText(expectedAssetName)).toBeVisible({ timeout: 30_000 });
  await editor.openTool('Layout');
  await expect(page.getByRole('button', { name: expectedAssetName, exact: true })).toBeVisible({
    timeout: 30_000,
  });
}
