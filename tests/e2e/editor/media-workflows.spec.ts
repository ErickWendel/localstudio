import { EditorAppPage } from '../pages/editor-app.page';
import { createTinyPngFixture } from '../support/test-assets';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

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
});
