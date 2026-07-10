import { buffer } from 'node:stream/consumers';
import { unzipSync } from 'fflate';
import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { readPngVisiblePixelRatio } from '../support/png-visible-pixel-ratio';

const getServer = withIsolatedDevServer(test);

test.describe('editor current page image export journey', () => {
  test('downloads the active page as a PNG from the share panel', async ({ page }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await editor.renameProject('E2E Image Export');

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Share' }).click();
    await page.getByRole('button', { name: 'Download' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();
    const contents = await buffer(stream);
    expect(contents.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  test('downloads all slides as an image ZIP from the File menu', async ({ page }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await editor.renameProject('E2E Images Archive');

    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Export to' }).click();
    await page.getByRole('menuitem', { name: 'Images (.zip)' }).click();

    await expect(page.getByRole('dialog', { name: 'Export images' })).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'Create an image for each animation' }),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export images' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/-images\.zip$/);
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();
    const contents = await buffer(stream);
    expect(contents.subarray(0, 2).toString('utf8')).toBe('PK');
  });

  test('exports readable final slide states from the local PPTX sample when animation images are disabled', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.goto('/editor/?newProject=1&importPptxSample=1');
    await expect(
      page.getByRole('button', {
        name: 'Edit project name fullstack-monitoring-jsnation-11062026',
      }),
    ).toBeVisible({ timeout: 90_000 });

    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Export to' }).click();
    await page.getByRole('menuitem', { name: 'Images (.zip)' }).click();
    await expect(
      page.getByRole('checkbox', { name: 'Create an image for each animation' }),
    ).not.toBeChecked();

    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: 'Export images' }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();
    const archiveBytes = await buffer(stream);
    const archiveFiles = unzipSync(new Uint8Array(archiveBytes));
    const suspectSlides = [1, 5, 19, 24, 25, 27, 30, 40, 42, 50].map(
      (slideNumber) => `fullstack-monitoring-jsnation-11062026-Slide ${slideNumber}.png`,
    );
    const blackSlides = suspectSlides.filter((fileName) => {
      const imageBytes = archiveFiles[fileName];
      expect(imageBytes, `${fileName} should exist in the image archive`).toBeDefined();
      if (!imageBytes) return true;
      return readPngVisiblePixelRatio(imageBytes) < 0.01;
    });
    expect(blackSlides).toEqual([]);
  });
});
