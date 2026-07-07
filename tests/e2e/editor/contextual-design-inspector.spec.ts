import { EditorAppPage } from '../pages/editor-app.page';
import { createTinyPngFixture } from '../support/test-assets';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor contextual design inspector journey', () => {
  test('changes available design controls as text, shape, and image elements are selected', async ({
    page,
  }, testInfo) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Design');
    await expect(page.getByRole('tab', { name: 'Style', selected: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Selected text controls' })).toBeVisible();
    await page.getByLabel('Selected text font size').fill('42');
    await page.getByRole('button', { name: 'Bold selected text' }).click();
    await page.getByRole('button', { name: 'Align selected text center' }).click();
    await page
      .getByRole('tablist', { name: 'Movie inspector sections' })
      .getByRole('tab', { name: 'Text' })
      .click();
    await page.getByRole('textbox', { name: 'Selected text content' }).fill('Context-sensitive text');

    await editor.openTool('Elements');
    await page.getByRole('button', { name: 'Add square' }).click();
    await expect(page.getByRole('region', { name: 'Selected shape controls' })).toBeVisible();
    await page.getByLabel('Selected shape fill color').fill('#ff0055');
    await page.getByLabel('Selected shape border mode').selectOption('color');
    await page.getByLabel('Selected shape border width').fill('8');
    await expect(page.getByRole('region', { name: 'Selected text controls' })).toBeHidden();

    await editor.openTool('Assets');
    const imagePath = await createTinyPngFixture(testInfo);
    await page.getByLabel('Import media file').setInputFiles(imagePath);
    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'localstudio-e2e-pixel.png', exact: true }).click();
    await editor.openTool('Design');
    await expect(page.getByRole('tab', { name: 'Image', selected: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Selected image controls' })).toBeVisible();
    await page
      .getByRole('tablist', { name: 'Movie inspector sections' })
      .getByRole('tab', { name: 'Arrange' })
      .click();
    await page.getByLabel('Align selected element').selectOption('page-center');
    await expect(page.getByLabel('Selected element x position')).toHaveValue(/\d+/);
    await expect(page.getByLabel('Selected element y position')).toHaveValue(/\d+/);
  });
});
