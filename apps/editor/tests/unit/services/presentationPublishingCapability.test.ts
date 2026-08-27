import { sampleProject } from '../../../src/domain/projects/sampleProject';
import type { ProjectDocument } from '../../../src/domain/documents/model';
import type { ProjectRepository, ShareMetadata } from '../../../src/services/contracts/interfaces';
import {
  PresentationPublishingCapability,
  type PresentationPublishProgress,
  type PresentationPublishingCapabilityOptions,
} from '../../../src/services/automation/presentationPublishingCapability';
import { authoringRevision } from '../../../src/services/automation/getAuthoringSlideRevision';
import { minioMirrorService } from '../../../src/services/mirror/minioMirrorService';
import type { MinioMirrorConfig } from '../../../src/services/mirror/minioMirrorService';
import { BrowserShareService } from '../../../src/services/sharing/shareService';

interface TestConfig {
  bucket: string;
}

function createShareMetadata(shareId: string): ShareMetadata {
  return {
    shareId,
    publicUrl: `https://localstudio.test/editor/?share=${shareId}`,
    embedUrl: `https://localstudio.test/editor/?embed=${shareId}`,
    embedHtml: `<iframe src="https://localstudio.test/editor/?embed=${shareId}"></iframe>`,
    createdAt: '2026-08-27T10:00:00.000Z',
    updatedAt: '2026-08-27T10:00:00.000Z',
    status: 'published',
  };
}

function createProject(): ProjectDocument {
  const project = sampleProject.createSampleProject();
  const page = project.pages[0]!;
  page.semanticDescription = {
    text: 'A launch slide with a product screenshot.',
    language: 'en',
    generatedAt: '2026-08-27T10:00:00.000Z',
    generator: 'local-model',
    sourceRevision: 'revision-1',
    reviewed: false,
    stale: false,
  };
  project.fonts = {
    inter: {
      id: 'inter',
      family: 'Inter',
      requestedFamily: 'Inter',
      source: 'google-fonts',
      fontStyle: 'normal',
      fontWeight: 700,
      mimeType: 'font/woff2',
      fileName: 'inter.woff2',
      storage: 'inline',
      objectUrl: 'data:font/woff2;base64,Zm9udA==',
    },
  };
  project.assets.hero = {
    id: 'hero',
    type: 'image',
    name: 'Hero screenshot',
    mimeType: 'image/png',
    fileName: 'hero.png',
    storage: 'inline',
    objectUrl: 'data:image/png;base64,aGVybw==',
  };
  project.elements.hero = {
    id: 'hero',
    type: 'image',
    assetId: 'hero',
    x: 10,
    y: 20,
    width: 100,
    height: 80,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
  };
  page.elementIds.push('hero');
  project.recordings = {
    allowed: {
      id: 'allowed',
      name: 'Allowed recording',
      createdAt: '2026-08-27T10:00:00.000Z',
      updatedAt: '2026-08-27T10:00:00.000Z',
      durationMs: 2_000,
      language: 'en',
      modelPresetId: 'web-speech-api',
      audio: {
        mimeType: 'audio/webm',
        objectUrl: 'blob:https://localstudio.test/allowed',
        storage: 'inline',
      },
      segments: [
        { id: 'segment-1', text: 'Authorized transcript.', startMs: 0, endMs: 2_000, final: true },
      ],
    },
    private: {
      id: 'private',
      name: 'Private recording',
      createdAt: '2026-08-27T10:00:00.000Z',
      updatedAt: '2026-08-27T10:00:00.000Z',
      durationMs: 1_000,
      language: 'pt-BR',
      modelPresetId: 'web-speech-api',
      audio: {
        mimeType: 'audio/webm',
        objectUrl: 'blob:https://localstudio.test/private',
        storage: 'inline',
      },
      segments: [
        {
          id: 'segment-2',
          text: 'Private transcript remains public context.',
          startMs: 0,
          endMs: 1_000,
          final: true,
        },
      ],
    },
  };
  page.semanticDescription.sourceRevision = authoringRevision.getSlide(project, page.id);
  return project;
}

