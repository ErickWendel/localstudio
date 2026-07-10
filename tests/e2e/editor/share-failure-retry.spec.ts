import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor share and mirror failure recovery journey', () => {
  test('recovers from mirror connection failure and reports clipboard copy failure', async ({
    page,
  }) => {
    await page.addInitScript(installFakeOpfs);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async () => {
            await Promise.resolve();
            throw new Error('Clipboard write denied by test browser');
          },
        },
      });
    });

    let failMirrorConnection = true;
    await page.route('http://localhost:9000/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (failMirrorConnection) {
        await route.fulfill({ status: 503, body: 'offline' });
        return;
      }
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
    await editor.renameProject('E2E Share Failure');
    await page.getByRole('button', { name: 'Browser storage disabled' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Browser storage enabled' })).toBeVisible();

    await page
      .getByRole('contentinfo', { name: 'Editor footer controls' })
      .getByRole('button', { name: 'Mirror settings' })
      .click();
    await page
      .getByRole('dialog', { name: 'Settings' })
      .getByRole('button', { name: 'Mirror settings' })
      .click();
    await page.getByRole('button', { name: 'Enable mirroring' }).click();
    await expect(page.getByText(/Could not list MinIO mirrors \(503\)/)).toBeVisible();

    failMirrorConnection = false;
    await page.getByRole('button', { name: 'Test connection' }).click();
    await expect(
      page.getByText(/S3-compatible connection is ready|Connection is ready/),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Mirror settings' })).toBeHidden();

    await expect(
      page.getByRole('button', { name: /Mirror up to date|Mirror syncing|Mirror ready/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByText('Share failed')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Clipboard write denied by test browser')).toBeVisible();
  });
});
