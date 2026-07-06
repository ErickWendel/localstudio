import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor stock media integrations journey', () => {
  test('configures providers, searches stock media, and inserts an Unsplash result', async ({
    page,
  }) => {
    await page.route('https://api.unsplash.com/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/download')) {
        await route.fulfill({ contentType: 'application/json', json: { url: 'https://images.unsplash.com/e2e-photo.jpg' } });
        return;
      }
      await route.fulfill({
        contentType: 'application/json',
        json: {
          results: [
            {
              id: 'e2e-unsplash-photo',
              alt_description: 'E2E stock dashboard',
              width: 1200,
              height: 800,
              urls: {
                regular: 'https://images.unsplash.com/e2e-photo.jpg',
                small: 'https://images.unsplash.com/e2e-photo-small.jpg',
              },
              links: { download_location: 'https://api.unsplash.com/photos/e2e-unsplash-photo/download' },
              user: { name: 'E2E Photographer', links: { html: 'https://unsplash.com/@e2e' } },
            },
          ],
        },
      });
    });
    await page.route('https://api.giphy.com/**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          data: [
            {
              id: 'e2e-giphy-gif',
              title: 'E2E celebration',
              username: 'LocalStudio',
              url: 'https://giphy.com/gifs/e2e',
              images: {
                original: {
                  url: 'https://media.giphy.com/media/e2e/giphy.gif',
                  mp4: 'https://media.giphy.com/media/e2e/giphy.mp4',
                  width: '480',
                  height: '270',
                },
                fixed_width: {
                  url: 'https://media.giphy.com/media/e2e/200w.gif',
                  width: '200',
                  height: '113',
                },
              },
            },
          ],
          meta: { msg: 'OK', response_id: 'e2e', status: 200 },
          pagination: { count: 1, offset: 0, total_count: 1 },
        },
      });
    });
    await page.route('https://images.unsplash.com/**', async (route) => {
      await route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lMFeWAAAAABJRU5ErkJggg==',
          'base64',
        ),
      });
    });
    await page.route('https://media.giphy.com/**', async (route) => {
      await route.fulfill({
        contentType: 'image/gif',
        body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64'),
      });
    });

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await page
      .getByRole('contentinfo', { name: 'Editor footer controls' })
      .getByRole('button', { name: 'Mirror settings' })
      .click();
    await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Media integrations' }).click();
    await page.getByRole('textbox', { name: 'Unsplash access key' }).fill('e2e-unsplash-key');
    await page.getByRole('textbox', { name: 'GIPHY API key' }).fill('e2e-giphy-key');
    await page.getByRole('button', { name: 'Save media integrations' }).click();
    await expect(page.getByRole('dialog', { name: 'Media integrations' })).toBeHidden();

    await editor.openTool('Elements');
    await page.getByRole('textbox', { name: 'Search Unsplash images' }).fill('dashboard');
    await page.getByRole('button', { name: 'Search Unsplash images submit' }).click();
    await expect(page.getByRole('button', { name: 'Insert image by E2E Photographer' })).toBeVisible();
    await page.getByRole('button', { name: 'Insert image by E2E Photographer' }).click();
    await editor.openTool('Layout');
    await expect(page.getByRole('button', { name: 'E2E stock dashboard', exact: true })).toBeVisible();

    await editor.openTool('Elements');
    await page.getByRole('textbox', { name: 'Search GIPHY GIFs' }).fill('celebration');
    await page.getByRole('button', { name: 'Search GIPHY GIFs submit' }).click();
    await expect(page.getByRole('button', { name: 'Insert GIF E2E celebration' })).toBeVisible();
  });
});
