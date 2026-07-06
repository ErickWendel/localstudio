import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor local persistence journey', () => {
  test('saves a browser-private project, reloads it, and opens version history', async ({ page }) => {
    await page.addInitScript(installFakeOpfs);

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await editor.renameProject('E2E Persisted Deck');

    await page.getByRole('button', { name: 'Browser storage disabled' }).click();
    await expect(page.getByRole('button', { name: 'Browser storage enabled' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Version history' })).toBeEnabled();

    await page.goto(new URL('/editor/', getServer().baseURL).toString());
    await expect(page.getByRole('button', { name: 'Edit project name E2E Persisted Deck' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Browser storage enabled' })).toBeVisible();

    await page.getByRole('button', { name: 'Version history' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('complementary', { name: 'Version history' })).toBeVisible();
  });
});
