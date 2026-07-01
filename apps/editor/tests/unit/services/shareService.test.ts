import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectDocument } from '../../../src/domain/model';
import { createSampleProject } from '../../../src/domain/sampleProject';
import { MinioMirrorService, type MinioMirrorConfig } from '../../../src/services/minioMirrorService';
import { BrowserShareService } from '../../../src/services/shareService';

const config: MinioMirrorConfig = {
  accessKey: 'localstudio',
  bucket: 'localstudio',
  endpoint: 'http://localhost:9000',
  pathStyle: true,
  publicBaseUrl: 'http://localhost:9000/localstudio',
  region: 'us-east-1',
  secretKey: 'localstudio123',
  prefix: 'mirrors',
};

interface PublicSharePayloadFixture {
  schemaVersion: 1;
  shareId: string;
  project: ProjectDocument;
}

function getRequestUrl(input: RequestInfo | URL) {
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return input;
}

function createProjectWithInlineAsset(): ProjectDocument {
  const project = createSampleProject();
  project.assets['asset-inline'] = {
    id: 'asset-inline',
    type: 'image',
    mimeType: 'image/png',
    name: 'Inline chart',
    objectUrl: 'data:image/png;base64,aGVsbG8=',
    storage: 'inline',
  };
  project.elements['inline-image'] = {
    id: 'inline-image',
    type: 'image',
    assetId: 'asset-inline',
    x: 80,
    y: 120,
    width: 320,
    height: 180,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
  };
  project.pages[0]?.elementIds.push('inline-image');
  return project;
}

describe('BrowserShareService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
  });

  it('publishes a public share payload and local assets to MinIO', async () => {
    const uploadedBodies = new Map<string, Blob>();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (init?.method === 'GET') {
        return Promise.resolve(new Response('', { status: 404 }));
      }
      if (init?.method === 'PUT') {
        uploadedBodies.set(url, init.body as Blob);
        return Promise.resolve(new Response('', { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });
    const mirrorService = new MinioMirrorService({ fetch: fetchMock });
    mirrorService.saveConfig(config);
    const service = new BrowserShareService({
      mirrorService,
      origin: 'https://localstudio.test',
    });

    const share = await service.createShare(createProjectWithInlineAsset());

    expect(share.shareId).toBe('00000000-0000-4000-8000-000000000001');
    const publicUrl = new URL(share.publicUrl);
    expect(publicUrl.pathname).toBe('/editor/s/00000000-0000-4000-8000-000000000001');
    expect(publicUrl.searchParams.get('src')).toBe(
      'http://localhost:9000/localstudio/mirrors/public-shares/00000000-0000-4000-8000-000000000001/share.json',
    );
    expect(share.embedHtml).toContain('/editor/embed/00000000-0000-4000-8000-000000000001');
    expect(share.embedHtml).toContain('src=');

    const putUrls = Array.from(uploadedBodies.keys());
    expect(putUrls).toContain(
      'http://localhost:9000/localstudio/mirrors/public-shares/00000000-0000-4000-8000-000000000001/assets/asset-inline.png',
    );
    expect(putUrls).toContain(
      'http://localhost:9000/localstudio/mirrors/public-shares/00000000-0000-4000-8000-000000000001/share.json',
    );

    const sharePayload = JSON.parse(
      await uploadedBodies
        .get(
          'http://localhost:9000/localstudio/mirrors/public-shares/00000000-0000-4000-8000-000000000001/share.json',
        )!
        .text(),
    ) as unknown as PublicSharePayloadFixture;
    expect(sharePayload).toMatchObject({
      schemaVersion: 1,
      shareId: '00000000-0000-4000-8000-000000000001',
      project: {
        name: 'Untitled AI Deck',
        assets: {
          'asset-inline': {
            objectUrl:
              'http://localhost:9000/localstudio/mirrors/public-shares/00000000-0000-4000-8000-000000000001/assets/asset-inline.png',
            storage: 'remote',
          },
        },
      },
    });
  });

  it('rejects publishing when MinIO config is missing', async () => {
    const service = new BrowserShareService({
      mirrorService: new MinioMirrorService({ fetch: vi.fn() }),
      origin: 'https://localstudio.test',
    });

    await expect(service.createShare(createSampleProject())).rejects.toThrow(
      'Public sharing requires active external storage.',
    );
  });
});
