import { EditorAppPage } from '../pages/editor-app.page';
import { installMockAiProviders } from '../support/mock-ai';
import { createTinyPngFixture } from '../support/test-assets';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { canvasPointFixture } from './canvas-point-fixture';

const getServer = withIsolatedDevServer(test);

test('prepares image editing models and removes an imported image background', async ({
  page,
}, testInfo) => {
  await installMockAiProviders(page);

  const editor = new EditorAppPage(page, getServer().baseURL);
  await editor.gotoNewProject();
  await editor.openTool('AI Tools');
  await page.getByRole('button', { name: 'Download Image Editing Models' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Remove Image Editing Models' })).toBeVisible({
    timeout: 30_000,
  });

  await editor.openTool('Assets');
  const imagePath = await createTinyPngFixture(testInfo);
  await page.getByLabel('Import media file').setInputFiles(imagePath);
  await editor.openTool('Layout');
  await page.getByRole('button', { name: 'localstudio-e2e-pixel.png', exact: true }).click();
  await editor.openTool('Design');
  await page
    .getByRole('tablist', { name: 'Movie inspector sections' })
    .getByRole('tab', { name: 'Arrange' })
    .click();

  const widthInput = page.getByLabel('Selected element width');
  const heightInput = page.getByLabel('Selected element height');
  await widthInput.fill('320');
  await heightInput.fill('320');
  const x = Number(await page.getByLabel('Selected element x position').inputValue());
  const y = Number(await page.getByLabel('Selected element y position').inputValue());
  const width = Number(await widthInput.inputValue());
  const height = Number(await heightInput.inputValue());

  await page.getByRole('button', { name: 'BG Remover' }).click();
  await expect(page.getByRole('status')).toContainText(
    /Extracting image embedding|Right click adds areas to keep/,
    { timeout: 30_000 },
  );
  await expect(page.getByRole('status')).toContainText('Right click adds areas to keep', {
    timeout: 30_000,
  });

  const center = await canvasPointFixture.getCanvasPoint(page, {
    x: x + width / 2,
    y: y + height / 2,
  });
  await page.mouse.click(center.x, center.y);
  await editor.openTool('Layout');
  await expect(
    page.getByRole('button', { name: 'localstudio-e2e-pixel.png BG Removed', exact: true }),
  ).toBeVisible({ timeout: 30_000 });
});
