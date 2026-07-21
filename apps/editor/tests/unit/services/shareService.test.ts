import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectDocument } from '../../../src/domain/documents/model';
import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { minioMirrorService } from '../../../src/services/mirror/minioMirrorService';
import type { MinioMirrorConfig } from '../../../src/services/mirror/minioMirrorService';
import { BrowserShareService } from '../../../src/services/sharing/shareService';

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
  const project = sampleProject.createSampleProject();
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

function createProjectWithInlineFont(): ProjectDocument {
  const project = createProjectWithInlineAsset();
  project.fonts = {
    acme: {
      id: 'acme',
      family: 'Acme Sans',
      requestedFamily: 'Acme Sans',
      source: 'uploaded',
      fontStyle: 'normal',
      fontWeight: 700,
      mimeType: 'font/woff2',
      fileName: 'acme-sans.woff2',
      storage: 'inline',
      objectUrl: 'data:font/woff2;base64,Zm9udA==',
    },
  };
  return project;
}

function createProjectWithRecording(): ProjectDocument {
  const project = createProjectWithInlineAsset();
  project.recordings = {
    recording1: {
      id: 'recording1',
      name: 'Presenter recording',
      createdAt: '2026-07-18T12:00:00.000Z',
      updatedAt: '2026-07-18T12:00:00.000Z',
      durationMs: 2400,
      language: 'en',
      modelPresetId: 'web-speech-api',
      audio: {
        mimeType: 'audio/webm;codecs=opus',
        objectUrl: 'data:audio/webm;base64,YXVkaW8=',
        storage: 'inline',
      },
      segments: [
        {
          id: 'segment1',
          text: 'The roadmap includes transcript chat.',
          startMs: 0,
          endMs: 2400,
          final: true,
        },
      ],
    },
  };
  return project;
}

