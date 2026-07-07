import type { Page } from '@playwright/test';
import { EditorAppPage } from '../pages/editor-app.page';
import { installMockAiProviders } from '../support/mock-ai';
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

async function mockGoogleFontDownload(page: Page) {
  await page.route('https://fonts.googleapis.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/css',
      headers: { 'access-control-allow-origin': '*' },
      body: `
        @font-face {
          font-family: 'Montserrat';
          font-style: normal;
          font-weight: 700;
          src: url(https://fonts.gstatic.com/s/montserrat/v30/e2e.woff2) format('woff2');
        }
      `,
    });
  });
  await page.route('https://fonts.gstatic.com/**', async (route) => {
    await route.fulfill({
      contentType: 'font/woff2',
      headers: { 'access-control-allow-origin': '*' },
      body: Buffer.from([0x77, 0x4f, 0x46, 0x32, 0, 1, 0, 0]),
    });
  });
}

test.describe('editor font download and background removal journeys', () => {
  test('searches downloadable fonts and reports a font load failure without crashing', async ({
    page,
  }) => {
    await mockGoogleFontDownload(page);

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Design');
    await page.getByRole('button', { name: 'Bold selected text' }).click();
    await page.getByRole('button', { name: 'Download additional font' }).click();
    await page.getByLabel('Search downloadable fonts').fill('Montserrat');
    await page.getByRole('button', { name: 'Download Montserrat' }).click();

    await expect(page.getByRole('status')).toContainText('Font download failed.');
    await expect(page.getByRole('heading', { name: 'LocalStudio.dev' })).toBeVisible();
    await expect(page.getByLabel('Selected text font', { exact: true })).toBeVisible();
  });

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

    const center = await getCanvasPoint(page, { x: x + width / 2, y: y + height / 2 });
    await page.mouse.click(center.x, center.y);
    await editor.openTool('Layout');
    await expect(
      page.getByRole('button', { name: 'localstudio-e2e-pixel.png BG Removed', exact: true }),
    ).toBeVisible({ timeout: 30_000 });
  });
});
