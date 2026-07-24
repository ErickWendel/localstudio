import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor accessibility smoke journey', () => {
  test('opens dialogs and panels with named controls that can receive keyboard focus', async ({ page }) => {
    await installFakeOpfs(page, { directoryPicker: true });
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    const keyboardShortcutsDialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await editor.openMenu('Help');
      await page
        .getByRole('menuitem', { name: 'Keyboard Shortcuts' })
        .click({ timeout: 5000 })
        .catch(() => undefined);
      if (await keyboardShortcutsDialog.isVisible().catch(() => false)) break;
      await page.keyboard.press('Escape').catch(() => undefined);
    }
    await expect(keyboardShortcutsDialog).toBeVisible();
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
