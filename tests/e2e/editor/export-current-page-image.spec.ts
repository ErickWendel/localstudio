import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

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
  });
});
