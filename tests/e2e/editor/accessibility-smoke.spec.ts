import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor accessibility smoke journey', () => {
  test('opens dialogs and panels with named controls that can receive keyboard focus', async ({ page }) => {
    await installFakeOpfs(page, { directoryPicker: true });
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.openMenu('Help');
    await page.getByRole('menuitem', { name: 'Keyboard Shortcuts' }).click();
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    await page.getByRole('button', { name: 'Close keyboard shortcuts' }).focus();
    await expect(page.getByRole('button', { name: 'Close keyboard shortcuts' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeHidden();

    await page.getByRole('button', { name: 'Share' }).click();
    const localSave = page.getByRole('dialog', { name: 'Save local project' });
    await expect(localSave).toBeVisible();
    await localSave.getByRole('button', { name: 'Choose folder' }).click();
    const mirrorSettings = page.getByRole('dialog', { name: 'Mirror settings' });
    await expect(mirrorSettings).toBeVisible();
    await page.getByRole('button', { name: 'Close mirror settings' }).focus();
    await expect(page.getByRole('button', { name: 'Close mirror settings' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(mirrorSettings).toBeHidden();
  });
});
