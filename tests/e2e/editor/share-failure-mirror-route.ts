import { type Page } from '@playwright/test';

export type ShareFailureMirrorRouteController = {
  recoverConnection(): void;
};

export const shareFailureMirrorRoute = {
  async install(page: Page): Promise<ShareFailureMirrorRouteController> {
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

    return {
      recoverConnection() {
        failMirrorConnection = false;
      },
    };
  },
};
