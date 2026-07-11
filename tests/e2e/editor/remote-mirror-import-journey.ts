import type { BrowserContext, Page } from '@playwright/test';
import type { ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect } from '../support/journey-test';

const mirrorConfig = {
  accessKey: 'localstudio',
  bucket: 'localstudio',
  endpoint: 'http://localhost:9000',
  pathStyle: true,
  prefix: 'mirrors',
  publicBaseUrl: 'http://localhost:9000/localstudio',
  region: 'us-east-1',
  secretKey: 'localstudio123',
};

export const remoteMirrorImportJourney = {
  async run(context: BrowserContext, page: Page, baseURL: string): Promise<void> {
    await page.addInitScript(installFakeOpfs);
    await page.addInitScript((config) => {
      window.localStorage.setItem('localstudio.minioMirror.config', JSON.stringify(config));
    }, mirrorConfig);

    await installRemoteImportRoutes(context);

    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Import' }).click();
    await page.getByRole('menuitem', { name: 'Remote' }).click();
    await expect(page.getByRole('dialog', { name: 'Import remote project' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Remote mirrored projects' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Import Remote Mirror Deck' }).click();

    await expect(page.getByRole('button', { name: 'Edit project name Remote Mirror Deck' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: 'Rename Remote Slide' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Import remote project' })).toBeHidden();
  },
};

async function installRemoteImportRoutes(context: BrowserContext): Promise<void> {
  const project = createRemoteProject();
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
    publicBaseUrl: mirrorConfig.publicBaseUrl,
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
}

function createRemoteProject(): ProjectDocument {
  const now = '2026-07-07T00:00:00.000Z';
  return {
    assets: {},
    createdAt: now,
    elements: {
      'remote-title': {
        align: 'center',
        fill: '#37FD76',
        fontFamily: 'Open Sans',
        fontSize: 76,
        fontWeight: 800,
        height: 140,
        id: 'remote-title',
        locked: false,
        opacity: 1,
        rotation: 0,
        text: 'Imported from remote mirror',
        type: 'text',
        visible: true,
        width: 1200,
        x: 360,
        y: 360,
      },
    },
    id: 'project-remote-import',
    name: 'Remote Mirror Deck',
    pages: [
      {
        background: { color: '#050D10', type: 'color' },
        elementIds: ['remote-title'],
        height: 1080,
        id: 'remote-page-1',
        name: 'Remote Slide',
        width: 1920,
      },
    ],
    updatedAt: now,
  };
}