describe('BrowserShareService', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('publishes a mirror-backed public share payload without re-uploading assets', async () => {
    const uploadedBodies = new Map<string, Blob>();
    const progressEvents: Array<{ current: number; total: number; label: string }> = [];
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
    const mirrorService = new minioMirrorService.MinioMirrorService({ fetch: fetchMock });
    mirrorService.saveConfig(config);
    const service = new BrowserShareService({
      mirrorService,
      origin: 'https://localstudio.test',
    });

    const share = await service.createShare(createProjectWithInlineAsset(), {
      onProgress: (progress) => progressEvents.push(progress),
    });

    expect(share.shareId).toBe('project-project-1');
    const publicUrl = new URL(share.publicUrl);
    expect(publicUrl.pathname).toBe('/editor/');
    expect(publicUrl.searchParams.get('share')).toBe('project-project-1');
    expect(publicUrl.searchParams.get('src')).toBe(
      'http://localhost:9000/localstudio/mirrors/shares/project-project-1.json',
    );
    expect(share.embedHtml).toContain('/editor/?embed=project-project-1');
    expect(share.embedHtml).toContain('src=');

    const putUrls = Array.from(uploadedBodies.keys());
    expect(putUrls).toEqual([
      'http://localhost:9000/localstudio/mirrors/shares/project-project-1.json',
    ]);

    const sharePayload = JSON.parse(
      await uploadedBodies
        .get('http://localhost:9000/localstudio/mirrors/shares/project-project-1.json')!
        .text(),
    ) as unknown as PublicSharePayloadFixture;
    expect(sharePayload).toMatchObject({
      schemaVersion: 1,
      shareId: 'project-project-1',
      project: {
        name: 'Untitled AI Deck',
        assets: {
          'asset-inline': {
            objectUrl:
              'http://localhost:9000/localstudio/mirrors/Untitled%20AI%20Deck/assets/asset-inline.png',
            storage: 'remote',
          },
        },
      },
    });
    expect(progressEvents).toEqual([
      { current: 0, total: 1, label: 'Preparing public share' },
      { current: 0, total: 1, label: 'Publishing share link' },
      { current: 1, total: 1, label: 'Published share link' },
    ]);
  });

  it('maps public font URLs to existing mirror files', async () => {
    const uploadedBodies = new Map<string, Blob>();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        uploadedBodies.set(getRequestUrl(input), init.body as Blob);
        return Promise.resolve(new Response('', { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });
    const mirrorService = new minioMirrorService.MinioMirrorService({ fetch: fetchMock });
    mirrorService.saveConfig(config);
    const service = new BrowserShareService({
      mirrorService,
      origin: 'https://localstudio.test',
    });

    await service.createShare(createProjectWithInlineFont());

    const fontUrl =
      'http://localhost:9000/localstudio/mirrors/Untitled%20AI%20Deck/fonts/acme-sans.woff2';
    const shareUrl = 'http://localhost:9000/localstudio/mirrors/shares/project-project-1.json';
    expect(Array.from(uploadedBodies.keys())).toEqual([shareUrl]);
    const sharePayload = JSON.parse(await uploadedBodies.get(shareUrl)!.text()) as PublicSharePayloadFixture;
    expect(sharePayload.project.fonts?.acme).toMatchObject({
      objectUrl: fontUrl,
      storage: 'remote',
    });
  });

  it('maps public recording audio URLs to existing mirror files with transcript data', async () => {
    const uploadedBodies = new Map<string, Blob>();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        uploadedBodies.set(getRequestUrl(input), init.body as Blob);
        return Promise.resolve(new Response('', { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });
    const mirrorService = new minioMirrorService.MinioMirrorService({ fetch: fetchMock });
    mirrorService.saveConfig(config);
    const service = new BrowserShareService({
      mirrorService,
      origin: 'https://localstudio.test',
    });

    await service.createShare(createProjectWithRecording());

    const recordingUrl =
      'http://localhost:9000/localstudio/mirrors/Untitled%20AI%20Deck/recordings/recording1.webm';
    const shareUrl = 'http://localhost:9000/localstudio/mirrors/shares/project-project-1.json';
    expect(Array.from(uploadedBodies.keys())).toEqual([shareUrl]);
    const sharePayload = JSON.parse(await uploadedBodies.get(shareUrl)!.text()) as PublicSharePayloadFixture;
    expect(sharePayload.project.recordings?.recording1).toMatchObject({
      audio: {
        objectUrl: recordingUrl,
        storage: 'remote',
      },
      segments: [
        {
          text: 'The roadmap includes transcript chat.',
        },
      ],
    });
  });

  it('rejects publishing when MinIO config is missing', async () => {
    const service = new BrowserShareService({
      mirrorService: new minioMirrorService.MinioMirrorService({ fetch: vi.fn() }),
      origin: 'https://localstudio.test',
    });

    await expect(service.createShare(sampleProject.createSampleProject())).rejects.toThrow(
      'Public sharing requires active external storage.',
    );
  });

  it('returns prepared metadata for a project without uploading share files', () => {
    const fetchMock = vi.fn();
    const service = new BrowserShareService({
      mirrorService: new minioMirrorService.MinioMirrorService({ fetch: fetchMock }),
      origin: 'https://localstudio.test',
    });

    const share = service.getProjectShareMetadata(sampleProject.createSampleProject());

    expect(share).toMatchObject({
      shareId: 'project-project-1',
      publicUrl: 'https://localstudio.test/editor/?share=project-project-1',
      status: 'published',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('encodes share ids and escapes embed iframe URLs', () => {
    const service = new BrowserShareService({
      mirrorService: new minioMirrorService.MinioMirrorService({ fetch: vi.fn() }),
      origin: 'https://localstudio.test',
    });
    const shareId = 'deck "quoted"&<tag>';

    expect(service.getPublicUrl(shareId)).toBe(
      'https://localstudio.test/editor/?share=deck+%22quoted%22%26%3Ctag%3E',
    );
    expect(service.getEmbedUrl(shareId)).toBe(
      'https://localstudio.test/editor/?embed=deck+%22quoted%22%26%3Ctag%3E',
    );
    expect(service.getEmbedHtml(shareId)).toContain(
      'src="https://localstudio.test/editor/?embed=deck+%22quoted%22%26%3Ctag%3E"',
    );
    expect(service.getEmbedHtml(shareId)).not.toContain(shareId);
  });
});
