import { type BrowserContext } from '@playwright/test';

import { remoteMirrorImportConfig } from './remote-mirror-import-config';
import { remoteMirrorImportProject } from './remote-mirror-import-project';

export const remoteMirrorImportRoutes = {
  async install(context: BrowserContext): Promise<void> {
    const project = remoteMirrorImportProject.create();
    const projectJson = JSON.stringify(project, null, 2);
    const manifest = {
      files: {
        'project.json': {
          checksum: 'e2e',
          path: 'project.json',
          size: Buffer.byteLength(projectJson),
        },
      },
      projectId: project.id,
      projectName: project.name,
      publicBaseUrl: remoteMirrorImportConfig.publicBaseUrl,
      schemaVersion: 1,
      syncedAt: project.updatedAt,
    };

    await context.route('http://localhost:9000/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const objectKey = decodeURIComponent(url.pathname.replace(/^\/localstudio\/?/, ''));
      if (request.method() === 'GET' && url.searchParams.get('list-type')) {
        await route.fulfill({
          body:
            '<?xml version="1.0"?><ListBucketResult><IsTruncated>false</IsTruncated>' +
            '<Contents><Key>mirrors/remote-deck/localstudio-mirror.json</Key></Contents>' +
            '</ListBucketResult>',
          contentType: 'application/xml',
        });
        return;
      }
      if (request.method() === 'GET' && objectKey === 'mirrors/remote-deck/localstudio-mirror.json') {
        await route.fulfill({ contentType: 'application/json', json: manifest });
        return;
      }
      if (request.method() === 'GET' && objectKey === 'mirrors/remote-deck/project.json') {
        await route.fulfill({ body: projectJson, contentType: 'application/json' });
        return;
      }
      await route.fulfill({ status: 404, body: '' });
    });
  },
};
