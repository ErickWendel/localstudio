import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor share and storage journey', () => {
  test('opens share and storage surfaces without connecting to remote storage', async ({ page }) => {
    await installFakeOpfs(page, { directoryPicker: true });
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await page.getByRole('button', { name: 'Share' }).click();
    const localSave = page.getByRole('dialog', { name: 'Save local project' });
    await expect(localSave).toBeVisible();
    await localSave.getByRole('button', { name: 'Choose folder' }).click();

    const mirrorSettings = page.getByRole('dialog', { name: 'Mirror settings' });
    await expect(mirrorSettings).toBeVisible();
    await expect(mirrorSettings.getByRole('heading', { name: 'Mirror project storage' })).toBeVisible();
    await expect(mirrorSettings.getByRole('heading', { name: 'Mirror my local fonts' })).toBeVisible();
    await mirrorSettings.getByRole('button', { name: 'Close mirror settings' }).focus();
    await page.keyboard.press('Enter');
    await expect(mirrorSettings).toBeHidden();

    await expect(page.getByRole('button', { name: 'Version history' })).toBeEnabled();
    await page.getByRole('button', { name: 'Mirror settings' }).click();
    await expect(page.getByRole('dialog', { name: /settings|Mirror settings/i })).toBeVisible();
  });
});
