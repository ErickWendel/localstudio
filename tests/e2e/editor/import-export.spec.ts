import { buffer } from 'node:stream/consumers';
import { EditorAppPage } from '../pages/editor-app.page';
import { installPptxFilePicker } from '../support/pptx-file-picker';
import { createLayoutPptxFixture } from '../support/pptx-layout-fixture';
import { createTinyPngFixture } from '../support/test-assets';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { readCanvasPixel } from './pptx-background-browser';

const getServer = withIsolatedDevServer(test);
const browserAiSamplePath =
  '/Users/erickwendel/Downloads/A revolução de IA integrada em navegadores.pptx';
const sampleRegressionEnabled = process.env.LOCALSTUDIO_PPTX_SAMPLE_REGRESSION === '1';

test.describe('editor import and export journey', () => {
  test('renders and copies the browser AI deck image background across editor tabs', async ({
    context,
    page,
  }, testInfo) => {
    test.skip(!sampleRegressionEnabled, 'Requires the local browser AI sample deck.');
    test.setTimeout(120_000);
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await installPptxFilePicker(page, browserAiSamplePath);
    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Import' }).click();
    await page.getByRole('menuitem', { name: 'PowerPoint (.pptx)' }).click();

    await expect(
      page.getByRole('button', {
        name: 'Edit project name A revolução de IA integrada em navegadores',
      }),
    ).toBeVisible({ timeout: 90_000 });
    const warningDialog = page.getByRole('dialog', { name: 'PowerPoint font warnings' });
    if (await warningDialog.isVisible()) {
      await warningDialog.getByRole('button', { name: 'Dismiss PowerPoint font warnings' }).click();
    }
    await expect(page.getByText('1 / 59')).toBeVisible();

    const frame = page.getByLabel('Slide canvas', { exact: true });
    const canvas = frame.locator('canvas').first();
    await expect
      .poll(async () => {
        const [red = 0, green = 0, blue = 0, alpha = 0] = await canvas.evaluate(
          readCanvasPixel,
          { x: 5, y: 5 },
        );
        return (
          Math.abs(red) <= 3 &&
          Math.abs(green - 205) <= 3 &&
          Math.abs(blue - 111) <= 3 &&
          alpha === 255
        );
      })
      .toBe(true);
    await expect
      .poll(async () => {
        const [red = 0, green = 0, blue = 0, alpha = 0] = await canvas.evaluate(
          readCanvasPixel,
          { x: 190, y: 211 },
        );
        return (
          red > 120 &&
          green > 70 &&
          blue < 80 &&
          alpha === 255
        );
      })
      .toBe(true);
    const sourcePortraitPixel = await canvas.evaluate(readCanvasPixel, { x: 190, y: 211 });
    await editor.openTool('Layout');
    const backgroundLayer = page.getByRole('button', {
      name: 'Slide background — image47.png',
      exact: true,
    });
    await expect(backgroundLayer).toBeVisible();
    await backgroundLayer.click();
    await expect(backgroundLayer).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'BG Remover' })).toBeVisible();
    await frame.screenshot({ path: testInfo.outputPath('browser-ai-slide-1.png') });
    await page.keyboard.press('Escape');

    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: getServer().baseURL,
    });
    await page.evaluate(() => navigator.clipboard.writeText('clipboard sentinel'));
    await page
      .getByRole('button', { name: 'Copy Slide 1 to clipboard' })
      .evaluate((button: HTMLButtonElement) => button.click());
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain('"objectUrl":"data:image/');
    const clipboardPayload = await page.evaluate(() => navigator.clipboard.readText());

    await page.close();
    const destinationPage = await context.newPage();
    const destinationEditor = new EditorAppPage(destinationPage, getServer().baseURL);
    await destinationEditor.gotoNewProject();
    await destinationPage.evaluate((payload) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', payload);
      window.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData }));
    }, clipboardPayload);

    await expect(destinationPage.getByText('2 / 2')).toBeVisible();
    const pastedFrame = destinationPage.getByLabel('Slide canvas', { exact: true });
    const pastedCanvas = pastedFrame.locator('canvas').first();
    await expect
      .poll(() => pastedCanvas.evaluate(readCanvasPixel, { x: 190, y: 211 }))
      .toEqual(sourcePortraitPixel);
    await pastedFrame.screenshot({ path: testInfo.outputPath('browser-ai-slide-1-pasted.png') });
  });

  test('imports PowerPoint and media fixtures, then exports a PowerPoint download', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    const pptxPath = await createLayoutPptxFixture(testInfo);
    await installPptxFilePicker(page, pptxPath);
    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Import' }).click();
    await page.getByRole('menuitem', { name: 'PowerPoint (.pptx)' }).click();

    const importedProjectName = page.getByRole('button', {
      name: 'Edit project name localstudio-e2e-import-layouts',
    });
    await expect(
      page.getByRole('progressbar', { name: 'PowerPoint import progress' }).or(importedProjectName),
    ).toBeVisible({ timeout: 60_000 });
    await expect(importedProjectName).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText('1 / 1')).toBeVisible();
    await expect(page.getByRole('button', { name: /Insert Text/i }).first()).toBeVisible();

    await editor.openTool('Design');
    const frame = page.getByTestId('slide-canvas-frame');
    const canvas = frame.locator('canvas').first();
    await expect
      .poll(() => canvas.evaluate(readCanvasPixel, { x: 5, y: 5 }))
      .toEqual([255, 255, 255, 255]);
    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'Page Background', exact: true }).click();
    await editor.openTool('Design');
    await expect(
      page.getByRole('button', { name: 'Open layout picker, current layout Statement' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Open layout picker, current layout Statement' }).click();
    const layoutChooser = page.getByRole('region', { name: 'Choose a layout' });
    await expect(layoutChooser).toBeVisible();
    await expect(layoutChooser.getByRole('button', { name: 'Statement' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await layoutChooser.getByRole('button', { name: 'Title & Photo' }).click();
    await expect(
      page.getByRole('button', { name: 'Open layout picker, current layout Title & Photo' }),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Export to' }).click();
    await page.getByRole('menuitem', { name: 'Powerpoint (.pptx)' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pptx$/);
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();
    const contents = await buffer(stream);
    expect(contents.subarray(0, 2).toString('utf8')).toBe('PK');

    await editor.openTool('Assets');
    const imagePath = await createTinyPngFixture(testInfo);
    await page.getByLabel('Import media file').setInputFiles(imagePath);
    await expect(page.getByText('localstudio-e2e-pixel.png')).toBeVisible();
  });
});
