import { EditorAppPage } from '../pages/editor-app.page';
import { createInvalidPptxFixture } from '../support/test-assets';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor error recovery journey', () => {
  test('shows actionable feedback for invalid PowerPoint import and unsaved mirror actions', async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showOpenFilePicker', {
        configurable: true,
        value: undefined,
      });
    });

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    const invalidPptxPath = await createInvalidPptxFixture(testInfo);
    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Import' }).click();
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 30_000 });
    await page.getByRole('menuitem', { name: 'PowerPoint (.pptx)' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(invalidPptxPath);

    await expect(page.getByText(/PowerPoint import failed|Could not import PowerPoint/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('region', { name: 'Canvas workspace' })).toBeVisible();

    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Mirror now' }).click();
    await expect(page.getByText(/Save the project before mirroring|Persistence unavailable/)).toBeVisible({
      timeout: 30_000,
    });
  });
});
