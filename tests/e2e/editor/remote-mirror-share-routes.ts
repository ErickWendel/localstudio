import { type BrowserContext } from '@playwright/test';

export type RemoteMirrorStoredObject = { body: Buffer; contentType: string };

export const remoteMirrorShareRoutes = {
  async install(context: BrowserContext): Promise<Map<string, RemoteMirrorStoredObject>> {
    const storedObjects = new Map<string, RemoteMirrorStoredObject>();
    await context.route('http://localhost:9000/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const objectKey = decodeURIComponent(url.pathname.replace(/^\/localstudio\/?/, ''));
      if (request.method() === 'GET' && url.searchParams.get('list-type')) {
        await route.fulfill({
          body: '<?xml version="1.0"?><ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>',
          contentType: 'application/xml',
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
    return storedObjects;
  },
};
