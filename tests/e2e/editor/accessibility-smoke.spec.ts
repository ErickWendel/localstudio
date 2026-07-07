import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor accessibility smoke journey', () => {
  test('opens dialogs and panels with named controls that can receive keyboard focus', async ({ page }) => {
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
    await expect(page.getByRole('complementary', { name: 'Share design panel' })).toBeVisible();
    await page.getByRole('button', { name: 'Close share panel' }).focus();
    await expect(page.getByRole('button', { name: 'Close share panel' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('complementary', { name: 'Share design panel' })).toBeHidden();
  });
});
