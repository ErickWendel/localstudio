import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { googleFontDownloadFixtures } from './google-font-download-fixtures';

const getServer = withIsolatedDevServer(test);

test.describe('editor font download journeys', () => {
  test('searches downloadable fonts and reports a font download failure without crashing', async ({
    page,
  }) => {
    await googleFontDownloadFixtures.forceDownloadableFontPath(page);
    await googleFontDownloadFixtures.mockFailedDownload(page);

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Design');
    await page.getByRole('button', { name: 'Bold selected text' }).click();
    await page.getByRole('button', { name: 'Download additional font' }).click();
    await page.getByLabel('Search downloadable fonts').fill('Montserrat');
    await page.getByRole('button', { name: 'Download Montserrat' }).click();

    await expect(page.getByRole('status')).toContainText(
      'Could not download Montserrat 700: no downloadable woff2 file was found',
    );
    await expect(page.getByRole('heading', { name: 'LocalStudio.dev' })).toBeVisible();
    await expect(page.getByLabel('Selected text font', { exact: true })).toBeVisible();
  });

  test('downloads and applies a Google Font through the real font importer path', async ({ page }) => {
    await googleFontDownloadFixtures.forceDownloadableFontPath(page);
    await googleFontDownloadFixtures.mockSuccessfulDownload(page);

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Design');
    await page.getByRole('button', { name: 'Bold selected text' }).click();
    await page.getByRole('button', { name: 'Download additional font' }).click();
    await page.getByLabel('Search downloadable fonts').fill('Montserrat');
    await page.getByRole('button', { name: 'Download Montserrat' }).click();

    await expect(page.getByRole('status')).toContainText('Montserrat downloaded and applied');
    await expect(page.getByLabel('Selected text font', { exact: true })).toHaveValue('Montserrat');
  });
});
