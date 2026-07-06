import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor share and storage journey', () => {
  test('opens share and storage surfaces without connecting to remote storage', async ({ page }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page.getByRole('complementary', { name: 'Share design panel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeDisabled();
    await expect(page.getByText('Public links cannot be created without remote storage.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Present', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Public view link', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Embed code', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Close share panel' }).click();

    await expect(page.getByRole('button', { name: 'Version history' })).toBeDisabled();
    await page.getByRole('button', { name: 'Mirror settings' }).click();
    await expect(page.getByRole('dialog', { name: /settings|Mirror settings/i })).toBeVisible();
  });
});