function createHarness(
  overrides: Partial<PresentationPublishingCapabilityOptions<TestConfig>> = {},
) {
  const project = createProject();
  const revision = 'revision-1';
  const publishedProjects: ProjectDocument[] = [];
  const repository: ProjectRepository = {
    loadProject: () => Promise.resolve(project),
    saveProject: () => Promise.resolve(),
  };
  const options: PresentationPublishingCapabilityOptions<TestConfig> = {
    getSnapshot: () => ({ project, revision }),
    isRawRecordingAuthorized: (recording) => recording.id === 'allowed',
    repository,
    mirror: {
      loadConfig: () => ({ bucket: 'presentations' }),
      syncProject: (_project, _repository, _config, mirrorOptions) => {
        mirrorOptions?.onProgress?.({ current: 50, total: 100, label: 'Uploading assets' });
        return Promise.resolve({ enabled: true, status: 'synced' });
      },
    },
    share: {
      createShare: (publishedProject, shareOptions) => {
        publishedProjects.push(structuredClone(publishedProject));
        shareOptions?.onProgress?.({ current: 1, total: 1, label: 'Pointer uploaded' });
        return Promise.resolve(createShareMetadata('project-project-1'));
      },
      updateShare: (shareId, publishedProject, shareOptions) => {
        publishedProjects.push(structuredClone(publishedProject));
        shareOptions?.onProgress?.({ current: 1, total: 1, label: 'Pointer updated' });
        return Promise.resolve(createShareMetadata(shareId));
      },
    },
    ...overrides,
  };
  return {
    project,
    publishedProjects,
    service: new PresentationPublishingCapability(options),
  };
}

