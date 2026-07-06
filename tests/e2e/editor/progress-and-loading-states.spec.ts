import { EditorAppPage } from '../pages/editor-app.page';
import { createTinyPptxFixture } from '../support/test-assets';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor progress and loading states journey', () => {
  test('shows import progress and stock-media loading/empty states', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showOpenFilePicker', {
        configurable: true,
        value: undefined,
      });
    });

    let releaseUnsplashSearch: (() => void) | undefined;
    const unsplashSearchCanFinish = new Promise<void>((resolve) => {
      releaseUnsplashSearch = resolve;
    });
    await page.route('https://api.unsplash.com/**', async (route) => {
      if (!route.request().url().includes('/search/photos')) {
        await route.fulfill({ contentType: 'application/json', json: { url: 'https://images.unsplash.com/e2e-empty.jpg' } });
        return;
      }
      await unsplashSearchCanFinish;
      await route.fulfill({
        contentType: 'application/json',
        json: { results: [] },
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
    await expect(page.getByRole('status')).toContainText(
      /Reading PowerPoint package|Inspecting PPTX structure|Extracting text and images|Downloading fonts|Mapping animations|Opening deck/i,
    );
    await expect(page.getByRole('button', { name: 'Edit project name localstudio-e2e-import' })).toBeVisible({
      timeout: 60_000,
    });

    await page
      .getByRole('contentinfo', { name: 'Editor footer controls' })
      .getByRole('button', { name: 'Mirror settings' })
      .click();
    await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Media integrations' }).click();
    await page.getByRole('textbox', { name: 'Unsplash access key' }).fill('e2e-unsplash-key');
    await page.getByRole('button', { name: 'Save media integrations' }).click();
    await expect(page.getByRole('dialog', { name: 'Media integrations' })).toBeHidden();

    await editor.openTool('Elements');
    await page.getByRole('textbox', { name: 'Search Unsplash images' }).fill('nothing');
    await page.getByRole('button', { name: 'Search Unsplash images submit' }).click();
    await expect(page.getByText('Loading images...')).toBeVisible();
    releaseUnsplashSearch?.();
    await expect(page.getByText('No images found.')).toBeVisible();
  });
});
