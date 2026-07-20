import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor share and storage journey', () => {
  test('opens share and storage surfaces without connecting to remote storage', async ({ page }) => {
    await installFakeOpfs(page, { directoryPicker: true });
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('button', { name: 'Translation path options' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await page.getByRole('button', { name: 'Share', exact: true }).click();
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

  test('shows mirror sync progress while remote storage uploads are in flight', async ({ page }) => {
    await installFakeOpfs(page, { directoryPicker: true });
    let releaseMirrorUpload: (() => void) | undefined;
    const mirrorUploadCanFinish = new Promise<void>((resolve) => {
      releaseMirrorUpload = resolve;
    });

    await page.route('http://localhost:9000/**', async (route) => {
      const request = route.request();
      const corsHeaders = {
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,PUT,OPTIONS',
        'access-control-allow-origin': '*',
      };
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ headers: corsHeaders, status: 204 });
        return;
      }
      if (request.method() === 'GET' && request.url().endsWith('localstudio-mirror.json')) {
        await route.fulfill({ headers: corsHeaders, status: 404 });
        return;
      }
      if (request.method() === 'PUT') {
        await mirrorUploadCanFinish;
        await route.fulfill({ headers: corsHeaders, status: 200 });
        return;
      }
      await route.fulfill({ headers: corsHeaders, status: 404 });
    });

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const localSave = page.getByRole('dialog', { name: 'Save local project' });
    await expect(localSave).toBeVisible();
    await localSave.getByRole('button', { name: 'Choose folder' }).click();

    const mirrorSettings = page.getByRole('dialog', { name: 'Mirror settings' });
    await expect(mirrorSettings).toBeVisible();
    await mirrorSettings.getByRole('button', { name: 'Save settings' }).click();

    const mirrorProgress = page.getByRole('progressbar', { name: 'Mirror sync progress' });
    await expect(mirrorProgress).toBeVisible();
    await expect(mirrorProgress).toHaveAttribute('aria-valuenow', /\d+/);

    releaseMirrorUpload?.();
    await expect(mirrorProgress).toBeHidden({ timeout: 15_000 });
  });
});
