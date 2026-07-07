import type { Page } from '@playwright/test';
import { EditorAppPage } from '../pages/editor-app.page';
import { createTinyPngFixture } from '../support/test-assets';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

async function getCanvasPoint(page: Page, point: { x: number; y: number }) {
  const canvas = page.getByTestId('slide-canvas-frame').locator('canvas').first();
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  return {
    x: canvasBox!.x + (point.x / 1920) * canvasBox!.width,
    y: canvasBox!.y + (point.y / 1080) * canvasBox!.height,
  };
}

test.describe('editor canvas transform handles and crop journey', () => {
  test('resizes a text element with canvas handles and keeps arrange controls usable', async ({
    page,
  }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Design');
    await expect(page.getByRole('region', { name: 'Selected text controls' })).toBeVisible();
    await page
      .getByRole('tablist', { name: 'Movie inspector sections' })
      .getByRole('tab', { name: 'Arrange' })
      .click();

    const widthInput = page.getByLabel('Selected element width');
    const heightInput = page.getByLabel('Selected element height');
    const xInput = page.getByLabel('Selected element x position');
    const yInput = page.getByLabel('Selected element y position');
    const rotationInput = page.getByRole('spinbutton', { name: 'Selected element rotation' });
    await xInput.fill('560');
    await yInput.fill('280');
    await widthInput.fill('320');
    await heightInput.fill('180');

    const resizeStart = await getCanvasPoint(page, { x: 880, y: 460 });
    await page.mouse.move(resizeStart.x, resizeStart.y);
    await page.mouse.down();
    await page.mouse.move(resizeStart.x + 90, resizeStart.y + 50, { steps: 10 });
    await page.mouse.up();

    await expect.poll(async () => Number(await widthInput.inputValue())).toBeGreaterThan(360);
    await expect.poll(async () => Number(await heightInput.inputValue())).toBeGreaterThan(200);

    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'Add a little bit of body text', exact: true }).click();
    await editor.openTool('Design');
    await page
      .getByRole('tablist', { name: 'Movie inspector sections' })
      .getByRole('tab', { name: 'Arrange' })
      .click();

    await rotationInput.fill('18');
    await expect(rotationInput).toHaveValue('18');
  });

  test('crops an imported image by dragging crop handles', async ({ page }, testInfo) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
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
  });
});
