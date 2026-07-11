import { buffer } from 'node:stream/consumers';
import { EditorAppPage } from '../pages/editor-app.page';
import { installPptxFilePicker } from '../support/pptx-file-picker';
import { createLayoutPptxFixture } from '../support/pptx-layout-fixture';
import { createTinyPngFixture } from '../support/test-assets';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor import and export journey', () => {
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
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    await page.mouse.click(canvasBox!.x + canvasBox!.width / 2, canvasBox!.y + canvasBox!.height / 2);
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