describe('PresentationPublishingCapability', () => {
  it('publishes the exact current revision with fonts, descriptions, transcripts, and authorized audio', async () => {
    const harness = createHarness();
    const progress: PresentationPublishProgress[] = [];

    const result = await harness.service.publish({}, (event) => progress.push(event));

    expect(result).toMatchObject({
      shareId: 'project-project-1',
      revision: 'revision-1',
      publicUrl: 'https://localstudio.test/editor/?share=project-project-1',
      embedUrl: 'https://localstudio.test/editor/?embed=project-project-1',
      context: {
        fonts: [{ family: 'Inter', source: 'google-fonts' }],
        slides: [
          {
            description: 'A launch slide with a product screenshot.',
            descriptionFreshness: 'fresh',
          },
        ],
        recordings: [
          { recordingId: 'allowed', rawAudioIncluded: true, transcriptSegmentCount: 1 },
          { recordingId: 'private', rawAudioIncluded: false, transcriptSegmentCount: 1 },
        ],
      },
    });
    expect(result.mediaManifest.find((item) => item.assetId === 'hero')).toMatchObject({
      kind: 'image',
    });
    expect(result.mediaManifest.find((item) => item.assetId === 'allowed')).toMatchObject({
      kind: 'recording',
    });
    expect(result.mediaManifest.find((item) => item.assetId === 'private')).toBeUndefined();
    const published = harness.publishedProjects[0]!;
    expect(published.fonts?.inter?.objectUrl).toContain('data:font/woff2');
    expect(published.pages[0]?.semanticDescription?.text).toContain('launch slide');
    expect(published.recordings?.allowed?.audio.objectUrl).toContain('/allowed');
    expect(published.recordings?.private?.segments[0]?.text).toContain('Private transcript');
    expect(published.recordings?.private?.audio).toEqual({ mimeType: 'audio/webm' });
    expect(progress.map((event) => event.stage)).toEqual([
      'preparing',
      'assets',
      'assets',
      'pointer',
      'pointer',
      'completed',
    ]);
    expect(progress.at(-1)?.progress).toBe(100);
  });

  it('denies all raw audio when no persisted authorization policy approves it', async () => {
    const harness = createHarness({ isRawRecordingAuthorized: undefined });

    const result = await harness.service.publish({}, () => undefined);

    expect(result.context.recordings).toEqual([
      expect.objectContaining({ recordingId: 'allowed', rawAudioIncluded: false }),
      expect.objectContaining({ recordingId: 'private', rawAudioIncluded: false }),
    ]);
    expect(harness.publishedProjects[0]?.recordings?.allowed?.audio).toEqual({
      mimeType: 'audio/webm',
    });
    expect(harness.publishedProjects[0]?.recordings?.private?.audio).toEqual({
      mimeType: 'audio/webm',
    });
  });

  it('reports a source-revision mismatch as a stale published description', async () => {
    const harness = createHarness();
    const page = harness.project.pages[0];
    const elementId = page?.elementIds[0];
    const element = elementId ? harness.project.elements[elementId] : undefined;
    if (!page || !element) throw new Error('Expected a populated first slide.');
    element.x += 1;

    const result = await harness.service.publish({}, () => undefined);

    expect(result.context.slides[0]).toMatchObject({ descriptionFreshness: 'stale' });
  });

  it('updates an explicit stable share id and is retry-safe after a failed pointer upload', async () => {
    let attempts = 0;
    const harness = createHarness({
      share: {
        createShare: () => Promise.reject(new Error('Unexpected create')),
        updateShare: (shareId) => {
          attempts += 1;
          if (attempts === 1) return Promise.reject(new Error('signed upload URL with a secret'));
          return Promise.resolve(createShareMetadata(shareId));
        },
      },
    });

    await expect(
      harness.service.publish({ shareId: 'stable-share' }, () => undefined),
    ).rejects.toThrow('Could not publish the presentation share pointer.');
    await expect(
      harness.service.publish({ shareId: 'stable-share' }, () => undefined),
    ).resolves.toMatchObject({ shareId: 'stable-share' });
    expect(attempts).toBe(2);
  });

  it('composes mirror and share infrastructure to rewrite public media URLs', async () => {
    window.localStorage.clear();
    const uploadedBodies = new Map<string, Blob>();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url === 'blob:https://localstudio.test/allowed') {
        return Promise.resolve(
          new Response(new Uint8Array([1, 2, 3]), {
            headers: { 'content-type': 'audio/webm' },
          }),
        );
      }
      if (init?.method === 'PUT') {
        uploadedBodies.set(url, init.body as Blob);
        return Promise.resolve(new Response('', { status: 200 }));
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });
    const config: MinioMirrorConfig = {
      accessKey: 'writer',
      secretKey: 'writer-secret',
      bucket: 'localstudio',
      endpoint: 'https://storage.test',
      pathStyle: true,
      publicBaseUrl: 'https://cdn.test/localstudio',
      region: 'us-east-1',
      prefix: 'mirrors',
    };
    const mirror = new minioMirrorService.MinioMirrorService({ fetch: fetchMock });
    mirror.saveConfig(config);
    const share = new BrowserShareService({
      mirrorService: mirror,
      origin: 'https://localstudio.test',
    });
    const project = createProject();
    const repository: ProjectRepository = {
      loadProject: () => Promise.resolve(project),
      saveProject: () => Promise.resolve(),
    };
    const service = new PresentationPublishingCapability({
      getSnapshot: () => ({ project, revision: 'revision-1' }),
      isRawRecordingAuthorized: (recording) => recording.id === 'allowed',
      mirror,
      repository,
      share,
    });

    await service.publish({ shareId: 'stable-share' }, () => undefined);

    const pointerUrl = 'https://storage.test/localstudio/mirrors/shares/stable-share.json';
    const pointer = JSON.parse(await uploadedBodies.get(pointerUrl)!.text()) as {
      authoringRevision: string;
      project: ProjectDocument;
    };
    expect(pointer.authoringRevision).toBe('revision-1');
    expect(pointer.project.assets.hero?.objectUrl).toBe(
      'https://cdn.test/localstudio/mirrors/Untitled%20AI%20Deck/assets/hero.png',
    );
    expect(pointer.project.fonts?.inter?.objectUrl).toBe(
      'https://cdn.test/localstudio/mirrors/Untitled%20AI%20Deck/fonts/inter.woff2',
    );
    expect(pointer.project.recordings?.allowed?.audio.objectUrl).toBe(
      'https://cdn.test/localstudio/mirrors/Untitled%20AI%20Deck/recordings/allowed.webm',
    );
    expect(pointer.project.recordings?.private?.audio.objectUrl).toBeUndefined();
    expect(pointer.project.recordings?.private?.segments).toHaveLength(1);
  });

  it('fails safely before remote work when storage configuration is missing', async () => {
    const syncProject = vi.fn();
    const harness = createHarness({
      mirror: {
        loadConfig: () => null,
        syncProject,
      },
    });

    await expect(harness.service.publish({}, () => undefined)).rejects.toThrow(
      'Public sharing requires configured remote storage.',
    );
    expect(syncProject).not.toHaveBeenCalled();
  });

  it('normalizes asset upload failures without exposing remote details', async () => {
    const harness = createHarness({
      mirror: {
        loadConfig: () => ({ bucket: 'presentations' }),
        syncProject: () => Promise.reject(new Error('secret signed URL')),
      },
    });

    await expect(harness.service.publish({}, () => undefined)).rejects.toThrow(
      'Could not publish presentation assets to configured remote storage.',
    );
  });

  it('reports a bounded warning when authorized recording audio is unavailable', async () => {
    const project = createProject();
    project.recordings!.allowed!.audio = { mimeType: 'audio/webm' };
    const harness = createHarness({
      getSnapshot: () => ({ project, revision: 'revision-1' }),
    });
    const progress: PresentationPublishProgress[] = [];

    const result = await harness.service.publish({}, (event) => progress.push(event));

    expect(result.warnings).toEqual(['Authorized recording allowed has no publishable raw audio.']);
    expect(progress.find((event) => event.stage === 'warnings')).toMatchObject({
      progress: 75,
      warnings: ['Authorized recording allowed has no publishable raw audio.'],
    });
  });

  it('rejects stale requested revisions before upload', async () => {
    const syncProject = vi.fn();
    const harness = createHarness({
      mirror: {
        loadConfig: () => ({ bucket: 'presentations' }),
        syncProject,
      },
    });

    await expect(
      harness.service.publish({ expectedRevision: 'revision-0' }, () => undefined),
    ).rejects.toThrow('requested presentation revision is stale');
    expect(syncProject).not.toHaveBeenCalled();
  });

  it('does not move the share pointer when the presentation changes during asset upload', async () => {
    const project = createProject();
    let calls = 0;
    const createShare = vi.fn();
    const updateShare = vi.fn();
    const changingHarness = createHarness({
      getSnapshot: () => ({
        project,
        revision: calls++ === 0 ? 'revision-1' : 'revision-2',
      }),
      share: {
        createShare,
        updateShare,
      },
    });

    await expect(changingHarness.service.publish({}, () => undefined)).rejects.toThrow(
      'presentation changed while publishing assets',
    );
    expect(createShare).not.toHaveBeenCalled();
    expect(updateShare).not.toHaveBeenCalled();
  });

  it('keeps result manifests bounded for large projects', async () => {
    const project = createProject();
    project.pages = Array.from({ length: 55 }, (_, index) => ({
      ...project.pages[0]!,
      id: `page-${index}`,
      name: `Page ${index}`,
    }));
    for (let index = 0; index < 101; index += 1) {
      const assetId = `bounded-asset-${index}`;
      const elementId = `bounded-element-${index}`;
      project.assets[assetId] = {
        id: assetId,
        type: 'image',
        name: assetId,
        mimeType: 'image/png',
      };
      project.elements[elementId] = {
        id: elementId,
        type: 'image',
        assetId,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
      };
      project.pages[0]!.elementIds.push(elementId);
    }
    const harness = createHarness({ getSnapshot: () => ({ project, revision: 'large-revision' }) });

    const result = await harness.service.publish({}, () => undefined);

    expect(result.context.slides).toHaveLength(50);
    expect(result.context.truncated).toBe(true);
    expect(result.mediaManifest).toHaveLength(100);
    expect(result.mediaManifestTruncated).toBe(true);
  });

  it('rejects unsafe share ids before generating object paths', async () => {
    const harness = createHarness();

    await expect(
      harness.service.publish({ shareId: '../private' }, () => undefined),
    ).rejects.toThrow('Share ID must contain');
    expect(harness.publishedProjects).toHaveLength(0);
  });
});
