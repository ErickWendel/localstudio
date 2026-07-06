import { EditorAppPage } from '../pages/editor-app.page';
import { createTinyPngFixture, createTinyPptxFixture } from '../support/test-assets';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor import and export journey', () => {
  test('imports PowerPoint and media fixtures, then exports a PowerPoint download', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showOpenFilePicker', {
        configurable: true,
        value: undefined,
      });
    });

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    const pptxPath = await createTinyPptxFixture(testInfo);
    const fileChooserPromise = page.waitForEvent('filechooser');
    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Import' }).click();
    await page.getByRole('menuitem', { name: 'PowerPoint (.pptx)' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(pptxPath);

    await expect(page.getByRole('progressbar', { name: 'PowerPoint import progress' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit project name localstudio-e2e-import' })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText('1 / 2')).toBeVisible();
    await expect(page.getByRole('button', { name: /Insert Text/i }).first()).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Export to' }).click();
    await page.getByRole('menuitem', { name: 'Powerpoint (.pptx)' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pptx$/);

    await editor.openTool('Assets');
    const imagePath = await createTinyPngFixture(testInfo);
    await page.getByLabel('Import media file').setInputFiles(imagePath);
    await expect(page.getByText('localstudio-e2e-pixel.png')).toBeVisible();
  });
});
