import { type Page, type TestInfo } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';
import { createTinyPngFixture } from '../support/test-assets';

export async function cropImportedImage(page: Page, baseURL: string, testInfo: TestInfo) {
  const editor = new EditorAppPage(page, baseURL);
  await editor.gotoNewProject();

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
  await widthInput.fill('520');
  const startingWidth = Number(await widthInput.inputValue());

  await page.getByRole('button', { name: 'Crop' }).click();
  const cropRight = page.getByLabel('Crop right');
  await expect(cropRight).toBeVisible();
  const cropBox = await cropRight.boundingBox();
  expect(cropBox).not.toBeNull();
  await page.mouse.move(cropBox!.x + cropBox!.width / 2, cropBox!.y + cropBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(cropBox!.x - 90, cropBox!.y + cropBox!.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Done' }).click();

  await expect.poll(async () => Number(await widthInput.inputValue())).toBeLessThan(startingWidth);
}
