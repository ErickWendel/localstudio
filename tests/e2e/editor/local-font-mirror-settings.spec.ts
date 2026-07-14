import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('local font mirror settings', () => {
  test('routes public share setup into mirror settings with local font mirroring guidance', async ({
    page,
  }) => {
    await installFakeOpfs(page, { directoryPicker: true });

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await page.evaluate(() => {
      window.localStorage.setItem(
        'localstudio.e2e.opfs.file:localstudio-e2e-root/AcmeSans-Regular.woff2',
        'fake-font-file',
      );
    });

    await page.getByRole('button', { name: 'Share' }).click();
    const localSave = page.getByRole('dialog', { name: 'Save local project' });
    await expect(localSave).toBeVisible();
    await localSave.getByRole('button', { name: 'Choose folder' }).click();

    const mirrorSettings = page.getByRole('dialog', { name: 'Mirror settings' });
    await expect(mirrorSettings).toBeVisible();
    await expect(mirrorSettings.getByRole('heading', { name: 'Mirror my local fonts' })).toBeVisible();
    await expect(mirrorSettings).toContainText('Public viewers need those font files mirrored to storage');
    await expect(mirrorSettings).toContainText(/Usual font folder for this system:/);
    const localFontMirroring = mirrorSettings.getByRole('region', { name: 'Local font mirroring' });
    await expect(localFontMirroring.getByRole('checkbox')).toBeVisible();
    await expect(localFontMirroring.getByRole('button', { name: 'Choose font folder' })).toBeVisible();
    await expect(localFontMirroring.getByRole('button', { name: 'Choose font files' })).toHaveCount(0);

    await localFontMirroring.getByRole('checkbox').focus();
    await page.keyboard.press('Space');
    await expect(localFontMirroring.getByRole('button', { name: /Folder: localstudio-e2e-root/ })).toBeVisible();
    await page.mouse.click(760, 120);
    await expect(mirrorSettings).toBeHidden();

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Design');
    const fontSelect = page.getByLabel('Selected text font', { exact: true });
    await page.getByLabel('Selected text font', { exact: true }).click();
    await page.getByLabel('Search downloadable fonts').fill('Acme');
    const localFontResult = page.getByRole('button', { name: 'Add Acme Sans from local fonts' });
    await expect(localFontResult).toBeVisible();
    await expect(localFontResult.locator('.ew-ellipsis')).toHaveCSS('font-family', /Acme Sans/);
    await localFontResult.click();
    await expect(page.getByRole('status')).toContainText('Acme Sans added to mirrored fonts');
    await expect(fontSelect).toContainText('Acme Sans');
  });
});
