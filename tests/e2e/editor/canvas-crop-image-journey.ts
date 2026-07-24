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
  await page.getByLabel('Selected element height').fill('240');

  await page.getByRole('button', { name: 'Crop' }).click();
  await dragCropHandle(page, 'Crop right', { x: -90, y: 0 });
  await dragCropHandle(page, 'Crop left', { x: 48, y: 0 });
  await dragCropHandle(page, 'Crop top', { x: 0, y: 36 });
  await dragCropHandle(page, 'Crop bottom', { x: 0, y: -36 });
  await page.getByRole('button', { name: 'Done' }).click();

  await expect.poll(async () => Number(await widthInput.inputValue())).toBeLessThan(startingWidth);
}

async function dragCropHandle(page: Page, label: string, delta: { x: number; y: number }) {
  const handle = page.getByRole('button', { name: label, exact: true });
  await expect(handle).toBeVisible();
  const cropBox = await handle.boundingBox();
  expect(cropBox).not.toBeNull();
  const startX = cropBox!.x + cropBox!.width / 2;
  const startY = cropBox!.y + cropBox!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + delta.x, startY + delta.y, { steps: 10 });
  await page.mouse.up();
}
