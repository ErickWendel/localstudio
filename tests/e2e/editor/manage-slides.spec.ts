import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor manage slides journey', () => {
  test('adds, duplicates, renames, hides, moves, selects, and deletes slides', async ({ page }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await editor.openPagesPanel();
    const pagesPanel = page.getByRole('complementary', { name: 'Pages' });

    await pagesPanel.getByLabel('Add page').click();
    await expect(page.getByText('2 pages')).toBeVisible();
    await expect(page.getByText('2 / 2')).toBeVisible();

    await pagesPanel.getByRole('button', { name: 'Rename Slide 2' }).click();
    await page.getByLabel('Page 2 title').fill('Agenda');
    await page.getByLabel('Page 2 title').press('Enter');
    await expect(page.getByRole('article', { name: 'Page 2: Agenda' })).toBeVisible();

    await pagesPanel.getByRole('button', { name: 'Duplicate Agenda' }).click();
    await expect(page.getByText('3 pages')).toBeVisible();

    await pagesPanel.getByRole('button', { name: 'Hide Agenda', exact: true }).click();
    await expect(pagesPanel.getByRole('button', { name: 'Show Agenda', exact: true })).toBeVisible();
    await pagesPanel.getByRole('button', { name: 'Show Agenda', exact: true }).click();

    await pagesPanel.getByRole('button', { name: 'Move Agenda up', exact: true }).click();
    await pagesPanel.getByRole('button', { name: 'Select Slide 1' }).click();
    await expect(page.getByText(/1 \/ 3|2 \/ 3/)).toBeVisible();

    await pagesPanel.getByRole('button', { name: 'Delete Agenda', exact: true }).click();
    await expect(page.getByText('2 pages')).toBeVisible();
  });
});
