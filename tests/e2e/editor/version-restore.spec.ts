import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor version restore journey', () => {
  test('saves multiple browser-private versions and restores an older one', async ({ page }) => {
    await page.addInitScript(installFakeOpfs);

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.renameProject('E2E Version One');
    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'Add a little bit of body text', exact: true }).click();
    await editor.openTool('Design');
    await page
      .getByRole('tablist', { name: 'Movie inspector sections' })
      .getByRole('tab', { name: 'Text' })
      .click();
    await page.getByRole('textbox', { name: 'Selected text content' }).fill('Version one content');
    await page.getByRole('button', { name: 'Browser storage disabled' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Browser storage enabled' })).toBeVisible();

    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Version history' })).toBeEnabled();

    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'Version one content', exact: true }).click();
    await editor.openTool('Design');
    await page
      .getByRole('tablist', { name: 'Movie inspector sections' })
      .getByRole('tab', { name: 'Text' })
      .click();
    await page.getByRole('textbox', { name: 'Selected text content' }).fill('Version two content');
    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Save', exact: true }).click();

    await page.getByRole('button', { name: 'Version history' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('complementary', { name: 'Version history' })).toBeVisible();
    const versionEntries = page.locator('.version-history-entry');
    await expect.poll(async () => versionEntries.count()).toBeGreaterThanOrEqual(2);
    await versionEntries.last().click();
    await page.getByRole('button', { name: 'Restore this version' }).click();

    await editor.openTool('Layout');
    await expect(page.getByRole('button', { name: 'Version two content', exact: true })).toBeHidden();
  });
});
