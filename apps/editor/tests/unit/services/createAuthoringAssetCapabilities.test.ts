import { describe, expect, it, vi } from 'vitest';
import type { Asset, ProjectDocument } from '../../../src/domain/documents/model';
import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { createAuthoringAssetCapabilities } from '../../../src/services/automation/createAuthoringAssetCapabilities';
import type {
  FontImportService,
  ImageGenerationService,
  LocalFontMirrorService,
  ModelSetupService,
  ModelState,
  StockMediaItem,
  StockMediaService,
} from '../../../src/services/contracts/interfaces';

function createFontImportService(): FontImportService {
  return {
    listDownloadableFonts: () => [
      { family: 'Inter', source: 'google-fonts' },
      { aliases: ['Helvetica'], family: 'Arimo', source: 'google-fonts' },
    ],
    loadProjectFonts: () => Promise.resolve(),
    resolveAndDownloadFonts: () => Promise.resolve({ fonts: {}, resolutions: [], warnings: [] }),
  };
}

function createLocalFontMirrorService(): LocalFontMirrorService {
  return {
    chooseFontFolder: () => Promise.reject(new Error('unused')),
    getSettings: () => ({ enabled: true, supported: true, systemHint: 'local fonts' }),
    getTestFontFiles: () => Promise.resolve([]),
    importFontFamily: (project) =>
      Promise.resolve({ project, addedFonts: [], unresolvedFamilies: [], warnings: [] }),
    importProjectFonts: (project) =>
      Promise.resolve({ project, addedFonts: [], unresolvedFamilies: [], warnings: [] }),
    listAvailableFonts: () =>
      Promise.resolve([
        { family: 'Inter', source: 'local-font-folder' },
        { family: 'Studio Sans', source: 'local-font-folder' },
      ]),
    setEnabled: (enabled) => ({ enabled, supported: true, systemHint: 'local fonts' }),
    validateTestFontFiles: () => Promise.resolve({}),
  };
}

function createStockItem(id: string, kind: StockMediaItem['kind'] = 'image'): StockMediaItem {
  const provider = kind === 'image' ? 'unsplash' : 'giphy';
  return {
    id,
    provider,
    kind,
    title: `${kind} ${id}`,
    authorName: 'Media Author',
    authorUrl: `https://example.test/authors/${id}`,
    thumbnailUrl: `https://example.test/previews/${id}`,
    mediaUrl: `https://example.test/media/${id}`,
    width: 1200,
    height: 800,
  };
}

function createStockMediaService(
  options: { configured?: boolean; images?: StockMediaItem[]; gifs?: StockMediaItem[] } = {},
): StockMediaService {
  const configured = options.configured ?? true;
  return {
    clearConfig: vi.fn(),
    downloadMedia: vi.fn(() =>
      Promise.resolve({
        blob: new Blob(['media'], { type: 'image/jpeg' }),
        mimeType: 'image/jpeg',
        objectUrl: 'blob:stock-media',
      }),
    ),
    getProviderState: () => ({
      gifs: { configured, provider: 'giphy' },
      images: { configured, provider: 'unsplash' },
    }),
    loadConfig: () =>
      configured ? { giphyApiKey: 'secret-giphy-key', unsplashAccessKey: 'secret-key' } : null,
    saveConfig: vi.fn(),
    searchGifs: () => Promise.resolve(options.gifs ?? []),
    searchImages: () => Promise.resolve(options.images ?? []),
    trackImageDownload: vi.fn(() => Promise.resolve()),
  };
}

function createModelSetupService(states: ModelState[]): ModelSetupService {
  const downloadModel: ModelSetupService['downloadModel'] = (id, options) => {
    options?.onProgress?.(50, { loadedBytes: 50, totalBytes: 100 });
    const state = states.find((candidate) => candidate.id === id);
    if (!state) return Promise.reject(new Error(`Unknown model: ${id}`));
    return Promise.resolve({ ...state, status: 'ready' as const, progress: 100 });
  };
  return {
    downloadModel: vi.fn(downloadModel),
    downloadRequiredModels: () => Promise.resolve(states),
    getModelStates: () => Promise.resolve(states.map((state) => ({ ...state }))),
  };
}

function createModelState(id: string, required: boolean): ModelState {
  return {
    id,
    label: id,
    provider: 'transformers',
    status: 'needs-download',
    progress: 0,
    required,
    loadedBytes: 20,
    totalBytes: 100,
  };
}

