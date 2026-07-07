import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor responsive smoke journey', () => {
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
