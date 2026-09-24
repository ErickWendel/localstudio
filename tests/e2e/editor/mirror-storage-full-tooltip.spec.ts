import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

const STORAGE_FULL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>XMinioStorageFull</Code>
  <Message>Storage backend has reached its minimum free drive threshold. Please delete a few objects to proceed.</Message>
</Error>`;

async function installStorageFullMirrorRoute(page: Page) {
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
    await route.fulfill({
      contentType: 'application/xml',
      status: 507,
      body: STORAGE_FULL_XML,
    });
  });
}

test.describe('editor mirror storage-full tooltip', () => {
  test('explains a MinIO storage-full response on the mirror control', async ({ page }) => {
    await installFakeOpfs(page);
    await installStorageFullMirrorRoute(page);

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
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

    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('storage disk needs more free space');
    await expect(tooltip).toContainText('HTTP 507, XMinioStorageFull');
    await expect(tooltip).toContainText('not a bucket quota');
    await expect(tooltip).toContainText('Your file is fine');
    await expect(page.getByRole('button', { name: 'Mirror failed' })).toHaveAttribute(
      'aria-describedby',
      'mirror-failure-reason',
    );
  });
});