function createHarness(
  options: {
    imageGenerationService?: ImageGenerationService;
    localFontMirrorService?: LocalFontMirrorService;
    modelSetupService?: ModelSetupService;
    project?: ProjectDocument;
    stockMediaService?: StockMediaService;
  } = {},
) {
  let project = options.project ?? sampleProject.createBlankProject();
  const applyProject = vi.fn((nextProject: ProjectDocument) => {
    project = nextProject;
  });
  const modelSetupService =
    options.modelSetupService ??
    createModelSetupService([createModelState('required-model', true)]);
  const capabilities = createAuthoringAssetCapabilities({
    applyProject,
    fontImportService: createFontImportService(),
    getProject: () => project,
    imageGenerationService:
      options.imageGenerationService ??
      ({
        generateImage: () => Promise.reject(new Error('unused')),
      } satisfies ImageGenerationService),
    localFontMirrorService: options.localFontMirrorService ?? createLocalFontMirrorService(),
    modelSetupService,
    promptService: {
      getProviderStates: () =>
        Promise.resolve([
          {
            id: 'gemma',
            label: 'Gemma',
            description: 'Browser-local prompt model.',
            capability: 'prompt',
            runtime: 'webgpu-huggingface',
            compatibility: 'compatible',
            modelId: 'required-model',
            readiness: 'needs-download',
            selected: true,
          },
        ]),
    },
    stockMediaService: options.stockMediaService ?? createStockMediaService(),
    translatorService: {
      getLanguageDetectionProviderStates: () => Promise.resolve([]),
      getProviderStates: () => Promise.resolve([]),
    },
    getBrowserCompatibility: () => ({ cacheStorage: true, objectUrls: true, webGpu: true }),
  });
  return { applyProject, capabilities, getProject: () => project, modelSetupService };
}

