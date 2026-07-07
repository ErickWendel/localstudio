import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);
const modifierKey = process.platform === 'darwin' ? 'Meta' : 'Control';

test.describe('editor keyboard editing journey', () => {
  test('copies, pastes, deletes, and restores a selected text layer with shortcuts', async ({ page }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Layout');
    const textLayers = page.getByRole('button', { name: 'Add a little bit of body text', exact: true });
    await expect(textLayers).toHaveCount(1);
    await textLayers.first().click();

    await page.keyboard.press(`${modifierKey}+C`);
    await page.keyboard.press(`${modifierKey}+V`);
    await expect(textLayers).toHaveCount(2);

    await page.keyboard.press('Delete');
    await expect(textLayers).toHaveCount(1);

    await page.keyboard.press(`${modifierKey}+Z`);
    await expect(textLayers).toHaveCount(2);
  });
});
