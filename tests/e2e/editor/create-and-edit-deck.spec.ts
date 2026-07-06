import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor create and edit deck journey', () => {
  test('creates a deck, edits content, manages a layer, and opens shortcuts', async ({ page }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.renameProject('E2E Product Deck');

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await expect(page.getByRole('button', { name: 'Add a little bit of body text', exact: true })).toBeVisible();

    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'Add a little bit of body text', exact: true }).click();
    await editor.openTool('Design');
    await page
      .getByRole('tablist', { name: 'Movie inspector sections' })
      .getByRole('tab', { name: 'Text' })
      .click();
    await page.getByRole('textbox', { name: 'Selected text content' }).fill('Launch metrics for Q3');
    await editor.openTool('Layout');
    await expect(page.getByRole('button', { name: 'Launch metrics for Q3', exact: true })).toBeVisible();

    await editor.openTool('Elements');
    await page.getByRole('button', { name: 'Add square' }).click();
    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'Background Shape', exact: true }).click();
    await page.getByRole('button', { name: 'Lock Background Shape' }).click();
    await page.getByRole('button', { name: 'Unlock Background Shape' }).click();
    await page.getByRole('button', { name: 'Hide Background Shape' }).click();
    await page.getByRole('button', { name: 'Show Background Shape' }).click();
    await page.getByRole('button', { name: 'Delete Background Shape' }).click();
    await expect(page.getByRole('button', { name: 'Background Shape', exact: true })).toBeHidden();

    await editor.openMenu('Edit');
    await page.getByRole('menuitem', { name: 'Undo' }).click();
    await expect(page.getByRole('button', { name: 'Background Shape', exact: true })).toBeVisible();
    await editor.openMenu('Edit');
    await page.getByRole('menuitem', { name: 'Redo' }).click();
    await expect(page.getByRole('button', { name: 'Background Shape', exact: true })).toBeHidden();

    await editor.openMenu('Help');
    await page.getByRole('menuitem', { name: 'Keyboard Shortcuts' }).click();
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    await page.getByRole('button', { name: 'Close keyboard shortcuts' }).click();
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeHidden();
  });
});
