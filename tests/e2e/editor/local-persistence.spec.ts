import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor local persistence journey', () => {
  test('keeps the plain editor route fresh and restores a named browser-private project', async ({
    page,
  }) => {
    await installFakeOpfs(page);

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await editor.renameProject('E2E Persisted Deck');

    await page.getByRole('button', { name: 'Browser storage disabled' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Browser storage enabled' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Version history' })).toBeEnabled();

    await page.goto(new URL('/editor/', getServer().baseURL).toString());
    await expect(
      page.getByRole('button', { name: 'Edit project name Untitled Project' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Browser storage disabled' })).toBeVisible();

    const restoredProjectUrl = new URL('/editor/', getServer().baseURL);
    restoredProjectUrl.searchParams.set('project', 'E2E Persisted Deck');
    await page.goto(restoredProjectUrl.toString());
    await expect(
      page.getByRole('button', { name: 'Edit project name E2E Persisted Deck' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Browser storage enabled' })).toBeVisible();

    await page.getByRole('button', { name: 'Version history' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('complementary', { name: 'Version history' })).toBeVisible();
  });

  test('saves a named project into a picked local folder and keeps Save As usable', async ({
    page,
  }) => {
    await installFakeOpfs(page, { directoryPicker: true });

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await page.getByRole('button', { name: 'Persistence disabled' }).click();
    const setupPanel = page.getByRole('dialog', { name: 'Save local project' });
    await expect(setupPanel).toBeVisible();
    await setupPanel.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(setupPanel).toBeHidden();

    await page.getByRole('button', { name: 'Persistence disabled' }).click();
    await setupPanel.getByLabel('Project folder name').fill('');
    await expect(setupPanel.getByRole('button', { name: 'Choose folder' })).toBeDisabled();
    await setupPanel.getByLabel('Project folder name').fill('E2E Folder Deck');
    await setupPanel.getByRole('button', { name: 'Choose folder' }).click();

    await expect(page.getByRole('button', { name: 'Persistence enabled' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit project name E2E Folder Deck' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Version history' })).toBeEnabled();

    await editor.renameProject('E2E Folder Deck Renamed');
    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Save As...' }).click();
    await expect(page.getByRole('button', { name: 'Persistence enabled' })).toBeVisible();

    const persistedKeys = await page.evaluate(() =>
      Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
        .filter((key): key is string => Boolean(key))
        .filter((key) => key.includes('localstudio.e2e.opfs.file:')),
    );
    expect(persistedKeys).toEqual(
      expect.arrayContaining([
        expect.stringContaining('E2E Folder Deck Renamed/project.json'),
        expect.stringContaining('E2E Folder Deck Renamed/config/localstudio.json'),
      ]),
    );
  });
});
