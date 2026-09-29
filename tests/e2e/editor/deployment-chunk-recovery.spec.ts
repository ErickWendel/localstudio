import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);
const usesProductionBuild =
  process.env.E2E_SERVER === 'dist' ||
  (Boolean(process.env.LOCALSTUDIO_E2E_BASE_URL) && process.env.E2E_SERVER !== 'dev');

test.describe('editor deployment chunk recovery', () => {
  test('reloads once after a stale PowerPoint exporter chunk and then exports', async ({ page }) => {
    test.skip(!usesProductionBuild, 'Requires production Vite preload behavior.');

    let exporterRequestCount = 0;
    let editorDocumentRequestCount = 0;
    page.on('request', (request) => {
      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame() &&
        request.url().includes('/editor/')
      ) {
        editorDocumentRequestCount += 1;
      }
    });
    await page.route(/\/editor\/assets\/pptxExportService-[^/]+\.js$/, async (route) => {
      exporterRequestCount += 1;
      if (exporterRequestCount === 1) {
        await route.fulfill({
          body: 'simulated stale deployment chunk',
          contentType: 'text/plain',
          status: 404,
        });
        return;
      }
      await route.continue();
    });

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    const initialDocumentRequestCount = editorDocumentRequestCount;

    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Export to' }).click();
    await page.getByRole('menuitem', { name: 'Powerpoint (.pptx)' }).click();

    await expect.poll(() => exporterRequestCount).toBe(1);
    await expect
      .poll(() => editorDocumentRequestCount)
      .toBe(initialDocumentRequestCount + 1);
    await expect(page.getByRole('region', { name: 'Canvas workspace' })).toBeVisible();
    expect(exporterRequestCount).toBe(1);
    expect(editorDocumentRequestCount).toBe(initialDocumentRequestCount + 1);

    const downloadPromise = page.waitForEvent('download');
    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Export to' }).click();
    await page.getByRole('menuitem', { name: 'Powerpoint (.pptx)' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.pptx$/);
    expect(exporterRequestCount).toBe(2);
    expect(editorDocumentRequestCount).toBe(initialDocumentRequestCount + 1);
  });
});
