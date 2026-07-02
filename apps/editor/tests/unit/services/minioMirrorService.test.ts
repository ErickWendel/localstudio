import { vi } from 'vitest';
import type { ProjectDocument } from '../../../src/domain/documents/model';
import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { minioMirrorService } from '../../../src/services/mirror/minioMirrorService';
import type { MinioMirrorConfig } from '../../../src/services/mirror/minioMirrorService';
import type {
  ProjectRepository,
  VersionHistoryEntry,
} from '../../../src/services/contracts/interfaces';

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

class VersionedRepository implements ProjectRepository {
  constructor(
    private readonly versions: VersionHistoryEntry[],
    private readonly versionProject: ProjectDocument,
  ) {}

  loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(null);
  }

  saveProject(): Promise<void> {
    return Promise.resolve();
  }

  getVersionHistory(): Promise<VersionHistoryEntry[]> {
    return Promise.resolve(this.versions);
  }

  loadVersion(): Promise<ProjectDocument | null> {
    return Promise.resolve(this.versionProject);
  }
}

function getRequestUrl(input: RequestInfo | URL) {
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return input;
}

describe('minioMirrorService.createMirrorFiles', () => {
  it('creates a complete portable project mirror payload', async () => {
    const project = sampleProject.createSampleProject();
    const versionProject = {
      ...project,
      name: 'Older name',
      updatedAt: '2026-06-29T10:00:00.000Z',
    };
    const version: VersionHistoryEntry = {
      id: 'version-1',
      authorName: 'Local user',
      changeCount: 1,
      createdAt: '2026-06-29T10:00:00.000Z',
      fileName: 'version-1.json',
      projectName: project.name,
      summary: '1 edit',
    };

    const files = await minioMirrorService.createMirrorFiles(
      project,
      new VersionedRepository([version], versionProject),
      config,
    );
    const paths = files.map((file) => file.path).sort();

    expect(paths).toEqual([
      'config/localstudio.json',
      'history/manifest.json',
      'history/versions/version-1.json',
      'localstudio-mirror.json',
      'project.json',
    ]);
    expect(
      JSON.parse(await files.find((file) => file.path === 'project.json')!.blob.text()),
    ).toMatchObject({
      id: project.id,
      name: project.name,
    });
    expect(
      JSON.parse(await files.find((file) => file.path === 'history/manifest.json')!.blob.text()),
    ).toMatchObject({
      latestVersionId: 'version-1',
      versions: [expect.objectContaining({ id: 'version-1' })],
    });
    expect(
      JSON.parse(await files.find((file) => file.path === 'localstudio-mirror.json')!.blob.text()),
    ).toMatchObject({
      schemaVersion: 1,
      projectId: project.id,
      projectName: project.name,
      publicBaseUrl: config.publicBaseUrl,
    });
  });
});