describe('createAuthoringAssetCapabilities', () => {
  it('deduplicates built-in, project, local, and downloadable fonts with readiness', async () => {
    const project = sampleProject.createBlankProject();
    project.fonts = {
      'project-inter': {
        id: 'project-inter',
        family: 'Inter',
        requestedFamily: 'Inter',
        source: 'google-fonts',
        fontStyle: 'normal',
        fontWeight: 400,
        mimeType: 'font/woff2',
        fileName: 'inter.woff2',
        storage: 'inline',
      },
    };
    const { capabilities } = createHarness({ project });

    const result = await capabilities.listAuthoringCatalog({ kind: 'fonts' });

    expect(result).toMatchObject({ kind: 'fonts', truncated: false, warnings: [] });
    if (result.kind !== 'fonts') throw new Error('Expected font catalog.');
    expect(result.items.filter((font) => font.family === 'Inter')).toEqual([
      {
        aliases: [],
        family: 'Inter',
        readiness: 'ready',
        sources: ['built-in', 'downloadable', 'local-folder', 'project'],
      },
    ]);
    expect(result.items).toContainEqual({
      aliases: [],
      family: 'Studio Sans',
      readiness: 'ready-local',
      sources: ['local-folder'],
    });
    expect(result.items).toContainEqual({
      aliases: ['Helvetica'],
      family: 'Arimo',
      readiness: 'downloadable',
      sources: ['downloadable'],
    });
  });

  it('returns the remaining catalog when the local font folder cannot be inspected', async () => {
    const localFontMirrorService = createLocalFontMirrorService();
    localFontMirrorService.listAvailableFonts = () => Promise.reject(new Error('private path'));
    const { capabilities } = createHarness({ localFontMirrorService });

    const result = await capabilities.listAuthoringCatalog({ kind: 'fonts' });

    expect(result).toMatchObject({
      kind: 'fonts',
      warnings: ['Local font folder could not be inspected. Reconnect it in font settings.'],
    });
    expect(JSON.stringify(result)).not.toContain('private path');
  });

  it('filters specialized animations by element type and returns applicability details', async () => {
    const { capabilities } = createHarness();

    const text = await capabilities.listAuthoringCatalog({
      kind: 'animations',
      elementType: 'text',
    });
    const shape = await capabilities.listAuthoringCatalog({
      kind: 'animations',
      elementType: 'shape',
    });
    const video = await capabilities.listAuthoringCatalog({
      kind: 'animations',
      elementType: 'video',
    });

    if (text.kind !== 'animations' || shape.kind !== 'animations' || video.kind !== 'animations') {
      throw new Error('Expected animation catalogs.');
    }
    expect(text.items.map((item) => item.effect)).toContain('keyboard-typing');
    expect(text.items.map((item) => item.effect)).not.toContain('line-draw');
    expect(shape.items.map((item) => item.effect)).toContain('line-draw');
    expect(shape.items.map((item) => item.effect)).not.toContain('keyboard-typing');
    expect(video.mediaActions).toEqual(['play']);
    expect(text.items.find((item) => item.effect === 'reveal')).toMatchObject({
      defaultDurationMs: 500,
      defaultKind: 'build-in',
      defaultTrigger: 'on-click',
      directions: ['down', 'left', 'right', 'up'],
      kinds: ['build-in', 'build-out', 'emphasis'],
      triggers: ['on-click', 'after-transition', 'after-previous'],
    });
  });

  it('returns bounded, deduplicated stable media references and resolves them later', async () => {
    const first = createStockItem('photo-1');
    const stockMediaService = createStockMediaService({
      images: [first, first, createStockItem('photo-2')],
    });
    const { capabilities } = createHarness({ stockMediaService });

    const result = await capabilities.searchMedia({ kind: 'image', term: 'launch', limit: 1 });

    expect(result).toEqual({
      items: [
        {
          attribution: {
            authorName: 'Media Author',
            authorUrl: 'https://example.test/authors/photo-1',
            provider: 'unsplash',
          },
          dimensions: { height: 800, width: 1200 },
          kind: 'image',
          mediaRef: 'stock:unsplash:image:photo-1',
          previewUrl: 'https://example.test/previews/photo-1',
          provider: 'unsplash',
          title: 'image photo-1',
        },
      ],
      kind: 'image',
      limit: 1,
      provider: 'unsplash',
      total: 2,
    });
    expect(JSON.stringify(result)).not.toContain('secret-key');
    const resolved = await capabilities.resolveMediaRef(result.items[0]!.mediaRef);
    expect(resolved.id).toMatch(/^asset-stock-/);
    expect(resolved).toMatchObject({ type: 'image', objectUrl: 'blob:stock-media' });
  });

  it('returns an actionable missing-provider error without exposing configuration', async () => {
    const { capabilities } = createHarness({
      stockMediaService: createStockMediaService({ configured: false }),
    });

    await expect(capabilities.searchMedia({ kind: 'gif', term: 'launch' })).rejects.toThrow(
      'Configure GIPHY in Media integrations before searching GIFs.',
    );
  });

  it('reports browser compatibility, selected providers, readiness, sizes, and errors', async () => {
    const failedModel = {
      ...createModelState('failed-model', false),
      status: 'failed' as const,
      error: 'Download interrupted.',
    };
    const { capabilities } = createHarness({
      modelSetupService: createModelSetupService([failedModel]),
    });

    await expect(capabilities.getAiModelStatus()).resolves.toMatchObject({
      browser: { cacheStorage: true, objectUrls: true, webGpu: true },
      models: [
        {
          compatible: true,
          downloadedBytes: 20,
          error: 'Download interrupted.',
          modelId: 'failed-model',
          sizeKnown: true,
          status: 'failed',
          totalBytes: 100,
        },
      ],
      selectedProviders: [{ id: 'gemma', selected: true }],
    });
  });

  it('prepares required or selected models with aggregate progress and rejects unknown IDs', async () => {
    const states = [
      createModelState('required-model', true),
      createModelState('optional-model', false),
    ];
    const { capabilities } = createHarness({
      modelSetupService: createModelSetupService(states),
    });
    const reports: Array<Record<string, unknown>> = [];

    await expect(
      capabilities.prepareAiModels({ modelIds: ['optional-model', 'optional-model'] }, (value) =>
        reports.push(value),
      ),
    ).resolves.toMatchObject([{ id: 'optional-model', status: 'ready' }]);
    expect(reports).toContainEqual(
      expect.objectContaining({
        loadedBytes: 50,
        progress: 50,
        totalBytes: 100,
      }),
    );

    await expect(capabilities.prepareAiModels({}, vi.fn())).resolves.toMatchObject([
      { id: 'required-model', status: 'ready' },
    ]);
    await expect(
      capabilities.prepareAiModels({ modelIds: ['not-a-model'] }, vi.fn()),
    ).rejects.toThrow('Unknown model IDs: not-a-model.');
  });

  it('adds generated images to project assets without inserting a slide element', async () => {
    const asset: Asset = {
      id: 'asset-generated-1',
      type: 'image',
      name: 'Generated launch.png',
      mimeType: 'image/png',
      objectUrl: 'blob:generated-image',
    };
    const generateImageImplementation: ImageGenerationService['generateImage'] = (
      _prompt,
      options,
    ) => {
      options?.onProgress?.({ label: 'Generating image 1/1', progress: 100 });
      return Promise.resolve(asset);
    };
    const generateImage = vi.fn(generateImageImplementation);
    const { applyProject, capabilities, getProject } = createHarness({
      imageGenerationService: { generateImage },
    });
    const elementCount = Object.keys(getProject().elements).length;

    await expect(
      capabilities.generateImage({ prompt: 'A launch scene', width: 1024 }, vi.fn()),
    ).resolves.toEqual({
      assetId: 'asset-generated-1',
      mimeType: 'image/png',
      name: 'Generated launch.png',
    });
    expect(generateImage).toHaveBeenCalledTimes(1);
    expect(generateImage.mock.calls[0]?.[0]).toBe('A launch scene');
    expect(generateImage.mock.calls[0]?.[1]?.width).toBe(1024);
    expect(generateImage.mock.calls[0]?.[1]?.onProgress).toBeTypeOf('function');
    expect(applyProject.mock.calls).toHaveLength(1);
    expect(getProject().assets['asset-generated-1']).toEqual(asset);
    expect(Object.keys(getProject().elements)).toHaveLength(elementCount);
  });
});
