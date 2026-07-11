import { type Page } from '@playwright/test';

export const stockMediaRoutes = {
  async install(page: Page): Promise<void> {
    await page.route('https://api.unsplash.com/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/download')) {
        await route.fulfill({
          contentType: 'application/json',
          json: { url: 'https://images.unsplash.com/e2e-photo.jpg' },
        });
        return;
      }
      await route.fulfill({
        contentType: 'application/json',
        json: {
          results: [
            {
              alt_description: 'E2E stock dashboard',
              height: 800,
              id: 'e2e-unsplash-photo',
              links: { download_location: 'https://api.unsplash.com/photos/e2e-unsplash-photo/download' },
              urls: {
                regular: 'https://images.unsplash.com/e2e-photo.jpg',
                small: 'https://images.unsplash.com/e2e-photo-small.jpg',
              },
              user: { links: { html: 'https://unsplash.com/@e2e' }, name: 'E2E Photographer' },
              width: 1200,
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
              images: {
                fixed_width: {
                  height: '113',
                  url: 'https://media.giphy.com/media/e2e/200w.gif',
                  width: '200',
                },
                original: {
                  height: '270',
                  mp4: 'https://media.giphy.com/media/e2e/giphy.mp4',
                  url: 'https://media.giphy.com/media/e2e/giphy.gif',
                  width: '480',
                },
              },
              title: 'E2E celebration',
              url: 'https://giphy.com/gifs/e2e',
              username: 'LocalStudio',
            },
          ],
          meta: { msg: 'OK', response_id: 'e2e', status: 200 },
          pagination: { count: 1, offset: 0, total_count: 1 },
        },
      });
    });
    await page.route('https://images.unsplash.com/**', async (route) => {
      await route.fulfill({
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lMFeWAAAAABJRU5ErkJggg==',
          'base64',
        ),
        contentType: 'image/png',
      });
    });
    await page.route('https://media.giphy.com/**', async (route) => {
      await route.fulfill({
        body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64'),
        contentType: 'image/gif',
      });
    });
  },
};