describe('minioMirrorService.MinioMirrorService', () => {
  it('binds the browser fetch function when no fetch override is provided', async () => {
    const project = sampleProject.createSampleProject();
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      expect(this).toBe(globalThis);
      const url = getRequestUrl(input);
      if (init?.method === 'GET' && url.endsWith('localstudio-mirror.json')) {
        return Promise.resolve(new Response('', { status: 404 }));
      }
      if (init?.method === 'PUT') {
        return Promise.resolve(new Response('', { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await new minioMirrorService.MinioMirrorService({
        now: () => new Date('2026-06-30T10:00:00.000Z'),
      }).syncProject(project, new VersionedRepository([], project), config);
    } finally {
      vi.stubGlobal('fetch', originalFetch);
    }

    expect(fetchMock).toHaveBeenCalled();
  });

  it('uploads changed mirror files and skips unchanged remote entries', async () => {
    const project = sampleProject.createSampleProject();
    const remoteManifest = {
      schemaVersion: 1,
      projectId: project.id,
      projectName: project.name,
      syncedAt: '2026-06-29T10:00:00.000Z',
      publicBaseUrl: config.publicBaseUrl,
      files: {
        'project.json': {
          path: 'project.json',
          size: JSON.stringify(project, null, 2).length,
          checksum: await crypto.subtle
            .digest('SHA-256', new TextEncoder().encode(JSON.stringify(project, null, 2)))
            .then((hash) =>
              Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join(
                '',
              ),
            ),
        },
      },
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (init?.method === 'GET' && url.endsWith('localstudio-mirror.json')) {
        return Promise.resolve(new Response(JSON.stringify(remoteManifest), { status: 200 }));
      }
      if (init?.method === 'PUT') {
        return Promise.resolve(new Response('', { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });
    const service = new minioMirrorService.MinioMirrorService({
      fetch: fetchMock,
      now: () => new Date('2026-06-30T10:00:00.000Z'),
    });

    await service.syncProject(project, new VersionedRepository([], project), config);

    const putUrls = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'PUT')
      .map(([input]) => getRequestUrl(input));
    expect(putUrls.some((url) => url.endsWith('/project.json'))).toBe(false);
    expect(putUrls.some((url) => url.endsWith('/localstudio-mirror.json'))).toBe(true);
  });

  it('deletes every object under a mirrored project prefix', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (init?.method === 'GET' && url.includes('list-type=2')) {
        return Promise.resolve(
          new Response(
            `<ListBucketResult>
              <Contents><Key>mirrors/Client Launch/project.json</Key></Contents>
              <Contents><Key>mirrors/Client Launch/localstudio-mirror.json</Key></Contents>
            </ListBucketResult>`,
            { status: 200 },
          ),
        );
      }
      if (init?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });
    const service = new minioMirrorService.MinioMirrorService({ fetch: fetchMock });

    await service.deleteProject('Client Launch', config);

    const deleteUrls = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'DELETE')
      .map(([input]) => getRequestUrl(input));
    expect(deleteUrls).toHaveLength(2);
    expect(deleteUrls.some((url) => url.endsWith('/mirrors/Client%20Launch/project.json'))).toBe(
      true,
    );
    expect(
      deleteUrls.some((url) => url.endsWith('/mirrors/Client%20Launch/localstudio-mirror.json')),
    ).toBe(true);
  });

  it('deletes mirrored project objects across paginated listings', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (
        init?.method === 'GET' &&
        url.includes('list-type=2') &&
        !url.includes('continuation-token=')
      ) {
        return Promise.resolve(
          new Response(
            `<ListBucketResult>
              <IsTruncated>true</IsTruncated>
              <NextContinuationToken>page-2</NextContinuationToken>
              <Contents><Key>mirrors/Client Launch/project.json</Key></Contents>
            </ListBucketResult>`,
            { status: 200 },
          ),
        );
      }
      if (
        init?.method === 'GET' &&
        url.includes('list-type=2') &&
        url.includes('continuation-token=page-2')
      ) {
        return Promise.resolve(
          new Response(
            `<ListBucketResult>
              <IsTruncated>false</IsTruncated>
              <Contents><Key>mirrors/Client Launch/localstudio-mirror.json</Key></Contents>
            </ListBucketResult>`,
            { status: 200 },
          ),
        );
      }
      if (init?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });
    const service = new minioMirrorService.MinioMirrorService({ fetch: fetchMock });

    await service.deleteProject('Client Launch', config);

    const listUrls = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'GET')
      .map(([input]) => getRequestUrl(input));
    const deleteUrls = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'DELETE')
      .map(([input]) => getRequestUrl(input));
    expect(listUrls).toHaveLength(2);
    expect(deleteUrls).toHaveLength(2);
    expect(deleteUrls.some((url) => url.endsWith('/mirrors/Client%20Launch/project.json'))).toBe(
      true,
    );
    expect(
      deleteUrls.some((url) => url.endsWith('/mirrors/Client%20Launch/localstudio-mirror.json')),
    ).toBe(true);
  });

  it('stores mirrored objects under the readable project name prefix', async () => {
    const project = { ...sampleProject.createSampleProject(), name: 'Client Launch Deck' };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (init?.method === 'GET' && url.endsWith('localstudio-mirror.json')) {
        return Promise.resolve(new Response('', { status: 404 }));
      }
      if (init?.method === 'PUT') {
        return Promise.resolve(new Response('', { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });
    const service = new minioMirrorService.MinioMirrorService({ fetch: fetchMock });

    await service.syncProject(project, new VersionedRepository([], project), config);

    const putUrls = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'PUT')
      .map(([input]) => getRequestUrl(input));
    expect(putUrls.every((url) => url.includes('/mirrors/Client%20Launch%20Deck/'))).toBe(true);
  });
});
