import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor remote mirror and public share journey', () => {
  test('syncs to mocked S3-compatible storage and creates public share/embed links', async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);
    await page.addInitScript(installFakeOpfs);
    await context.grantPermissions(['clipboard-write'], { origin: getServer().baseURL });
    const storedObjects = new Map<string, { body: Buffer; contentType: string }>();
    await context.route('http://localhost:9000/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const objectKey = decodeURIComponent(url.pathname.replace(/^\/localstudio\/?/, ''));
      if (request.method() === 'GET' && url.searchParams.get('list-type')) {
        await route.fulfill({
          contentType: 'application/xml',
          body: '<?xml version="1.0"?><ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>',
        });
        return;
      }
      if (request.method() === 'GET') {
        const storedObject = storedObjects.get(objectKey);
        if (storedObject) {
          await route.fulfill({
            body: storedObject.body,
            contentType: storedObject.contentType,
          });
          return;
        }
        await route.fulfill({ status: 404, body: '' });
        return;
      }
      if (request.method() === 'PUT') {
        storedObjects.set(objectKey, {
          body: request.postDataBuffer() ?? Buffer.from(''),
          contentType: request.headers()['content-type'] ?? 'application/octet-stream',
        });
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

    const publicUrl = await page.getByLabel('Published share links').getByRole('textbox').first().inputValue();
    expect(publicUrl).toContain('share=');
    expect(publicUrl).toContain('src=');

    const publicPage = await context.newPage();
    await publicPage.goto(publicUrl);
    await expect(publicPage.getByRole('main', { name: 'Public presentation' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(publicPage.getByText('1 / 1')).toBeVisible();

    const embedHtml = await page.getByLabel('Published share links').getByRole('textbox').nth(1).inputValue();
    const embedSrc = embedHtml.match(/src="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
    expect(embedSrc).toBeTruthy();
    const embedPage = await context.newPage();
    await embedPage.goto(embedSrc!);
    await expect(embedPage.getByRole('main', { name: 'Embedded shared deck' })).toBeVisible({
      timeout: 30_000,
    });
  });
});
