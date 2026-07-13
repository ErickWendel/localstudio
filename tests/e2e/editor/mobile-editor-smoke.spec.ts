import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor responsive smoke journey', () => {
  test('blocks the editor on a phone-sized viewport with desktop guidance', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${getServer().baseURL}/editor/?newProject=1`);

    await expect(
      page.getByRole('heading', { name: 'Open this workspace on a desktop screen.' }),
    ).toBeVisible();
    await expect(page.getByText('Mobile editing is disabled')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to LocalStudio' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Canvas workspace' })).toHaveCount(0);
  });

  test('keeps core editor chrome usable on a tablet-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Canvas workspace' })).toBeVisible();
    await editor.openTool('Text');
    await expect(page.getByRole('button', { name: 'Add a text box' })).toBeVisible();
    await page.getByRole('button', { name: 'Toggle notes panel' }).click();
    await expect(page.getByRole('region', { name: 'Speaker notes editor' })).toBeVisible();
    await page.getByRole('button', { name: 'Toggle pages panel' }).click();
    await expect(page.getByText('1 / 1')).toBeVisible();
  });
});
