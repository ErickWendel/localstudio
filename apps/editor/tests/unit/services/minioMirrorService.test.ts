import { vi } from 'vitest';
import type { ProjectDocument } from '../../../src/domain/documents/model';
import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { minioMirrorService } from '../../../src/services/mirror/minioMirrorService';
import type { MirrorManifest } from '../../../src/services/mirror/minioMirrorFiles';
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

const splitCredentialConfig: MinioMirrorConfig = {
  bucket: 'localstudio',
  endpoint: 'http://localhost:9000',
  pathStyle: true,
  publicBaseUrl: 'http://localhost:9000/localstudio',
  region: 'us-east-1',
  prefix: 'mirrors',
  writerAccessKey: 'writer-key',
  writerSecretKey: 'writer-secret',
  readerAccessKey: 'reader-key',
  readerSecretKey: 'reader-secret',
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

function getAuthorizationCredential(init: RequestInit | undefined) {
  const headers = init?.headers as Record<string, string> | undefined;
  return headers?.authorization?.match(/Credential=([^/]+)/)?.[1];
}

function createProjectWithInlineMirrorAssets(assetCount: number): ProjectDocument {
  const project = sampleProject.createSampleProject();
  const firstPage = project.pages[0];
  if (!firstPage) throw new Error('Sample project must contain a page.');
  for (let index = 0; index < assetCount; index += 1) {
    const assetId = `parallel-asset-${index}`;
    project.assets[assetId] = {
      id: assetId,
      type: 'image',
      mimeType: 'image/png',
      name: `Parallel asset ${index}`,
      objectUrl: 'data:image/png;base64,aW1hZ2U=',
      storage: 'inline',
    };
    const elementId = `parallel-image-${index}`;
    project.elements[elementId] = {
      id: elementId,
      type: 'image',
      assetId,
      x: 40 + index,
      y: 60 + index,
      width: 120,
      height: 80,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
    };
    firstPage.elementIds.push(elementId);
  }
  return project;
}

function createProjectWithLargeMirrorAsset(): ProjectDocument {
  const project = sampleProject.createSampleProject();
  const firstPage = project.pages[0];
  if (!firstPage) throw new Error('Sample project must contain a page.');
  project.assets['large-asset'] = {
    id: 'large-asset',
    type: 'image',
    mimeType: 'image/png',
    name: 'Large asset',
    objectUrl: 'blob:https://localstudio.test/large-asset',
    storage: 'inline',
  };
  project.elements['large-image'] = {
    id: 'large-image',
    type: 'image',
    assetId: 'large-asset',
    x: 40,
    y: 60,
    width: 120,
    height: 80,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
  };
  firstPage.elementIds.push('large-image');
  return project;
}

describe('minioMirrorService.createMirrorFiles', () => {
  it('reuses cached local object files and immutable history versions', async () => {
    const project = createProjectWithLargeMirrorAsset();
    const cache = { objectFiles: new Map(), versionFiles: new Map() };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (getRequestUrl(input) === 'blob:https://localstudio.test/large-asset') {
        return Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${getRequestUrl(input)}`));
    });
    const repository = new VersionedRepository(
      [
        {
          id: 'version-1',
          authorName: 'Local user',
          changeCount: 1,
          createdAt: '2026-06-29T10:00:00.000Z',
          fileName: 'version-1.json',
          projectName: project.name,
          summary: '1 edit',
        },
      ],
      project,
    );

    await minioMirrorService.createMirrorFiles(project, repository, config, {
      fetch: fetchMock,
      cache,
    });
    await minioMirrorService.createMirrorFiles(project, repository, config, {
      fetch: fetchMock,
      cache,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cache.versionFiles.size).toBe(1);
  });

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

  it('includes project font files in mirror payloads', async () => {
    const project: ProjectDocument = {
      ...sampleProject.createSampleProject(),
      fonts: {
        montserrat: {
          id: 'montserrat',
          family: 'Montserrat',
          requestedFamily: 'Montserrat',
          source: 'google-fonts',
          fontStyle: 'normal',
          fontWeight: 700,
          mimeType: 'font/woff2',
          fileName: 'montserrat-700.woff2',
          storage: 'inline',
          objectUrl: 'data:font/woff2;base64,Zm9udA==',
        },
      },
    };

    const files = await minioMirrorService.createMirrorFiles(
      project,
      new VersionedRepository([], project),
      config,
    );

    expect(files.map((file) => file.path)).toContain('fonts/montserrat-700.woff2');
    const projectJson = JSON.parse(
      await files.find((file) => file.path === 'project.json')!.blob.text(),
    ) as ProjectDocument;
    expect(projectJson.fonts?.montserrat).toMatchObject({
      fileName: 'montserrat-700.woff2',
      storage: 'file',
    });
  });

  it('includes presenter recording audio files in mirror payloads', async () => {
    const project: ProjectDocument = {
      ...sampleProject.createSampleProject(),
      recordings: {
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
              text: 'Mirrored transcript audio.',
              startMs: 0,
              endMs: 2400,
              final: true,
            },
          ],
        },
      },
    };

    const files = await minioMirrorService.createMirrorFiles(
      project,
      new VersionedRepository([], project),
      config,
    );

    expect(files.map((file) => file.path)).toContain('recordings/recording1.webm');
    const projectJson = JSON.parse(
      await files.find((file) => file.path === 'project.json')!.blob.text(),
    ) as ProjectDocument;
    expect(projectJson.recordings?.recording1).toMatchObject({
      audio: {
        fileName: 'recording1.webm',
        storage: 'file',
      },
      segments: [
        {
          text: 'Mirrored transcript audio.',
        },
      ],
    });
    expect(projectJson.recordings?.recording1?.audio.objectUrl).toBeUndefined();
  });
});

describe('minioMirrorService.MinioMirrorService', () => {
  it('derives public object URLs from endpoint, bucket, and URL mode when no public base is set', () => {
    const service = new minioMirrorService.MinioMirrorService();

    expect(
      service.getPublicObjectUrl('mirrors/deck/project.json', {
        ...config,
        publicBaseUrl: '',
      }),
    ).toBe('http://localhost:9000/localstudio/mirrors/deck/project.json');
    expect(
      service.getPublicObjectUrl('mirrors/deck/project.json', {
        ...config,
        bucket: 'decks',
        endpoint: 'https://s3.example.test',
        pathStyle: false,
        publicBaseUrl: '',
      }),
    ).toBe('https://decks.s3.example.test/mirrors/deck/project.json');
  });

  it('persists MinIO mirror config in browser key-value storage', () => {
    const persistedConfig: MinioMirrorConfig = {
      ...config,
      accessKey: 'persisted-access',
      bucket: 'persisted-bucket',
      secretKey: 'persisted-secret',
    };
    const records = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => records.get(key) ?? null),
      removeItem: vi.fn((key: string) => {
        records.delete(key);
      }),
      setItem: vi.fn((key: string, value: string) => {
        records.set(key, value);
      }),
    };
    const service = new minioMirrorService.MinioMirrorService({ storage });

    service.saveConfig(persistedConfig);

    expect(storage.setItem).toHaveBeenCalledWith(
      'localstudio.minioMirror.config',
      JSON.stringify(persistedConfig),
    );
    expect(service.loadConfig()).toEqual(persistedConfig);

    service.clearConfig();

    expect(storage.removeItem).toHaveBeenCalledWith('localstudio.minioMirror.config');
    expect(service.loadConfig()).toBeNull();
  });

  it('migrates the legacy local MinIO default config to split reader and writer defaults', () => {
    const records = new Map<string, string>([
      [
        'localstudio.minioMirror.config',
        JSON.stringify({
          accessKey: 'localstudio',
          bucket: 'localstudio',
          endpoint: 'http://localhost:9000',
          pathStyle: true,
          publicBaseUrl: 'http://localhost:9000/localstudio',
          region: 'us-east-1',
          secretKey: 'localstudio123',
          prefix: 'mirrors',
        } satisfies MinioMirrorConfig),
      ],
    ]);
    const storage = {
      getItem: vi.fn((key: string) => records.get(key) ?? null),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    const service = new minioMirrorService.MinioMirrorService({ storage });

    expect(service.loadConfig()).toMatchObject({
      accessKey: 'localstudio-writer',
      secretKey: 'localstudio-writer',
      writerAccessKey: 'localstudio-writer',
      writerSecretKey: 'localstudio-writer',
      readerAccessKey: 'localstudio-reader',
      readerSecretKey: 'localstudio-reader',
    });
  });

  it('keeps custom legacy S3 credentials when no split reader and writer keys exist', () => {
    const customConfig: MinioMirrorConfig = {
      accessKey: 'custom-access',
      bucket: 'custom-bucket',
      endpoint: 'https://storage.example.test',
      pathStyle: true,
      publicBaseUrl: 'https://cdn.example.test/custom-bucket',
      region: 'us-east-1',
      secretKey: 'custom-secret',
      prefix: 'mirrors',
    };
    const records = new Map<string, string>([
      ['localstudio.minioMirror.config', JSON.stringify(customConfig)],
    ]);
    const storage = {
      getItem: vi.fn((key: string) => records.get(key) ?? null),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    const service = new minioMirrorService.MinioMirrorService({ storage });

    expect(service.loadConfig()).toEqual(customConfig);
  });

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
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
    const progressUpdates: Array<{ current: number; label: string; total: number }> = [];

    await service.syncProject(project, new VersionedRepository([], project), config, {
      onProgress: (progress) => progressUpdates.push(progress),
    });

    const putUrls = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'PUT')
      .map(([input]) => getRequestUrl(input));
    expect(putUrls.some((url) => url.endsWith('/project.json'))).toBe(false);
    expect(putUrls.some((url) => url.endsWith('/localstudio-mirror.json'))).toBe(true);
    expect(progressUpdates[0]).toMatchObject({
      current: 0,
      label: 'Mirroring 3 changed files',
    });
    const finalProgress = progressUpdates.at(-1);
    if (!finalProgress) throw new Error('Expected mirror progress updates.');
    expect(finalProgress.current).toBe(finalProgress.total);
    expect(finalProgress.label).toContain('Mirrored ');
  });

  it('does not upload a timestamp-only manifest when the mirror is already current', async () => {
    const project = sampleProject.createSampleProject();
    const now = () => new Date('2026-06-30T10:00:00.000Z');
    const files = await minioMirrorService.createMirrorFiles(
      project,
      new VersionedRepository([], project),
      config,
      { now },
    );
    const manifestFile = files.find((file) => file.path === 'localstudio-mirror.json');
    if (!manifestFile) throw new Error('Expected a mirror manifest file.');
    const remoteManifest = JSON.parse(await manifestFile.blob.text()) as MirrorManifest;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'GET' && getRequestUrl(input).endsWith('localstudio-mirror.json')) {
        return Promise.resolve(new Response(JSON.stringify(remoteManifest), { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 200 }));
    });
    const progressUpdates: Array<{ current: number; label: string; total: number }> = [];

    await new minioMirrorService.MinioMirrorService({ fetch: fetchMock, now }).syncProject(
      project,
      new VersionedRepository([], project),
      config,
      { onProgress: (progress) => progressUpdates.push(progress) },
    );

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0);
    expect(progressUpdates[0]).toMatchObject({
      current: 0,
      label: 'Mirror is up to date',
    });
  });

  it('uploads changed mirror content files in bounded parallel and commits the manifest last', async () => {
    const project = createProjectWithInlineMirrorAssets(5);
    let activePuts = 0;
    let maxActivePuts = 0;
    const putOrder: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (init?.method === 'GET' && url.endsWith('localstudio-mirror.json')) {
        return new Response('', { status: 404 });
      }
      if (init?.method === 'PUT') {
        activePuts += 1;
        maxActivePuts = Math.max(maxActivePuts, activePuts);
        await new Promise((resolve) => {
          setTimeout(resolve, url.endsWith('localstudio-mirror.json') ? 0 : 10);
        });
        activePuts -= 1;
        putOrder.push(url);
        return new Response('', { status: 200 });
      }
      return new Response('', { status: 404 });
    });
    const service = new minioMirrorService.MinioMirrorService({
      fetch: fetchMock,
      now: () => new Date('2026-06-30T10:00:00.000Z'),
    });

    await service.syncProject(project, new VersionedRepository([], project), config);

    expect(maxActivePuts).toBeGreaterThan(1);
    expect(maxActivePuts).toBeLessThanOrEqual(3);
    expect(putOrder.at(-1)).toContain('localstudio-mirror.json');
  });

  it('uploads large public objects with the S3 multipart protocol', async () => {
    const requests: Array<{
      body: BodyInit | null | undefined;
      method: string;
      url: string;
    }> = [];
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      const method = init?.method ?? 'GET';
      requests.push({ body: init?.body, method, url });
      const parsedUrl = new URL(url);
      if (method === 'POST' && parsedUrl.searchParams.has('uploads')) {
        return Promise.resolve(
          new Response(
            '<InitiateMultipartUploadResult><UploadId>upload-123</UploadId></InitiateMultipartUploadResult>',
            { status: 200 },
          ),
        );
      }
      if (method === 'PUT' && parsedUrl.searchParams.has('partNumber')) {
        const partNumber = parsedUrl.searchParams.get('partNumber');
        return Promise.resolve(
          new Response('', { headers: { ETag: `"etag-${partNumber}"` }, status: 200 }),
        );
      }
      if (method === 'POST' && parsedUrl.searchParams.get('uploadId') === 'upload-123') {
        return Promise.resolve(new Response('', { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 200 }));
    });
    const service = new minioMirrorService.MinioMirrorService({ fetch: fetchMock });
    const largeBlob = new Blob([new Uint8Array(5 * 1024 * 1024 + 3)], {
      type: 'video/mp4',
    });

    await service.uploadPublicObject('mirrors/media.mp4', largeBlob, config);

    const initiateRequest = requests.find(({ method, url }) => {
      const parsedUrl = new URL(url);
      return method === 'POST' && parsedUrl.searchParams.has('uploads');
    });
    const partRequests = requests.filter(({ method, url }) => {
      const parsedUrl = new URL(url);
      return method === 'PUT' && parsedUrl.searchParams.has('partNumber');
    });
    const completeRequest = requests.find(({ method, url }) => {
      const parsedUrl = new URL(url);
      return method === 'POST' && parsedUrl.searchParams.get('uploadId') === 'upload-123';
    });
    expect(initiateRequest).toBeDefined();
    expect(partRequests.map(({ body }) => (body as Blob).size)).toEqual([5 * 1024 * 1024, 3]);
    const completeDocument = new DOMParser().parseFromString(
      await (completeRequest?.body as Blob).text(),
      'application/xml',
    );
    expect(
      Array.from(completeDocument.querySelectorAll('Part')).map((part) => ({
        etag: part.querySelector('ETag')?.textContent,
        partNumber: part.querySelector('PartNumber')?.textContent,
      })),
    ).toEqual([
      { etag: '"etag-1"', partNumber: '1' },
      { etag: '"etag-2"', partNumber: '2' },
    ]);
    expect(requests.some(({ method, url }) => method === 'PUT' && !new URL(url).search)).toBe(false);
  });

  it('reports multipart sync progress in uploaded bytes after each completed part', async () => {
    const project = createProjectWithLargeMirrorAsset();
    const largeBytes = new Uint8Array(5 * 1024 * 1024 + 3);
    const largeBlob = new Blob([largeBytes], {
      type: 'image/png',
    });
    const progressUpdates: Array<{ current: number; label: string; total: number }> = [];
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (url === 'blob:https://localstudio.test/large-asset') {
        return Promise.resolve(
          new Response(largeBytes, { headers: { 'content-type': 'image/png' } }),
        );
      }
      const parsedUrl = new URL(url);
      if (init?.method === 'GET' && url.endsWith('localstudio-mirror.json')) {
        return Promise.resolve(new Response('', { status: 404 }));
      }
      if (init?.method === 'POST' && parsedUrl.searchParams.has('uploads')) {
        return Promise.resolve(
          new Response(
            '<InitiateMultipartUploadResult><UploadId>progress-upload</UploadId></InitiateMultipartUploadResult>',
          ),
        );
      }
      if (init?.method === 'PUT' && parsedUrl.searchParams.has('partNumber')) {
        return Promise.resolve(
          new Response('', {
            headers: { ETag: `"part-${parsedUrl.searchParams.get('partNumber')}"` },
          }),
        );
      }
      return Promise.resolve(new Response('', { status: 200 }));
    });
    const service = new minioMirrorService.MinioMirrorService({ fetch: fetchMock });

    await service.syncProject(project, new VersionedRepository([], project), config, {
      onProgress: (progress) => progressUpdates.push(progress),
    });

    expect(progressUpdates[0]?.total).toBeGreaterThan(largeBlob.size);
    expect(
      progressUpdates.some(
        ({ current, label, total }) =>
          label === 'Mirroring assets/large-asset.png' &&
          current >= 5 * 1024 * 1024 &&
          current < total,
      ),
    ).toBe(true);
    expect(progressUpdates.at(-1)?.current).toBe(progressUpdates.at(-1)?.total);
  });

  it('retries only the failed multipart part', async () => {
    const retryDelays: number[] = [];
    const partAttempts = new Map<string, number>();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(getRequestUrl(input));
      if (init?.method === 'POST' && url.searchParams.has('uploads')) {
        return Promise.resolve(
          new Response(
            '<InitiateMultipartUploadResult><UploadId>retry-upload</UploadId></InitiateMultipartUploadResult>',
          ),
        );
      }
      if (init?.method === 'PUT' && url.searchParams.has('partNumber')) {
        const partNumber = url.searchParams.get('partNumber') ?? '';
        const attempts = (partAttempts.get(partNumber) ?? 0) + 1;
        partAttempts.set(partNumber, attempts);
        return Promise.resolve(
          new Response('', {
            headers: attempts > 1 || partNumber === '1' ? { ETag: `"part-${partNumber}"` } : {},
            status: partNumber === '2' && attempts === 1 ? 503 : 200,
          }),
        );
      }
      return Promise.resolve(new Response('', { status: 200 }));
    });
    const service = new minioMirrorService.MinioMirrorService({
      fetch: fetchMock,
      sleep: (delayMs) => {
        retryDelays.push(delayMs);
        return Promise.resolve();
      },
    });

    await service.uploadPublicObject(
      'mirrors/retry.mp4',
      new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'video/mp4' }),
      config,
    );

    expect(Object.fromEntries(partAttempts)).toEqual({ '1': 1, '2': 2 });
    expect(retryDelays).toEqual([250]);
  });

  it('aborts an incomplete multipart upload without hiding the original failure', async () => {
    const methods: string[] = [];
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(getRequestUrl(input));
      methods.push(`${init?.method ?? 'GET'}:${url.search}`);
      if (init?.method === 'POST' && url.searchParams.has('uploads')) {
        return Promise.resolve(
          new Response(
            '<InitiateMultipartUploadResult><UploadId>abort-upload</UploadId></InitiateMultipartUploadResult>',
          ),
        );
      }
      if (init?.method === 'PUT') return Promise.resolve(new Response('', { status: 200 }));
      return Promise.resolve(new Response('', { status: 204 }));
    });
    const service = new minioMirrorService.MinioMirrorService({ fetch: fetchMock });

    await expect(
      service.uploadPublicObject(
        'mirrors/missing-etag.mp4',
        new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'video/mp4' }),
        config,
      ),
    ).rejects.toThrow('Could not upload mirrors/missing-etag.mp4 part 1: missing ETag.');
    expect(methods).toContain('DELETE:?uploadId=abort-upload');
  });

  it('retries transient network upload failures with exponential backoff', async () => {
    const project = sampleProject.createSampleProject();
    const retryDelays: number[] = [];
    let projectUploadAttempts = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (init?.method === 'GET' && url.endsWith('localstudio-mirror.json')) {
        return Promise.resolve(new Response('', { status: 404 }));
      }
      if (init?.method === 'PUT' && url.endsWith('/project.json')) {
        projectUploadAttempts += 1;
        if (projectUploadAttempts < 3) {
          return Promise.reject(new TypeError('Failed to fetch'));
        }
      }
      return Promise.resolve(new Response('', { status: 200 }));
    });
    const service = new minioMirrorService.MinioMirrorService({
      fetch: fetchMock,
      sleep: (delayMs) => {
        retryDelays.push(delayMs);
        return Promise.resolve();
      },
    });

    await service.syncProject(project, new VersionedRepository([], project), config);

    expect(projectUploadAttempts).toBe(3);
    expect(retryDelays).toEqual([250, 500]);
  });

  it('retries retryable upload responses before committing the manifest', async () => {
    const project = sampleProject.createSampleProject();
    const retryDelays: number[] = [];
    let manifestUploadAttempts = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (init?.method === 'GET' && url.endsWith('localstudio-mirror.json')) {
        return Promise.resolve(new Response('', { status: 404 }));
      }
      if (init?.method === 'PUT' && url.endsWith('/localstudio-mirror.json')) {
        manifestUploadAttempts += 1;
        return Promise.resolve(
          new Response('', { status: manifestUploadAttempts === 1 ? 503 : 200 }),
        );
      }
      return Promise.resolve(new Response('', { status: 200 }));
    });
    const service = new minioMirrorService.MinioMirrorService({
      fetch: fetchMock,
      sleep: (delayMs) => {
        retryDelays.push(delayMs);
        return Promise.resolve();
      },
    });

    await service.syncProject(project, new VersionedRepository([], project), config);

    expect(manifestUploadAttempts).toBe(2);
    expect(retryDelays).toEqual([250]);
  });

  it('reports the object key after network upload retries are exhausted', async () => {
    const project = sampleProject.createSampleProject();
    let projectUploadAttempts = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (init?.method === 'GET' && url.endsWith('localstudio-mirror.json')) {
        return Promise.resolve(new Response('', { status: 404 }));
      }
      if (init?.method === 'PUT' && url.endsWith('/project.json')) {
        projectUploadAttempts += 1;
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      return Promise.resolve(new Response('', { status: 200 }));
    });
    const service = new minioMirrorService.MinioMirrorService({
      fetch: fetchMock,
      sleep: () => Promise.resolve(),
    });

    await expect(
      service.syncProject(project, new VersionedRepository([], project), config),
    ).rejects.toThrow(/Could not upload mirrors\/.+\/project\.json after 3 attempts: Failed to fetch/);
    expect(projectUploadAttempts).toBe(3);
  });

  it('uses writer credentials when sync checks and uploads mirror files', async () => {
    const project = sampleProject.createSampleProject();
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
    const service = new minioMirrorService.MinioMirrorService({
      fetch: fetchMock,
      now: () => new Date('2026-06-30T10:00:00.000Z'),
    });

    await service.syncProject(project, new VersionedRepository([], project), splitCredentialConfig);

    const getCredentials = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'GET')
      .map(([, init]) => getAuthorizationCredential(init));
    const putCredentials = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'PUT')
      .map(([, init]) => getAuthorizationCredential(init));
    expect(getCredentials).toContain('writer-key');
    expect(getCredentials).not.toContain('reader-key');
    expect(putCredentials).toContain('writer-key');
    expect(putCredentials).not.toContain('reader-key');
  });

  it('uses reader credentials when listing remote mirrors', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (init?.method === 'GET' && url.includes('list-type=2')) {
        return Promise.resolve(
          new Response(
            '<ListBucketResult><Contents><Key>mirrors/Client/localstudio-mirror.json</Key></Contents></ListBucketResult>',
            { status: 200 },
          ),
        );
      }
      if (init?.method === 'GET' && url.endsWith('/mirrors/Client/localstudio-mirror.json')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              schemaVersion: 1,
              projectId: 'project-client',
              projectName: 'Client',
              syncedAt: '2026-06-30T10:00:00.000Z',
              publicBaseUrl: splitCredentialConfig.publicBaseUrl,
              files: {},
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });
    const service = new minioMirrorService.MinioMirrorService({ fetch: fetchMock });

    await service.listProjects(splitCredentialConfig);

    const getCredentials = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'GET')
      .map(([, init]) => getAuthorizationCredential(init));
    expect(getCredentials).toContain('reader-key');
    expect(getCredentials).not.toContain('writer-key');
  });

  it('lists remote mirrors by most recent sync time first', async () => {
    const manifests = new Map([
      [
        '/mirrors/Older/localstudio-mirror.json',
        {
          projectId: 'project-older',
          projectName: 'Older',
          syncedAt: '2026-07-21T08:53:00.000Z',
        },
      ],
      [
        '/mirrors/Invalid/localstudio-mirror.json',
        {
          projectId: 'project-invalid',
          projectName: 'Invalid',
          syncedAt: 'not-a-date',
        },
      ],
      [
        '/mirrors/Newest/localstudio-mirror.json',
        {
          projectId: 'project-newest',
          projectName: 'Newest',
          syncedAt: '2026-07-21T13:40:00.000Z',
        },
      ],
      [
        '/mirrors/Middle/localstudio-mirror.json',
        {
          projectId: 'project-middle',
          projectName: 'Middle',
          syncedAt: '2026-07-21T09:25:00.000Z',
        },
      ],
    ]);
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(getRequestUrl(input));
      if (init?.method === 'GET' && url.searchParams.get('list-type') === '2') {
        return Promise.resolve(
          new Response(
            '<ListBucketResult>' +
              '<Contents><Key>mirrors/Older/localstudio-mirror.json</Key></Contents>' +
              '<Contents><Key>mirrors/Invalid/localstudio-mirror.json</Key></Contents>' +
              '<Contents><Key>mirrors/Newest/localstudio-mirror.json</Key></Contents>' +
              '<Contents><Key>mirrors/Middle/localstudio-mirror.json</Key></Contents>' +
              '</ListBucketResult>',
            { status: 200 },
          ),
        );
      }
      const manifest = manifests.get(url.pathname.replace(/^\/localstudio/, ''));
      if (init?.method === 'GET' && manifest) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              schemaVersion: 1,
              publicBaseUrl: splitCredentialConfig.publicBaseUrl,
              files: {},
              ...manifest,
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });
    const service = new minioMirrorService.MinioMirrorService({ fetch: fetchMock });

    await expect(service.listProjects(splitCredentialConfig)).resolves.toEqual([
      { id: 'Newest', name: 'Newest', syncedAt: '2026-07-21T13:40:00.000Z' },
      { id: 'Middle', name: 'Middle', syncedAt: '2026-07-21T09:25:00.000Z' },
      { id: 'Older', name: 'Older', syncedAt: '2026-07-21T08:53:00.000Z' },
      { id: 'Invalid', name: 'Invalid', syncedAt: 'not-a-date' },
    ]);
  });

  it('lists remote mirrors across paginated object listings', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(getRequestUrl(input));
      if (init?.method === 'GET' && url.searchParams.get('list-type') === '2') {
        const continuationToken = url.searchParams.get('continuation-token');
        return Promise.resolve(
          new Response(
            continuationToken === 'page-2'
              ? `<ListBucketResult>
                  <IsTruncated>false</IsTruncated>
                  <Contents><Key>mirrors/Newest/localstudio-mirror.json</Key></Contents>
                </ListBucketResult>`
              : `<ListBucketResult>
                  <IsTruncated>true</IsTruncated>
                  <NextContinuationToken>page-2</NextContinuationToken>
                  <Contents><Key>mirrors/Older/localstudio-mirror.json</Key></Contents>
                  <Contents><Key>mirrors/Older/project.json</Key></Contents>
                </ListBucketResult>`,
            { status: 200 },
          ),
        );
      }
      if (init?.method === 'GET' && url.pathname.endsWith('/localstudio-mirror.json')) {
        const projectName = url.pathname.includes('/Newest/') ? 'Newest' : 'Older';
        return Promise.resolve(
          Response.json({
            files: {},
            projectId: `project-${projectName.toLowerCase()}`,
            projectName,
            publicBaseUrl: splitCredentialConfig.publicBaseUrl,
            schemaVersion: 1,
            syncedAt:
              projectName === 'Newest' ? '2026-08-11T18:00:00.000Z' : '2026-08-10T18:00:00.000Z',
          }),
        );
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });
    const service = new minioMirrorService.MinioMirrorService({ fetch: fetchMock });

    await expect(service.listProjects(splitCredentialConfig)).resolves.toEqual([
      { id: 'Newest', name: 'Newest', syncedAt: '2026-08-11T18:00:00.000Z' },
      { id: 'Older', name: 'Older', syncedAt: '2026-08-10T18:00:00.000Z' },
    ]);
    const listingUrls = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'GET')
      .map(([input]) => new URL(getRequestUrl(input)))
      .filter((url) => url.searchParams.get('list-type') === '2');
    expect(listingUrls).toHaveLength(2);
    expect(listingUrls[1]?.searchParams.get('continuation-token')).toBe('page-2');
  });

  it('reports mirrored file download progress', async () => {
    const progressEvents: Array<{
      downloadedBytes: number;
      downloadedFiles: number;
      totalBytes: number;
      totalFiles: number;
    }> = [];
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (init?.method === 'GET' && url.endsWith('/mirrors/Client/localstudio-mirror.json')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              schemaVersion: 1,
              projectId: 'project-client',
              projectName: 'Client',
              syncedAt: '2026-06-30T10:00:00.000Z',
              publicBaseUrl: splitCredentialConfig.publicBaseUrl,
              files: {
                'project.json': {
                  checksum: 'project',
                  path: 'project.json',
                  size: 15,
                },
                'assets/hero.png': {
                  checksum: 'hero',
                  path: 'assets/hero.png',
                  size: 10,
                },
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (init?.method === 'GET' && url.endsWith('/mirrors/Client/project.json')) {
        return Promise.resolve(new Response('{"name":"Deck"}', { status: 200 }));
      }
      if (init?.method === 'GET' && url.endsWith('/mirrors/Client/assets/hero.png')) {
        return Promise.resolve(new Response('image-data!', { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });
    const service = new minioMirrorService.MinioMirrorService({ fetch: fetchMock });

    const files = await service.downloadProject('Client', splitCredentialConfig, {
      onProgress: (progress) => {
        progressEvents.push({
          downloadedBytes: progress.downloadedBytes,
          downloadedFiles: progress.downloadedFiles,
          totalBytes: progress.totalBytes,
          totalFiles: progress.totalFiles,
        });
      },
    });

    expect(files.map((file) => file.path).sort()).toEqual([
      'assets/hero.png',
      'localstudio-mirror.json',
      'project.json',
    ]);
    expect(progressEvents.at(0)).toMatchObject({
      downloadedBytes: 0,
      downloadedFiles: 0,
      totalBytes: 25,
      totalFiles: 2,
    });
    expect(progressEvents.at(-1)).toMatchObject({
      downloadedBytes: 25,
      downloadedFiles: 2,
      totalBytes: 25,
      totalFiles: 2,
    });
  });

  it('explains when reader credentials cannot list remote mirrors', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('', { status: 403 })));
    const service = new minioMirrorService.MinioMirrorService({ fetch: fetchMock });

    await expect(service.listProjects(splitCredentialConfig)).rejects.toThrow(
      /Reader credentials cannot list the bucket or prefix/,
    );
  });

  it('does not set the forbidden Host header on signed browser requests', async () => {
    const project = sampleProject.createSampleProject();
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
    const service = new minioMirrorService.MinioMirrorService({
      fetch: fetchMock,
      now: () => new Date('2026-06-30T10:00:00.000Z'),
    });

    await service.syncProject(project, new VersionedRepository([], project), config);

    const [, init] = fetchMock.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers.host).toBeUndefined();
    expect(headers.authorization).toContain('SignedHeaders=host;x-amz-content-sha256;x-amz-date');
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
