import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor remote mirror and public share journey', () => {
  test('syncs to mocked S3-compatible storage and creates public share/embed links', async ({
    context,
    page,
  }) => {
    await page.addInitScript(installFakeOpfs);
    await context.grantPermissions(['clipboard-write'], { origin: getServer().baseURL });
    await page.route('http://localhost:9000/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === 'GET' && url.searchParams.get('list-type')) {
        await route.fulfill({
          contentType: 'application/xml',
          body: '<?xml version="1.0"?><ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>',
        });
        return;
      }
      if (request.method() === 'GET') {
        await route.fulfill({ status: 404, body: '' });
        return;
      }
      await route.fulfill({ status: 200, body: '' });
    });

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await editor.renameProject('E2E Mirrored Deck');
    await page.getByRole('button', { name: 'Browser storage disabled' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Browser storage enabled' })).toBeVisible();

    await page.getByRole('contentinfo', { name: 'Editor footer controls' }).getByRole('button', { name: 'Mirror settings' }).click();
    await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Mirror settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Mirror settings' })).toBeVisible();
    await page.getByRole('button', { name: 'Enable mirroring' }).click();
    await expect(page.getByText(/Connection is ready|MinIO connection is ready/)).toBeVisible();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Mirror settings' })).toBeHidden();
    await expect(page.getByRole('button', { name: /Mirror up to date|Mirror syncing|Mirror ready/ })).toBeVisible();

    await page.getByRole('button', { name: 'Share' }).click();
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByText('Copied')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Published share links')).toContainText('Public URL');
    await expect(page.getByRole('button', { name: 'Public view link', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Embed code', exact: true })).toBeEnabled();
  });
});
