import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createAppServices as createRealAppServices } from '../../../../src/app/composition';
import type { Asset, ProjectDocument } from '../../../../src/domain/documents/model';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type {
  BackgroundRemovalService,
  FontImportResult,
  FontImportService,
  FontImportRequest,
  MirrorFile,
  MirrorProjectSummary,
  MirrorService,
  MirrorState,
  ProjectRepository,
  PresentationImportService,
  ShareMetadata,
  ShareRecord,
  ShareService,
  StockMediaConfig,
  StockMediaItem,
  StockMediaProviderState,
  StockMediaService,
  TranslatorService,
} from '../../../../src/services/contracts/interfaces';
import type { PptxImportInput } from '../../../../src/services/importing/pptx/pptxImportService';
import type { MinioMirrorConfig } from '../../../../src/services/mirror/minioMirrorService';
import type {
  WebMcpDemoWindow,
  WebMcpTool,
} from '../../../../src/services/webmcp/webMcpToolAdapter';
import { modelSetupService } from '../../../../src/services/model-setup/modelSetupService';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';

function createAppServices(options: Parameters<typeof createRealAppServices>[0] = {}) {
  vi.stubGlobal('showDirectoryPicker', vi.fn());
  return createRealAppServices({
    initialProject: sampleProject.createSampleProject(),
    ...options,
  });
}

async function waitForShareButtonReady() {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Share' })).not.toBeDisabled();
  });
}

async function startFullscreenPresentation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Presentation play options' }));
  await user.click(screen.getByRole('menuitem', { name: 'Present in fullscreen' }));
}

function enableSyncedSharing(services: ReturnType<typeof createAppServices>) {
  services.mirrorService = new RecordingMirrorService();
  services.shareService = new RecordingShareService();
  services.projectRepository = new LoadingProjectRepository(sampleProject.createSampleProject());
  services.persistenceAvailable = true;
  services.skipStoredProjectLoad = false;
}

function createMultiTextProject(textCount: number) {
  const project = sampleProject.createSampleProject();
  const elementIds = Array.from({ length: textCount }, (_, index) => `bulk-text-${index + 1}`);
  return {
    ...project,
    elements: {
      ...project.elements,
      ...Object.fromEntries(
        elementIds.map((elementId, index) => [
          elementId,
          {
            id: elementId,
            type: 'text' as const,
            text: `Deck text ${index + 1}`,
            x: 100,
            y: 100 + index * 20,
            width: 300,
            height: 60,
            rotation: 0,
            opacity: 1,
            visible: true,
            locked: false,
            fontFamily: 'Inter',
            fontSize: 24,
            fontWeight: 600,
            fill: '#ffffff',
            align: 'left' as const,
          },
        ]),
      ),
    },
    pages: elementIds.map((elementId, index) => ({
      ...project.pages[0]!,
      id: `bulk-page-${index + 1}`,
      name: `Slide ${index + 1}`,
      elementIds: [elementId],
    })),
  };
}

class InstantBackgroundRemovalService implements BackgroundRemovalService {
  prepareBackgroundRemoval(
    asset: Asset,
    options?: { onProgress?: (progress: number) => void },
  ): Promise<void> {
    void asset;
    options?.onProgress?.(100);
    return Promise.resolve();
  }

  previewBackgroundMask(): Promise<{ maskUrl: string; score: number }> {
    return Promise.resolve({ maskUrl: 'data:image/png;base64,test', score: 0.9 });
  }

  removeBackground(asset: Asset): Promise<{ asset: Asset }> {
    return Promise.resolve({ asset });
  }
}

const stockImage: StockMediaItem = {
  id: 'photo-1',
  provider: 'unsplash',
  kind: 'image',
  title: 'Mountain sunset',
  authorName: 'Ada Photo',
  thumbnailUrl: 'https://images.unsplash.com/photo-1?w=400',
  mediaUrl: 'https://images.unsplash.com/photo-1?w=1080',
  width: 1200,
  height: 800,
  downloadLocation: 'https://api.unsplash.com/photos/photo-1/download',
};

const stockGif: StockMediaItem = {
  id: 'gif-1',
  provider: 'giphy',
  kind: 'gif',
  title: 'Launch GIF',
  authorName: 'Motion Studio',
  thumbnailUrl: 'https://media.giphy.com/media/gif-1/200w.gif',
  mediaUrl: 'https://media.giphy.com/media/gif-1/giphy.gif',
  videoUrl: 'https://media.giphy.com/media/gif-1/giphy.mp4',
  width: 480,
  height: 270,
};

class ReadyStockMediaService implements StockMediaService {
  trackedItems: StockMediaItem[] = [];

  loadConfig(): StockMediaConfig {
    return { giphyApiKey: 'giphy-key', unsplashAccessKey: 'unsplash-key' };
  }

  saveConfig(): void {
    return undefined;
  }

  clearConfig(): void {
    return undefined;
  }

  getProviderState(): StockMediaProviderState {
    return {
      gifs: { configured: true, provider: 'giphy' },
      images: { configured: true, provider: 'unsplash' },
    };
  }

  searchImages(): Promise<StockMediaItem[]> {
    return Promise.resolve([stockImage]);
  }

  searchGifs(): Promise<StockMediaItem[]> {
    return Promise.resolve([stockGif]);
  }

  trackImageDownload(item: StockMediaItem): Promise<void> {
    this.trackedItems.push(item);
    return Promise.resolve();
  }
}

class InvalidImageStockMediaService extends ReadyStockMediaService {
  override searchImages(): Promise<StockMediaItem[]> {
    return Promise.reject(new Error('Unsplash image search failed with 401 Unauthorized.'));
  }
}

class RejectingProjectRepository implements ProjectRepository {
  loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(null);
  }

  saveProject(): Promise<void> {
    return Promise.reject(new Error('Folder permission denied'));
  }
}

class RejectingLoadProjectRepository implements ProjectRepository {
  loadProject(): Promise<ProjectDocument | null> {
    return Promise.reject(new DOMException('Missing asset file', 'NotFoundError'));
  }

  saveProject(): Promise<void> {
    return Promise.resolve();
  }
}

class SavingProjectRepository implements ProjectRepository {
  savedProjects: ProjectDocument[] = [];
  savedProjectsAs: ProjectDocument[] = [];

  loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(null);
  }

  saveProject(project: ProjectDocument): Promise<void> {
    this.savedProjects.push(project);
    return Promise.resolve();
  }

  saveProjectAs(project: ProjectDocument): Promise<void> {
    this.savedProjectsAs.push(project);
    return Promise.resolve();
  }
}

class LoadingProjectRepository implements ProjectRepository {
  savedProjects: ProjectDocument[] = [];

  constructor(private readonly project: ProjectDocument) {}

  loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(this.project);
  }

  saveProject(project: ProjectDocument): Promise<void> {
    this.savedProjects.push(project);
    return Promise.resolve();
  }
}

const mirrorConfig: MinioMirrorConfig = {
  accessKey: 'localstudio',
  bucket: 'localstudio',
  endpoint: 'http://localhost:9000',
  pathStyle: true,
  publicBaseUrl: 'http://localhost:9000/localstudio',
  region: 'us-east-1',
  secretKey: 'localstudio123',
  prefix: 'mirrors',
};

class RecordingMirrorService implements MirrorService<MinioMirrorConfig> {
  constructor(private readonly storedConfig: MinioMirrorConfig | null = mirrorConfig) {}

  clearConfig = vi.fn();

  syncProject = vi.fn(
    (
      project: ProjectDocument,
      repository: ProjectRepository,
      config: MinioMirrorConfig,
    ): Promise<MirrorState> => {
      void project;
      void repository;
      void config;
      return Promise.resolve({ enabled: true, status: 'synced' });
    },
  );

  loadConfig(): MinioMirrorConfig | null {
    return this.storedConfig;
  }

  saveConfig(): void {
    return undefined;
  }

  listProjects = vi.fn((): Promise<MirrorProjectSummary[]> => Promise.resolve([]));

  downloadProject = vi.fn((): Promise<MirrorFile[]> => Promise.resolve([]));

  deleteProject = vi.fn((): Promise<void> => Promise.resolve());
}

class RecordingShareService implements ShareService {
  records = new Map<string, ShareRecord>();

  constructor(private readonly origin = window.location.origin) {}

  createShare = vi.fn((project: ProjectDocument): Promise<ShareMetadata> => {
    const shareId = crypto.randomUUID();
    const now = new Date().toISOString();
    this.records.set(shareId, { shareId, createdAt: now, updatedAt: now, project });
    return Promise.resolve(this.createMetadata(shareId, now));
  });

  updateShare = vi.fn((shareId: string, project: ProjectDocument): Promise<ShareMetadata> => {
    const now = new Date().toISOString();
    this.records.set(shareId, { shareId, createdAt: now, updatedAt: now, project });
    return Promise.resolve(this.createMetadata(shareId, now));
  });

  getShare = vi.fn(
    (shareId: string): Promise<ShareRecord | null> =>
      Promise.resolve(this.records.get(shareId) ?? null),
  );

  getPublicUrl(shareId: string): string {
    return `${this.origin}/editor/s/${shareId}?src=${encodeURIComponent(
      `http://localhost:9000/localstudio/mirrors/public-shares/${shareId}/share.json`,
    )}`;
  }

  getEmbedUrl(shareId: string): string {
    return `${this.origin}/editor/embed/${shareId}?src=${encodeURIComponent(
      `http://localhost:9000/localstudio/mirrors/public-shares/${shareId}/share.json`,
    )}`;
  }

  getEmbedHtml(shareId: string): string {
    return `<iframe src="${this.getEmbedUrl(shareId)}" width="960" height="540"></iframe>`;
  }

  private createMetadata(shareId: string, timestamp: string): ShareMetadata {
    return {
      shareId,
      publicUrl: this.getPublicUrl(shareId),
      embedUrl: this.getEmbedUrl(shareId),
      embedHtml: this.getEmbedHtml(shareId),
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'published',
    };
  }
}

class RecordingTranslatorService implements TranslatorService {
  prepareTranslation = vi.fn(
    (
      sourceLanguage: string,
      targetLanguage: string,
      options?: { onProgress?: (progress: number) => void },
    ) => {
      void sourceLanguage;
      void targetLanguage;
      options?.onProgress?.(100);
      return Promise.resolve();
    },
  );

  translate = vi.fn((text: string, targetLanguage: string) =>
    Promise.resolve(`${targetLanguage}:${text}`),
  );

  detectLanguage = vi.fn(() => {
    return Promise.resolve('en');
  });
}

class ConcurrentRecordingTranslatorService extends RecordingTranslatorService {
  activeTranslations = 0;
  private releaseTranslationGate: (() => void) | undefined;
  private readonly translationGate = new Promise<void>((resolve) => {
    this.releaseTranslationGate = resolve;
  });
  maxConcurrentTranslations = 0;

  finishTranslations() {
    this.releaseTranslationGate?.();
  }

  override translate = vi.fn(async (text: string, targetLanguage: string) => {
    this.activeTranslations += 1;
    this.maxConcurrentTranslations = Math.max(
      this.maxConcurrentTranslations,
      this.activeTranslations,
    );
    await this.translationGate;
    this.activeTranslations -= 1;
    return `${targetLanguage}:${text}`;
  });
}

class ImportingProjectRepository implements ProjectRepository {
  savedProjects: ProjectDocument[] = [];

  constructor(private readonly project: ProjectDocument) {}

  importProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(this.project);
  }

  loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(null);
  }

  saveProject(project: ProjectDocument): Promise<void> {
    this.savedProjects.push(project);
    return Promise.resolve();
  }
}

class PendingPresentationImportService implements PresentationImportService {
  importCalls: PptxImportInput[] = [];
  resolveImport: ((project: ProjectDocument) => void) | undefined;

  importPowerPoint(input: PptxImportInput): Promise<ProjectDocument> {
    this.importCalls.push(input);
    return new Promise((resolve) => {
      this.resolveImport = resolve;
    });
  }
}

class FailingFontImportService implements FontImportService {
  requests: FontImportRequest[] = [];
  resolveFonts: (() => void) | undefined;

  listDownloadableFonts() {
    return [];
  }

  resolveAndDownloadFonts(requests: FontImportRequest[]): Promise<FontImportResult> {
    this.requests = requests;
    return new Promise((resolve) => {
      this.resolveFonts = () => {
        resolve({
          fonts: {},
          warnings: [
            {
              code: 'font-download-failed',
              message: 'Could not download Montserrat.',
              severity: 'warning',
            },
          ],
        });
      };
    });
  }

  loadProjectFonts(): Promise<void> {
    return Promise.resolve();
  }
}

function createPowerPointFileHandle(file: File | Error) {
  return {
    getFile: () => {
      if (file instanceof File) return Promise.resolve(file);
      return Promise.reject(file);
    },
    kind: 'file',
    name: 'deck.pptx',
  };
}

class RemoteMirrorImportingProjectRepository implements ProjectRepository {
  importedFilePaths: string[] = [];

  loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(null);
  }

  saveProject(): Promise<void> {
    return Promise.resolve();
  }

  async importMirrorFiles(files: MirrorFile[]): Promise<ProjectDocument> {
    this.importedFilePaths = files.map((file) => file.path);
    const projectFile = files.find((file) => file.path === 'project.json');
    if (!projectFile) throw new Error('Missing project.json');
    return JSON.parse(await projectFile.blob.text()) as ProjectDocument;
  }
}

class DeferredLoadingProjectRepository implements ProjectRepository {
  savedProjects: ProjectDocument[] = [];
  private resolveLoad: ((project: ProjectDocument | null) => void) | undefined;

  loadProject(): Promise<ProjectDocument | null> {
    return new Promise((resolve) => {
      this.resolveLoad = resolve;
    });
  }

  saveProject(project: ProjectDocument): Promise<void> {
    this.savedProjects.push(project);
    return Promise.resolve();
  }

  resolveLoadedProject(project: ProjectDocument | null) {
    this.resolveLoad?.(project);
  }
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function createClipboardData(options: { editorObject?: boolean; files?: File[] } = {}) {
  const data = new Map<string, string>();
  if (options.editorObject) data.set('application/x-localstudio-editor-elements', '1');

  return {
    files: options.files ?? [],
    items: [],
    types: Array.from(data.keys()),
    getData: vi.fn((type: string) => data.get(type) ?? ''),
    setData: vi.fn((type: string, value: string) => {
      data.set(type, value);
    }),
  };
}

function createProjectWithVideo(): ProjectDocument {
  const project = sampleProject.createSampleProject();
  project.assets['asset-video'] = {
    id: 'asset-video',
    type: 'video',
    name: 'Demo clip',
    mimeType: 'video/mp4',
    objectUrl: 'blob:video',
  };
  project.elements['video-demo'] = {
    id: 'video-demo',
    type: 'video',
    assetId: 'asset-video',
    x: 120,
    y: 80,
    width: 640,
    height: 360,
    rotation: 0,
    locked: false,
    visible: true,
    opacity: 1,
    loop: false,
    controls: true,
    muted: true,
    autoplayInPreview: true,
    trimStartSeconds: 0,
  };
  project.pages[0]?.elementIds.push('video-demo');
  return project;
}

function createReadyPrepareTranslationMock() {
  return vi.fn(
    (
      sourceLanguage: string,
      targetLanguage: string,
      options?: { onProgress?: (progress: number) => void },
    ) => {
      void sourceLanguage;
      void targetLanguage;
      options?.onProgress?.(100);
      return Promise.resolve();
    },
  );
}

async function openLeftTab(
  user: ReturnType<typeof userEvent.setup>,
  name: 'AI Tools' | 'Animate' | 'Elements' | 'Layout',
) {
  const tab = screen.getByRole('tab', { name });
  if (tab.getAttribute('aria-selected') !== 'true') {
    await user.click(tab);
  }
}

async function selectTitleLayer(user: ReturnType<typeof userEvent.setup>) {
  await openLeftTab(user, 'Layout');
  await user.click(screen.getByRole('button', { name: 'Title' }));
}

async function selectImageLayer(user: ReturnType<typeof userEvent.setup>) {
  await openLeftTab(user, 'Layout');
  await user.click(screen.getByRole('button', { name: 'Selected Image' }));
}

function mockVideoMetadataLoad() {
  const createElement = document.createElement.bind(document);
  return vi
    .spyOn(document, 'createElement')
    .mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = createElement(tagName, options);
      if (tagName.toLowerCase() === 'video') {
        Object.defineProperty(element, 'videoWidth', { configurable: true, value: 1280 });
        Object.defineProperty(element, 'videoHeight', { configurable: true, value: 720 });
        Object.defineProperty(element, 'duration', { configurable: true, value: 8.5 });
        queueMicrotask(() => {
          element.dispatchEvent(new Event('loadedmetadata'));
        });
      }
      return element;
    });
}

function mockControllableVideoMetadataLoad() {
  const createElement = document.createElement.bind(document);
  let videoElement: HTMLElement | undefined;
  const createElementSpy = vi
    .spyOn(document, 'createElement')
    .mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = createElement(tagName, options);
      if (tagName.toLowerCase() === 'video') {
        Object.defineProperty(element, 'videoWidth', { configurable: true, value: 1280 });
        Object.defineProperty(element, 'videoHeight', { configurable: true, value: 720 });
        videoElement = element;
      }
      return element;
    });

  return {
    createElementSpy,
    hasMetadataTarget() {
      return Boolean(videoElement);
    },
    loadMetadata() {
      videoElement?.dispatchEvent(new Event('loadedmetadata'));
    },
  };
}

describe('EditorShell', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/editor/');
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: undefined,
    });
    delete (window as WebMcpDemoWindow).localStudioWebMcpTools;
    vi.restoreAllMocks();
  });

  it('registers WebMCP tools when explicitly enabled', async () => {
    const registerTools = vi.fn<(tools: WebMcpTool[]) => void>();
    window.history.pushState({}, '', '/editor/?webmcp=1');
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: { registerTools },
    });

    render(<EditorShell services={createAppServices()} />);

    await waitFor(() => {
      expect(registerTools).toHaveBeenCalled();
    });
    const tools = registerTools.mock.calls[0]?.[0] ?? [];
    expect(tools.map((tool) => tool.name)).toEqual([
      'create_project',
      'generate_slides',
      'generate_image',
      'translate_text',
      'get_project_snapshot',
    ]);
  });

  it('exposes same-origin demo tools when WebMCP runtime is unavailable', async () => {
    window.history.pushState({}, '', '/editor/?webmcp=1');

    render(<EditorShell services={createAppServices()} />);

    await waitFor(() => {
      expect((window as WebMcpDemoWindow).localStudioWebMcpTools).toHaveLength(5);
    });
    expect((window as WebMcpDemoWindow).localStudioWebMcpTools?.map((tool) => tool.name)).toEqual([
      'create_project',
      'generate_slides',
      'generate_image',
      'translate_text',
      'get_project_snapshot',
    ]);
  });

  it('renders the approved editor shell landmarks', async () => {
    render(<EditorShell services={createAppServices()} />);

    expect(screen.getByText('LocalStudio.dev')).toBeInTheDocument();
    expect(screen.getByText('Untitled AI Deck')).toBeInTheDocument();
    expect(screen.getByText('PT')).toBeInTheDocument();
    expect(await screen.findByText('EN')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prompt actions' })).toBeInTheDocument();
    expect(screen.getByLabelText('Create image prompt')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute('data-selected-elements', '');
  });

  it('does not select any element on startup', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute('data-selected-elements', '');

    await openLeftTab(user, 'Layout');
    expect(screen.getByRole('button', { name: 'Selected Image' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('clears element selection when selecting a page from the pages panel', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    project.pages = [
      project.pages[0]!,
      {
        ...project.pages[0]!,
        id: 'page-2',
        name: 'Slide 2',
      },
    ];
    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await selectImageLayer(user);
    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
      'data-selected-elements',
      'image-hero',
    );

    await user.click(screen.getByRole('button', { name: 'Toggle pages panel' }));
    await user.click(screen.getByRole('button', { name: 'Select Slide 2' }));

    await waitFor(() => {
      expect(screen.getByText('2 / 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute('data-selected-elements', '');
    });
  });

  it('inserts and selects a shape from the Elements panel', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await openLeftTab(user, 'Elements');
    await user.click(screen.getByRole('button', { name: 'Add triangle' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-selected-elements',
        expect.stringMatching(/^shape-/),
      );
    });
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.getByLabelText('Selected shape fill mode')).toBeInTheDocument();

    await openLeftTab(user, 'Layout');
    expect(screen.getByRole('button', { name: 'Background Shape' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('inserts and selects an Unsplash image from the Elements panel', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const stockMediaService = new ReadyStockMediaService();
    services.stockMediaService = stockMediaService;

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Elements');
    await user.click(await screen.findByRole('button', { name: 'Insert image by Ada Photo' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-selected-elements',
        expect.stringMatching(/^image-/),
      );
    });
    expect(stockMediaService.trackedItems).toEqual([stockImage]);
  });

  it('inserts and selects a GIPHY GIF movie from the Elements panel', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    mockVideoMetadataLoad();
    services.stockMediaService = new ReadyStockMediaService();

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Elements');
    await user.click(await screen.findByRole('button', { name: 'Insert GIF Launch GIF' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-selected-elements',
        expect.stringMatching(/^video-/),
      );
    });
    expect(screen.getByLabelText('Launch GIF').tagName.toLowerCase()).toBe('video');
    expect(screen.getByLabelText('Launch GIF')).toHaveAttribute(
      'src',
      'https://media.giphy.com/media/gif-1/giphy.mp4',
    );
  });

  it('shows a generic API key error when stock image search is rejected', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.stockMediaService = new InvalidImageStockMediaService();

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Elements');

    expect(await screen.findByText('API Key is invalid')).toBeInTheDocument();
    expect(screen.queryByText('Unsplash image search failed with 401 Unauthorized.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Configure media integrations' }));

    expect(screen.getByRole('dialog', { name: 'Media integrations' })).toBeInTheDocument();
  });

  it('keeps the Animations panel open after media integration settings are saved', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.stockMediaService = new ReadyStockMediaService();

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Animate');
    expect(screen.getByRole('tab', { name: 'Animate' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: 'Mirror settings' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', {
        name: 'Media integrations',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Save media integrations' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Media integrations' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('tab', { name: 'Animate' })).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to the layout panel from the header view menu', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'View' }));
    await user.click(screen.getByRole('menuitem', { name: 'Toggle Layers Panel' }));

    expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps pages and tool panels mutually exclusive', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'Toggle pages panel' }));
    expect(screen.getByLabelText('Pages')).toBeInTheDocument();

    await openLeftTab(user, 'Layout');

    expect(screen.getByText('4 layers on current page')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pages')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Toggle pages panel' }));

    expect(screen.getByLabelText('Pages')).toBeInTheDocument();
    expect(screen.queryByText('4 layers on current page')).not.toBeInTheDocument();
  });

  it('marks the workspace as zoomed out when the user scales below 100%', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'Zoom Out' }));

    expect(screen.getByLabelText('Canvas workspace')).toHaveClass('workspace-column-zoomed-out');
  });

  it('undoes and redoes editor mutations from the toolbar', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Selected Image' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();
  });

  it('undoes and redoes editor mutations with keyboard shortcuts', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();

    await user.keyboard('{Meta>}z{/Meta}');
    expect(screen.getByRole('button', { name: 'Selected Image' })).toBeInTheDocument();

    await user.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}');
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();
  });

  it('selects all elements on the active slide with the select-all shortcut', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.keyboard('{Meta>}a{/Meta}');
    await openLeftTab(user, 'Layout');

    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
      'data-selected-elements',
      'image-hero,text-subtitle,text-title',
    );
    expect(screen.getByRole('button', { name: 'Selected Image' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Title' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Subtitle' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('renames the project from the toolbar', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'Edit project name Untitled AI Deck' }));
    await user.clear(screen.getByRole('textbox', { name: 'Project name' }));
    await user.type(screen.getByRole('textbox', { name: 'Project name' }), 'Browser Deck{Enter}');

    expect(
      screen.getByRole('button', { name: 'Edit project name Browser Deck' }),
    ).toBeInTheDocument();
  });

  it('toggles persistence from disabled to enabled', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.projectRepository = new SavingProjectRepository();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    expect(screen.getByRole('dialog', { name: 'Save local project' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Save local project' })).toHaveAttribute(
      'data-anchor',
      'persistence',
    );
    await user.clear(screen.getByRole('textbox', { name: 'Project folder name' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Project folder name' }),
      'Mirror Debug Deck',
    );
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));

    expect(screen.getByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit project name Mirror Debug Deck' }),
    ).toBeInTheDocument();
  });

  it('re-enables persistence without opening the folder setup again', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    expect(screen.getByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Persistence enabled' }));
    expect(screen.getByRole('button', { name: 'Persistence disabled' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));

    expect(screen.queryByRole('dialog', { name: 'Save local project' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();
    expect(repository.savedProjects).toHaveLength(2);
  });

  it('writes the persisted project name into the tab URL', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.projectRepository = new SavingProjectRepository();
    window.history.replaceState({}, '', '/');
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));

    expect(window.location.search).toBe('?project=Untitled+AI+Deck');
  });

  it('autosaves project changes after persistence is enabled', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    expect(repository.savedProjects.at(-1)?.name).toBe('Untitled AI Deck');

    await user.click(screen.getByRole('button', { name: 'Edit project name Untitled AI Deck' }));
    await user.clear(screen.getByRole('textbox', { name: 'Project name' }));
    await user.type(screen.getByRole('textbox', { name: 'Project name' }), 'Autosaved Deck{Enter}');

    expect(repository.savedProjects.at(-1)?.name).toBe('Autosaved Deck');
  });

  it('saves the current project as a new local folder from the File menu', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Save As...' }));

    expect(repository.savedProjectsAs).toHaveLength(1);
    expect(repository.savedProjectsAs[0]).toMatchObject({ name: 'Untitled AI Deck' });
  });

  it('keeps persistence disabled when the project folder cannot be saved', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.projectRepository = new RejectingProjectRepository();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));

    expect(await screen.findByRole('button', { name: 'Persistence disabled' })).toBeInTheDocument();
  });

  it('prompts the user to save before mirroring an unsaved project from the File menu', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mirror Now' }));

    expect(screen.getByText('Save the project before mirroring.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Persistence disabled' })).toHaveClass(
      'persistence-attention',
    );
  });

  it('opens mirror settings when mirroring is requested without a saved mirror config', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.projectRepository = new SavingProjectRepository();
    services.mirrorService = new RecordingMirrorService(null);
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mirror Now' }));

    expect(screen.getByRole('dialog', { name: 'Mirror settings' })).toBeInTheDocument();
  });

  it('syncs the current project after mirror settings are saved', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    const mirrorService = new RecordingMirrorService(null);
    services.projectRepository = repository;
    services.mirrorService = mirrorService;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await user.click(screen.getByRole('button', { name: 'Mirror settings' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', {
        name: 'Mirror settings',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => {
      expect(mirrorService.syncProject).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Untitled AI Deck' }),
        repository,
        mirrorConfig,
      );
    });
  });

  it('mirrors the renamed project name from the header bar', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    const mirrorService = new RecordingMirrorService(null);
    services.projectRepository = repository;
    services.mirrorService = mirrorService;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await user.click(screen.getByRole('button', { name: 'Mirror settings' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', {
        name: 'Mirror settings',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => {
      expect(mirrorService.syncProject).toHaveBeenCalledTimes(1);
    });
    mirrorService.syncProject.mockClear();

    await user.click(screen.getByRole('button', { name: 'Edit project name Untitled AI Deck' }));
    await user.clear(screen.getByRole('textbox', { name: 'Project name' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Project name' }),
      'Renamed Mirror Deck{Enter}',
    );

    await waitFor(
      () => {
        expect(mirrorService.syncProject).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Renamed Mirror Deck' }),
          repository,
          mirrorConfig,
        );
      },
      { timeout: 2000 },
    );
    await waitFor(() => {
      expect(mirrorService.deleteProject).toHaveBeenCalledWith('Untitled AI Deck', mirrorConfig);
    });
  });

  it('toggles mirroring from the mirror status icon when a saved config is available', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const mirrorService = new RecordingMirrorService();
    const repository = new DeferredLoadingProjectRepository();
    services.projectRepository = repository;
    services.mirrorService = mirrorService;
    render(<EditorShell services={services} />);

    act(() => {
      repository.resolveLoadedProject({
        ...services.initialProject,
        name: 'Mirrored Folder',
      });
    });

    const mirrorButton = await screen.findByRole('button', { name: 'Mirror up to date' });
    await user.click(mirrorButton);

    expect(mirrorService.clearConfig).not.toHaveBeenCalled();
    expect(screen.getByText('Local only')).toBeInTheDocument();

    const disabledMirrorButton = screen.getByRole('button', { name: 'Mirror disabled' });
    expect(disabledMirrorButton).not.toBeDisabled();
    await user.click(disabledMirrorButton);

    await waitFor(() => {
      expect(mirrorService.syncProject).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByRole('button', { name: 'Mirror up to date' })).toBeInTheDocument();
  });

  it('opens mirror settings from the disabled mirror icon after mirroring is disabled in settings', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new DeferredLoadingProjectRepository();
    services.projectRepository = repository;
    services.mirrorService = new RecordingMirrorService();
    render(<EditorShell services={services} />);

    act(() => {
      repository.resolveLoadedProject({
        ...services.initialProject,
        name: 'Mirrored Folder',
      });
    });

    await user.click(await screen.findByRole('button', { name: 'Mirror settings' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', {
        name: 'Mirror settings',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Disable mirroring' }));

    expect(screen.getByRole('button', { name: 'Mirror disabled' })).toHaveClass('mirror-disabled');

    await user.click(screen.getByRole('button', { name: 'Mirror disabled' }));
    expect(screen.getByRole('dialog', { name: 'Mirror settings' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Enable mirroring' }));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(await screen.findByRole('button', { name: 'Mirror up to date' })).toHaveClass(
      'mirror-synced',
    );
  });

  it('imports an existing project from the File menu', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.projectRepository = new ImportingProjectRepository({
      ...services.initialProject,
      id: 'imported-project',
      name: 'Imported LocalStudio Project',
    });
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import Project' }));

    expect(
      await screen.findByRole('button', { name: 'Edit project name Imported LocalStudio Project' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();
    expect(window.location.search).toBe('?project=Imported+LocalStudio+Project');
  });

  it('shows PowerPoint import progress only after a source is selected', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const importService = new PendingPresentationImportService();
    services.presentationImportService = importService;
    let resolvePicker: ((handles: Array<{ getFile: () => Promise<File> }>) => void) | undefined;
    vi.stubGlobal(
      'showOpenFilePicker',
      vi.fn(
        () =>
          new Promise<Array<{ getFile: () => Promise<File> }>>((resolve) => {
            resolvePicker = resolve;
          }),
      ),
    );
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import PowerPoint...' }));

    expect(screen.queryByRole('progressbar', { name: 'PowerPoint import progress' })).toBeNull();

    act(() => {
      resolvePicker?.([
        {
          getFile: () =>
            Promise.resolve(
              new File(['pptx'], 'deck.pptx', {
                type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              }),
            ),
        },
      ]);
    });

    expect(
      await screen.findByRole('progressbar', { name: 'PowerPoint import progress' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(importService.importCalls).toHaveLength(1);
    });
    expect(importService.importCalls[0]?.file.name).toBe('deck.pptx');

    act(() => {
      importService.resolveImport?.({ ...services.initialProject, name: 'Imported PowerPoint Deck' });
    });

    expect(
      await screen.findByRole('button', { name: 'Edit project name Imported PowerPoint Deck' }),
    ).toBeInTheDocument();
  });

  it('downloads PPTX fonts during import without blocking the deck when fonts fail', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const fontImportService = new FailingFontImportService();
    services.fontImportService = fontImportService;
    services.presentationImportService = {
      importPowerPoint: () =>
        Promise.resolve({
          ...services.initialProject,
          name: 'Imported Font Deck',
          elements: {
            title: {
              id: 'title',
              type: 'text',
              text: 'Custom font',
              x: 0,
              y: 0,
              width: 400,
              height: 100,
              rotation: 0,
              locked: false,
              visible: true,
              opacity: 1,
              align: 'left',
              fill: '#111111',
              fontFamily: 'Montserrat',
              fontSize: 48,
              fontWeight: 700,
            },
          },
          pages: [
            {
              ...services.initialProject.pages[0]!,
              elementIds: ['title'],
            },
          ],
        }),
    };
    vi.stubGlobal(
      'showOpenFilePicker',
      vi.fn(() =>
        Promise.resolve([
          createPowerPointFileHandle(
            new File(['pptx'], 'deck.pptx', {
              type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            }),
          ),
        ] as FileSystemFileHandle[]),
      ),
    );
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import PowerPoint...' }));

    expect(await screen.findAllByText('Downloading fonts')).toHaveLength(2);
    await waitFor(() => {
      expect(fontImportService.resolveFonts).toBeDefined();
    });
    await act(async () => {
      fontImportService.resolveFonts?.();
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(() => resolve());
            });
          });
        });
      });
    });
    expect(
      await screen.findByRole('button', { name: 'Edit project name Imported Font Deck' }),
    ).toBeInTheDocument();
    expect(fontImportService.requests).toEqual([
      { family: 'Montserrat', fontStyle: 'normal', fontWeight: 700 },
    ]);
  });

  it('reports PowerPoint picker failures without starting import progress', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const importService = new PendingPresentationImportService();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    services.presentationImportService = importService;
    vi.stubGlobal(
      'showOpenFilePicker',
      vi.fn(() =>
        Promise.resolve([
          createPowerPointFileHandle(
            new DOMException(
              'A requested file or directory could not be found at the time an operation was processed.',
              'NotFoundError',
            ),
          ),
        ] as FileSystemFileHandle[]),
      ),
    );
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import PowerPoint...' }));

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled();
    });
    expect(importService.importCalls).toHaveLength(0);
    expect(screen.queryByRole('progressbar', { name: 'PowerPoint import progress' })).toBeNull();
    expect(consoleError.mock.calls[0]?.[0]).toBe('[LocalStudio PPTX Import]');
    consoleError.mockRestore();
  });

  it('displays the remote project name after importing a mirrored project', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new RemoteMirrorImportingProjectRepository();
    const mirrorService = new RecordingMirrorService(mirrorConfig);
    services.projectRepository = repository;
    services.mirrorService = mirrorService;
    mirrorService.listProjects.mockResolvedValue([
      {
        id: 'Remote Mirror Deck',
        name: 'Remote Mirror Deck',
        syncedAt: '2026-06-30T10:00:00.000Z',
      },
    ]);
    mirrorService.downloadProject.mockResolvedValue([
      {
        path: 'project.json',
        blob: new Blob(
          [
            JSON.stringify({
              ...services.initialProject,
              id: 'remote-project',
              name: 'Remote Mirror Deck',
            }),
          ],
          { type: 'application/json' },
        ),
      },
    ]);
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import Remote' }));
    await user.click(await screen.findByRole('button', { name: 'Import Remote Mirror Deck' }));

    expect(
      await screen.findByRole('button', { name: 'Edit project name Remote Mirror Deck' }),
    ).toBeInTheDocument();
    expect(repository.importedFilePaths).toContain('project.json');
    expect(window.location.search).toBe('?project=Remote+Mirror+Deck');
  });

  it('preserves hydrated sample hero object URLs during import normalization', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new ImportingProjectRepository({
      ...services.initialProject,
      id: 'imported-project',
      name: 'Imported Hydrated Project',
      assets: {
        ...services.initialProject.assets,
        'asset-hero': {
          ...services.initialProject.assets['asset-hero']!,
          objectUrl: 'blob:hydrated-hero',
          storage: 'file',
          fileName: 'asset-hero.png',
        },
      },
    });
    services.projectRepository = repository;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import Project' }));

    await screen.findByRole('button', { name: 'Edit project name Imported Hydrated Project' });
    expect(repository.savedProjects).toHaveLength(0);
  });

  it('opens a blank project in a new tab from the File menu', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'New Project' }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0]?.[0]).toContain('newProject=1');
    expect(openSpy.mock.calls[0]?.[1]).toBe('_blank');
    expect(openSpy.mock.calls[0]?.[2]).toContain('noopener');
    openSpy.mockRestore();
  });

  it('restores enabled persistence after remounting', async () => {
    const user = userEvent.setup();
    const firstServices = createAppServices();
    firstServices.projectRepository = new SavingProjectRepository();
    const { unmount } = render(<EditorShell services={firstServices} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    unmount();
    const secondServices = createAppServices();
    secondServices.projectRepository = new SavingProjectRepository();
    render(<EditorShell services={secondServices} />);

    expect(await screen.findByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();
  });

  it('loads the last project before autosaving on startup', async () => {
    const repository = new DeferredLoadingProjectRepository();
    const services = createAppServices();
    services.projectRepository = repository;
    window.localStorage.setItem('ew-canvas-ai.persistence-enabled', 'true');
    render(<EditorShell services={services} />);

    expect(repository.savedProjects).toHaveLength(0);

    act(() => {
      repository.resolveLoadedProject({
        ...services.initialProject,
        id: 'last-project',
        name: 'Restored LocalStudio Project',
      });
    });

    expect(
      await screen.findByRole('button', { name: 'Edit project name Restored LocalStudio Project' }),
    ).toBeInTheDocument();
    expect(repository.savedProjects).toHaveLength(0);
  });

  it('restores mirroring from saved config and syncs the loaded local project', async () => {
    const repository = new DeferredLoadingProjectRepository();
    const mirrorService = new RecordingMirrorService();
    const services = createAppServices();
    services.projectRepository = repository;
    services.mirrorService = mirrorService;

    render(<EditorShell services={services} />);

    act(() => {
      repository.resolveLoadedProject({
        ...services.initialProject,
        id: 'mirrored-project',
        name: 'Mirrored Folder',
      });
    });

    expect(
      await screen.findByRole('button', { name: 'Edit project name Mirrored Folder' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();

    await waitFor(() => {
      expect(mirrorService.syncProject).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'mirrored-project', name: 'Mirrored Folder' }),
        repository,
        mirrorConfig,
      );
    });
  });

  it('disables persistence and keeps the initial project when startup restore fails', async () => {
    const services = createAppServices();
    services.projectRepository = new RejectingLoadProjectRepository();
    window.localStorage.setItem('ew-canvas-ai.persistence-enabled', 'true');

    render(<EditorShell services={services} />);

    expect(screen.getByText('Untitled AI Deck')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Persistence disabled' })).toBeInTheDocument();
    expect(window.localStorage.getItem('ew-canvas-ai.persistence-enabled')).toBe('false');
  });

  it('zooms the canvas from the toolbar', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'Zoom In' }));
    expect(screen.getByText('110%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zoom Out' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('keeps insert quick actions visible after adding a second slide', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getAllByRole('button', { name: 'Add page' })[0]!);

    expect(screen.getByRole('button', { name: 'Rename Slide 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert Text' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert Media' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Insert Text' }));
    await openLeftTab(user, 'Layout');
    expect(screen.getByRole('button', { name: 'Add a heading' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('duplicates the active slide with copied elements and remapped animations', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    project.pages[0] = {
      ...project.pages[0]!,
      animationBuilds: [
        {
          id: 'build-image-hero',
          elementId: 'image-hero',
          effect: 'reveal',
          trigger: 'on-click',
          delayMs: 0,
        },
      ],
    };

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await user.click(screen.getByRole('button', { name: 'Duplicate Slide 1' }));

    expect(screen.getByRole('button', { name: 'Rename Slide 1 copy' })).toBeInTheDocument();
    expect(screen.getByLabelText('Animation build 1 for Image')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert Text' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert Media' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Insert Text' }));
    await openLeftTab(user, 'Layout');
    expect(screen.getByRole('button', { name: 'Add a heading' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await openLeftTab(user, 'Animate');
    expect(screen.getByRole('listitem', { name: 'Build 1: Image' })).toBeInTheDocument();
  });

  it('starts animation preview when playing the presentation from the toolbar', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    project.pages[0] = {
      ...project.pages[0]!,
      transition: { effect: 'reveal', delayMs: 0 },
      animationBuilds: [
        {
          id: 'build-image-hero',
          elementId: 'image-hero',
          effect: 'reveal',
          trigger: 'on-click',
          delayMs: 0,
        },
      ],
    };

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await startFullscreenPresentation(user);

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview',
        'playing',
      );
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-mode',
        'presenter',
      );
    });
    expect(screen.queryByLabelText('Animation build 1 for Image')).not.toBeInTheDocument();
  });

  it('opens keyboard shortcuts with question mark while presenting fullscreen', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await startFullscreenPresentation(user);
    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-mode',
        'presenter',
      );
    });

    fireEvent.keyDown(window, { key: '?' });

    expect(screen.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeInTheDocument();
  });

  it('starts animation preview from the Animate panel play button', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    project.pages[0] = {
      ...project.pages[0]!,
      animationBuilds: [
        {
          id: 'build-image-hero',
          elementId: 'image-hero',
          effect: 'reveal',
          trigger: 'on-click',
          delayMs: 0,
        },
      ],
    };

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await openLeftTab(user, 'Animate');
    await user.click(screen.getByRole('button', { name: 'Play animation preview' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview',
        'playing',
      );
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-mode',
        'editor',
      );
      expect(screen.getByText('Click the slide to play the next animation.')).toBeInTheDocument();
    });
  });

  it('advances click-triggered animation preview with the right arrow key', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    project.pages[0] = {
      ...project.pages[0]!,
      transition: { effect: 'reveal', delayMs: 0 },
      animationBuilds: [
        {
          id: 'build-image-hero',
          elementId: 'image-hero',
          effect: 'reveal',
          trigger: 'on-click',
          delayMs: 0,
        },
      ],
    };

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await startFullscreenPresentation(user);

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-waiting',
        'true',
      );
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-mode',
        'presenter',
      );
    });

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(
        screen.queryByText('Click the slide to play the next animation.'),
      ).not.toBeInTheDocument();
    });
  });

  it.each(['ArrowRight', ']'])(
    'starts pending movie-start builds from the %s presentation shortcut',
    async (key) => {
      const user = userEvent.setup();
      const playSpy = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockImplementation(() => Promise.resolve());
      const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
      const project = createProjectWithVideo();
      project.pages[0] = {
        ...project.pages[0]!,
        transition: { effect: 'reveal', delayMs: 0 },
        animationBuilds: [
          {
            id: 'build-video-demo',
            elementId: 'video-demo',
            effect: 'reveal',
            trigger: 'on-click',
            delayMs: 0,
            durationMs: 0,
            mediaAction: 'play',
          },
        ],
      };

      render(<EditorShell services={createAppServices({ initialProject: project })} />);

      await startFullscreenPresentation(user);
      await waitFor(() => {
        expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
          'data-animation-preview-waiting',
          'true',
        );
      });

      fireEvent.keyDown(window, { key });

      expect(playSpy).toHaveBeenCalledTimes(1);
      playSpy.mockRestore();
      pauseSpy.mockRestore();
    },
  );

  it('uses arrow keys to move between slides after the current preview step completes', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    project.pages = [
      {
        ...project.pages[0]!,
        transition: { effect: 'reveal', delayMs: 0 },
        animationBuilds: [
          {
            id: 'build-image-hero',
            elementId: 'image-hero',
            effect: 'reveal',
            trigger: 'on-click',
            delayMs: 0,
          },
        ],
      },
      {
        id: 'page-2',
        name: 'Slide 2',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
        elementIds: [],
        animationBuilds: [],
      },
    ];

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    await startFullscreenPresentation(user);

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-waiting',
        'true',
      );
    });

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(
        screen.queryByText('Click the slide to play the next animation.'),
      ).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-phase',
        'complete',
      );
    });

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getByText('2 / 2')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'ArrowLeft' });

    await waitFor(() => {
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
    });
  });

  it('uses slide clicks to move between slides in presenter mode after the current preview step completes', async () => {
    const user = userEvent.setup();
    let fullscreenElement: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: vi.fn(() => {
        fullscreenElement = document.querySelector('[aria-label="Canvas workspace"]');
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      }),
    });
    const project = sampleProject.createSampleProject();
    project.pages = [
      {
        ...project.pages[0]!,
        transition: { effect: 'reveal', delayMs: 0 },
        animationBuilds: [
          {
            id: 'build-image-hero',
            elementId: 'image-hero',
            effect: 'reveal',
            trigger: 'on-click',
            delayMs: 0,
          },
        ],
      },
      {
        id: 'page-2',
        name: 'Slide 2',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
        elementIds: [],
        animationBuilds: [],
      },
    ];
    const { container } = render(
      <EditorShell services={createAppServices({ initialProject: project })} />,
    );

    await startFullscreenPresentation(user);

    await waitFor(() => {
      expect(document.fullscreenElement).toBe(screen.getByLabelText('Canvas workspace'));
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-waiting',
        'true',
      );
    });

    fireEvent.mouseDown(container.querySelector('canvas')!);

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-phase',
        'complete',
      );
    });

    fireEvent.mouseDown(container.querySelector('canvas')!);

    await waitFor(() => {
      expect(screen.getByText('2 / 2')).toBeInTheDocument();
    });
  });

  it('plays the current slide by default and can play from the beginning from the toolbar menu', async () => {
    const user = userEvent.setup();
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    const project = sampleProject.createSampleProject();
    project.pages = [
      project.pages[0]!,
      {
        id: 'page-2',
        name: 'Slide 2',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
        elementIds: [],
        animationBuilds: [],
      },
      {
        id: 'page-3',
        name: 'Slide 3',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
        elementIds: [],
        animationBuilds: [],
      },
    ];

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await user.click(screen.getByRole('button', { name: 'Activate Slide 3' }));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

    await startFullscreenPresentation(user);

    await waitFor(() => {
      expect(screen.getByText('3 / 3')).toBeInTheDocument();
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-mode',
        'presenter',
      );
    });

    await user.click(screen.getByRole('button', { name: 'Presentation play options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Play from beginning' }));

    await waitFor(() => {
      expect(screen.getByText('1 / 3')).toBeInTheDocument();
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-mode',
        'presenter',
      );
    });
  });

  it('keeps the remote control panel closed on editor load', async () => {
    render(<EditorShell services={createAppServices()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByRole('region', { name: 'Remote control this presentation' })).not.toBeInTheDocument();
  });

  it('opens presenter view with an audience fullscreen prompt and closes the popup on fullscreen exit', async () => {
    const user = userEvent.setup();
    let fullscreenElement: Element | null = null;
    const popupClose = vi.fn();
    const popupPostMessage = vi.fn();
    const popup = {
      close: popupClose,
      closed: false,
      location: { href: '' },
      postMessage: popupPostMessage,
    } as unknown as Window;
    const openWindow = vi.fn(() => popup);
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: openWindow,
    });
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    const requestFullscreen = vi.fn(() => {
      fullscreenElement = document.querySelector('[aria-label="Canvas workspace"]');
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });

    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'Presentation play options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Presenter view' }));

    expect(openWindow).toHaveBeenCalledTimes(1);
    expect(popup.location.href).toContain('presenter=1');
    expect(screen.getByRole('dialog', { name: 'Audience Window' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Remote control this presentation' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Remote control QR code' })).toHaveAttribute(
      'src',
      expect.stringContaining('data:image/png'),
    );
    expect(screen.getByRole('button', { name: 'Copy remote link' })).toBeInTheDocument();
    expect(requestFullscreen).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText('Canvas workspace'));

    expect(screen.queryByRole('region', { name: 'Remote control this presentation' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Enter full screen mode' }));

    await waitFor(() => {
      expect(requestFullscreen).toHaveBeenCalledTimes(1);
      expect(document.fullscreenElement).toBe(screen.getByLabelText('Canvas workspace'));
      expect(screen.queryByRole('dialog', { name: 'Audience Window' })).not.toBeInTheDocument();
    });

    fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));

    await waitFor(() => {
      expect(popupClose).toHaveBeenCalledTimes(1);
    });
  });

  it('hides page insert controls in fullscreen presenter mode and restores a clean editor state on exit', async () => {
    const user = userEvent.setup();
    let fullscreenElement: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: vi.fn(() => {
        fullscreenElement = document.querySelector('[aria-label="Canvas workspace"]');
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      }),
    });
    const project = sampleProject.createSampleProject();
    project.pages = [
      {
        ...project.pages[0]!,
        animationBuilds: [
          {
            id: 'build-image-hero',
            elementId: 'image-hero',
            effect: 'reveal',
            trigger: 'on-click',
            delayMs: 0,
          },
        ],
      },
      {
        id: 'page-2',
        name: 'Slide 2',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
        elementIds: [],
        animationBuilds: [],
      },
    ];

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await selectImageLayer(user);
    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
      'data-selected-elements',
      'image-hero',
    );
    expect(screen.getByRole('button', { name: 'Add page after Slide 1' })).toBeInTheDocument();

    await startFullscreenPresentation(user);

    await waitFor(() => {
      expect(document.fullscreenElement).toBe(screen.getByLabelText('Canvas workspace'));
      expect(
        screen.queryByRole('button', { name: 'Add page after Slide 1' }),
      ).not.toBeInTheDocument();
    });

    fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add page after Slide 1' })).toBeInTheDocument();
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview',
        'idle',
      );
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute('data-selected-elements', '');
    });
  });

  it('keeps the stopped presentation slide active after exiting fullscreen', async () => {
    const user = userEvent.setup();
    let fullscreenElement: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: vi.fn(() => {
        fullscreenElement = document.querySelector('[aria-label="Canvas workspace"]');
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      }),
    });
    const project = sampleProject.createSampleProject();
    project.pages = [
      {
        ...project.pages[0]!,
        transition: { effect: 'reveal', delayMs: 0 },
        animationBuilds: [],
      },
      {
        id: 'page-2',
        name: 'Slide 2',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
        elementIds: [],
        animationBuilds: [],
      },
    ];

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await startFullscreenPresentation(user);

    await waitFor(() => {
      expect(document.fullscreenElement).toBe(screen.getByLabelText('Canvas workspace'));
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getByText('2 / 2')).toBeInTheDocument();
    });

    fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));

    await waitFor(() => {
      expect(screen.getByText('2 / 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview',
        'idle',
      );
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute('data-selected-elements', '');
    });
  });

  it('pastes an image from the clipboard as a new selected layer', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await openLeftTab(user, 'Layout');
    const image = new File(['image-bytes'], 'clipboard.png', { type: 'image/png' });

    fireEvent.paste(screen.getByLabelText('Canvas workspace'), {
      clipboardData: {
        files: [image],
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }],
      },
    });

    expect(await screen.findByRole('button', { name: 'clipboard.png' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('pastes an item-only clipboard image from the window with a fallback name', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await openLeftTab(user, 'Layout');
    const image = new File(['image-bytes'], '', { type: 'image/png' });

    fireEvent.paste(window, {
      clipboardData: {
        files: [],
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }],
      },
    });

    expect(await screen.findByRole('button', { name: 'Pasted image' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('copies and pastes selected objects near the original selection', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    render(<EditorShell services={services} />);
    await selectImageLayer(user);

    fireEvent.copy(window, {
      clipboardData: createClipboardData(),
    });
    fireEvent.paste(window, {
      clipboardData: createClipboardData({ editorObject: true }),
    });

    expect(screen.getByRole('button', { name: 'Selected Image copy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));

    await waitFor(() => {
      const savedProject = repository.savedProjects.at(-1);
      const original = savedProject?.elements['image-hero'];
      const pasted = Object.values(savedProject?.elements ?? {}).find(
        (element) => element.type === 'image' && element.id !== 'image-hero',
      );
      expect(pasted).toMatchObject({
        assetId: original?.type === 'image' ? original.assetId : undefined,
        x: (original?.x ?? 0) + 32,
        y: (original?.y ?? 0) + 32,
      });
    });
  });

  it('does not overwrite copied text when an editable field is active with a selected object', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);
    const clipboardData = createClipboardData();
    const textArea = document.createElement('textarea');
    textArea.value = 'Copied text from editor';
    document.body.append(textArea);
    textArea.focus();
    textArea.select();

    fireEvent.copy(window, {
      clipboardData,
    });

    expect(clipboardData.setData).not.toHaveBeenCalledWith(
      'text/plain',
      'LocalStudio.dev editor elements',
    );
    expect(clipboardData.setData).not.toHaveBeenCalledWith(
      'application/x-localstudio-editor-elements',
      '1',
    );
    textArea.remove();
  });

  it('prefers the latest editor object copy over stale image clipboard data', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await openLeftTab(user, 'Layout');

    fireEvent.copy(window, {
      clipboardData: createClipboardData(),
    });
    await selectTitleLayer(user);
    fireEvent.copy(window, {
      clipboardData: createClipboardData(),
    });

    const staleImage = new File(['stale-image'], 'stale-system-image.png', { type: 'image/png' });
    fireEvent.paste(window, {
      clipboardData: createClipboardData({ editorObject: true, files: [staleImage] }),
    });

    expect(await screen.findByRole('button', { name: 'Title copy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.queryByRole('button', { name: 'stale-system-image.png' }),
    ).not.toBeInTheDocument();
  });

  it('imports a newer system image paste instead of an older editor object copy', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await openLeftTab(user, 'Layout');

    fireEvent.copy(window, {
      clipboardData: createClipboardData(),
    });

    const image = new File(['new-image'], 'new-system-image.png', { type: 'image/png' });
    fireEvent.paste(window, {
      clipboardData: createClipboardData({ files: [image] }),
    });

    expect(await screen.findByRole('button', { name: 'new-system-image.png' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Selected Image copy' })).not.toBeInTheDocument();
  });

  it('cuts selected objects into the editor clipboard', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);

    fireEvent.cut(window, {
      clipboardData: createClipboardData(),
    });
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();

    fireEvent.paste(window, {
      clipboardData: createClipboardData({ editorObject: true }),
    });

    expect(await screen.findByRole('button', { name: 'Selected Image copy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('inserts text and media from the floating toolbar', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    render(<EditorShell services={services} />);
    await openLeftTab(user, 'Layout');
    await selectImageLayer(user);

    await user.click(screen.getByRole('button', { name: 'Insert Text' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add a heading' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await waitFor(() => {
      const insertedText = Object.values(repository.savedProjects.at(-1)?.elements ?? {}).find(
        (element) =>
          element.type === 'text' && element.id !== 'text-title' && element.id !== 'text-subtitle',
      );
      expect(insertedText).toMatchObject({
        type: 'text',
        text: 'Add a heading',
        width: 600,
        height: 240,
        fontFamily: 'Orbitron',
        fontSize: 96,
        fontWeight: 800,
        fill: '#37FD76',
        align: 'center',
      });
    });

    const image = new File(['image-bytes'], 'toolbar-image.png', { type: 'image/png' });
    await selectImageLayer(user);
    await user.click(screen.getByRole('button', { name: 'Insert Media' }));
    await user.upload(screen.getByLabelText('Insert media file'), image);

    expect(await screen.findByRole('button', { name: 'toolbar-image.png' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    mockVideoMetadataLoad();
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:toolbar-video');
    const video = new File(['video-bytes'], 'toolbar-video.mp4', { type: 'video/mp4' });
    await user.click(screen.getByRole('button', { name: 'Insert Media' }));
    await user.upload(screen.getByLabelText('Insert media file'), video);

    await waitFor(() => {
      const savedProject = repository.savedProjects.at(-1);
      const importedVideo = Object.values(savedProject?.elements ?? {}).find(
        (element) => element.type === 'video',
      );
      expect(importedVideo).toMatchObject({
        autoplayInPreview: true,
        playing: true,
        type: 'video',
      });
      expect(savedProject?.assets[importedVideo?.assetId ?? '']?.name).toBe('toolbar-video.mp4');
      expect(savedProject?.assets[importedVideo?.assetId ?? '']?.objectUrl).toBe(
        'blob:toolbar-video',
      );
    });
    expect(createObjectUrl).toHaveBeenCalledWith(video);
    expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Movie' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Selected video trim end')).toHaveValue('8.5');
  });

  it('shows loading feedback while local video metadata is imported', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.projectRepository = new SavingProjectRepository();
    const metadata = mockControllableVideoMetadataLoad();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pending-video');
    render(<EditorShell services={services} />);

    const video = new File(['video-bytes'], 'pending-video.mp4', { type: 'video/mp4' });
    await user.click(screen.getByRole('button', { name: 'Insert Media' }));
    await user.upload(screen.getByLabelText('Insert media file'), video);

    expect(await screen.findByText('Loading media')).toBeInTheDocument();
    expect(
      screen.getByText('Loading video metadata without copying the full file into memory.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(metadata.hasMetadataTarget()).toBe(true);
    });

    act(() => {
      metadata.loadMetadata();
    });

    await waitFor(() => {
      expect(screen.queryByText('Loading media')).not.toBeInTheDocument();
    });
    metadata.createElementSpy.mockRestore();
  });

  it('blocks MOV uploads with a clear unsupported-format message', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL');
    render(<EditorShell services={services} />);

    const video = new File(['video-bytes'], 'phone-video.mov', { type: 'video/quicktime' });
    await user.click(screen.getByRole('button', { name: 'Insert Media' }));
    const input = screen.getByLabelText('Insert media file');
    expect(input).toHaveAttribute('accept', 'image/*,video/*');
    await user.upload(input, video);

    expect(await screen.findByText('Unsupported video format')).toBeInTheDocument();
    expect(screen.getByText('Supported formats')).toBeInTheDocument();
    expect(screen.getByText('info')).toHaveClass('media-import-info-icon');
    expect(screen.getByText(/Video import supports MP4 and WebM files/)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'Media import progress' })).not.toBeInTheDocument();
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(
      Object.values(repository.savedProjects.at(-1)?.assets ?? {}).some(
        (asset) => asset.name === 'phone-video.mov',
      ),
    ).toBe(false);

    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByText('Unsupported video format')).not.toBeInTheDocument();
  });

  it('opens the media settings panel when a video layer is selected', async () => {
    const user = userEvent.setup();
    render(
      <EditorShell services={createAppServices({ initialProject: createProjectWithVideo() })} />,
    );

    await openLeftTab(user, 'Layout');
    await user.click(screen.getByRole('button', { name: 'Demo clip' }));

    expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Movie' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Selected video repeat mode')).toBeInTheDocument();
  });

  it('deletes the selected layer with Delete and Backspace keystrokes', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);

    await user.keyboard('{Delete}');
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await user.click(screen.getByRole('button', { name: 'Selected Image' }));

    await user.keyboard('{Backspace}');
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();
  });

  it('duplicates, centers, and changes z-order from the floating toolbar', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);

    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(screen.getByRole('button', { name: 'Selected Image copy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Align Center' }));
    await user.click(screen.getByRole('button', { name: 'Send Backward' }));
    await user.click(screen.getByRole('button', { name: 'Bring Forward' }));

    expect(screen.getByRole('button', { name: 'Selected Image copy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('translates selected text from the floating toolbar', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    await selectTitleLayer(user);
    await user.click(screen.getByRole('button', { name: 'Translate Selected Text' }));

    await waitFor(() => {
      expect(translator.translate).toHaveBeenCalledWith('AI Design Revolution', 'pt', {
        sourceLanguage: 'en',
      });
    });
  });

  it('updates the header language chip after translating the current slide', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.translatorService = new RecordingTranslatorService();
    render(<EditorShell services={services} />);

    expect(
      await screen.findByRole('button', { name: 'Current slide language English' }),
    ).toBeInTheDocument();
    expect(
      (services.translatorService as RecordingTranslatorService).detectLanguage,
    ).toHaveBeenCalledWith(expect.any(String), { allowModelPreparation: false });

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    expect(await screen.findByText('Pair: en → pt')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Translate Slide 1' })[0]!);

    expect(
      await screen.findByRole('button', { name: 'Current slide language Portuguese' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Pair: pt → pt')).toBeInTheDocument();
  });

  it('ignores repeated translate clicks while a translation is running', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translation = createDeferred<string>();
    const translate = vi.fn().mockReturnValue(translation.promise);
    services.translatorService = {
      detectLanguage: vi.fn().mockResolvedValue('en'),
      prepareTranslation: createReadyPrepareTranslationMock(),
      translate,
    };
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'es');
    await selectTitleLayer(user);
    await user.dblClick(screen.getByRole('button', { name: 'Translate Selected Text' }));

    expect(translate).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Translating text...')).toBeInTheDocument();

    translation.resolve('Texto traducido');
  });

  it('shows translation errors instead of leaving an unhandled promise', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.translatorService = {
      detectLanguage: vi.fn().mockResolvedValue('en'),
      prepareTranslation: createReadyPrepareTranslationMock(),
      translate: vi
        .fn()
        .mockRejectedValue(new Error('Chrome Built-in AI translation is not ready.')),
    };
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'es');
    await selectTitleLayer(user);
    await user.click(screen.getByRole('button', { name: 'Translate Selected Text' }));

    expect(
      await screen.findByText('Chrome Built-in AI translation is not ready.'),
    ).toBeInTheDocument();
  });

  it('fits translated selected text back into the original text frame', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    const translate = vi
      .fn()
      .mockResolvedValue('Revolucion\n de diseno impulsada por inteligencia artificial');
    services.projectRepository = repository;
    services.translatorService = {
      detectLanguage: vi.fn().mockResolvedValue('en'),
      prepareTranslation: createReadyPrepareTranslationMock(),
      translate,
    };
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'es');
    await selectTitleLayer(user);
    await user.click(screen.getByRole('button', { name: 'Translate Selected Text' }));

    await waitFor(() => {
      expect(translate).toHaveBeenCalledWith('AI Design Revolution', 'es', {
        sourceLanguage: 'en',
      });
    });
    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));

    await waitFor(() => {
      const title = repository.savedProjects.at(-1)?.elements['text-title'];
      expect(title).toMatchObject({
        fontSize: 96,
        text: 'Revolucion de diseno impulsada por inteligencia artificial',
      });
      expect(title?.width).toBeGreaterThan(600);
    });
  });

  it('redirects the first translation attempt to AI Tools until a target language is selected', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await selectTitleLayer(user);
    await user.click(screen.getByRole('button', { name: 'Translate Selected Text' }));

    expect(screen.getByRole('tab', { name: 'AI Tools' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Translate to')).toHaveValue('');
    expect(translator.translate).not.toHaveBeenCalled();
  });

  it('translates every visible unlocked text element on the current slide', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    await user.click(screen.getAllByRole('button', { name: 'Translate Slide 1' })[0]!);

    await waitFor(() => {
      expect(translator.translate).toHaveBeenCalledWith('AI Design Revolution', 'pt', {
        sourceLanguage: 'en',
      });
      expect(translator.translate).toHaveBeenCalledWith(
        'Browser-native creative automation',
        'pt',
        {
          sourceLanguage: 'en',
        },
      );
    });
  });

  it('uses the prepared source language when translating back to another language', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translate = vi.fn().mockResolvedValue('AI Design Revolution');
    services.translatorService = {
      detectLanguage: vi.fn().mockResolvedValueOnce('es').mockResolvedValue('gl'),
      prepareTranslation: createReadyPrepareTranslationMock(),
      translate,
    };
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'en');
    await selectTitleLayer(user);
    await user.click(screen.getByRole('button', { name: 'Translate Selected Text' }));

    await waitFor(() => {
      expect(translate).toHaveBeenCalledWith('AI Design Revolution', 'en', {
        sourceLanguage: 'es',
      });
    });
  });

  it('translates the full deck from the Edit menu', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Current slide language English' }),
      ).toBeInTheDocument();
    });
    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('menuitem', { name: 'Translate Deck' }));

    await waitFor(() => {
      expect(translator.translate).toHaveBeenCalledWith('AI Design Revolution', 'pt', {
        sourceLanguage: 'en',
      });
      expect(translator.translate).toHaveBeenCalledWith(
        'Browser-native creative automation',
        'pt',
        {
          sourceLanguage: 'en',
        },
      );
    });
  });

  it('uses the active slide language as the full-deck translation source', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    translator.detectLanguage
      .mockResolvedValueOnce('en')
      .mockResolvedValueOnce('cy');
    translator.prepareTranslation.mockRejectedValueOnce(
      new Error('Chrome Built-in AI translation is not ready for cy to pt.'),
    );
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Current slide language English' }),
      ).toBeInTheDocument();
    });
    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    await waitFor(() => {
      expect(translator.prepareTranslation).toHaveBeenCalled();
    });

    await user.click(screen.getByRole('button', { name: 'Translate deck' }));

    await waitFor(() => {
      expect(translator.prepareTranslation).toHaveBeenCalledWith('en', 'pt');
      expect(translator.translate).toHaveBeenCalledWith('AI Design Revolution', 'pt', {
        sourceLanguage: 'en',
      });
    });
  });

  it('translates the full deck with the toolbar-selected language path', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Current slide language English' }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Translation path options' }));
    await user.selectOptions(screen.getByLabelText('Translate from'), 'es');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'en');
    await user.click(screen.getByRole('button', { name: 'Translate deck' }));

    await waitFor(() => {
      expect(translator.prepareTranslation).toHaveBeenCalledWith('es', 'en');
      expect(translator.translate).toHaveBeenCalledWith('AI Design Revolution', 'en', {
        sourceLanguage: 'es',
      });
    });
  });

  it('translates the full deck from the toolbar icon with bounded concurrency', async () => {
    const user = userEvent.setup();
    const services = createAppServices({ initialProject: createMultiTextProject(8) });
    const translator = new ConcurrentRecordingTranslatorService();
    services.translatorService = translator;
    const { container } = render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    await waitFor(() => {
      expect(translator.prepareTranslation).toHaveBeenCalled();
    });
    const translateDeckButton = screen.getByRole('button', { name: 'Translate deck' });
    await waitFor(() => {
      expect(translateDeckButton).not.toBeDisabled();
    });
    await user.click(translateDeckButton);

    await waitFor(() => {
      expect(translator.translate).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(/^Translating Slide [1-3] · 0\/8$/)).toBeInTheDocument();
    });
    expect(translateDeckButton).toHaveClass('deck-translate-button-active');
    expect(container.querySelector('.scroll-page-translating')).toBeInTheDocument();

    translator.finishTranslations();
    await waitFor(() => {
      expect(translator.translate).toHaveBeenCalledTimes(8);
    });
    expect(translator.maxConcurrentTranslations).toBeLessThanOrEqual(3);
  });

  it('blocks background subject selection until image editing models are downloaded', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);

    await user.click(screen.getByRole('button', { name: 'BG Remover' }));

    expect(
      screen.getByText('You must download the image editing tools first.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Right click adds areas to keep. Left click applies the background removal.',
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BG Remover' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'AI Tools' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Download Image Editing Models' })).toHaveClass(
      'icon-button-attention',
    );

    await user.keyboard('{Escape}');

    expect(
      screen.queryByText('You must download the image editing tools first.'),
    ).not.toBeInTheDocument();
  });

  it('enters and cancels background subject selection after image editing models are ready', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    services.backgroundRemovalService = new InstantBackgroundRemovalService();
    await services.modelSetupService.downloadModel('image-editing-models');

    render(<EditorShell services={services} />);
    await selectImageLayer(user);

    await user.click(screen.getByRole('button', { name: 'BG Remover' }));

    expect(
      await screen.findByText(
        'Right click adds areas to keep. Left click applies the background removal.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel BG Remover' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(
      screen.queryByText(
        'Right click adds areas to keep. Left click applies the background removal.',
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BG Remover' })).toBeInTheDocument();
  });

  it('opens Share before MinIO is synced and disables only public link creation', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'Share' }));

    expect(screen.getByRole('heading', { name: 'Share design' })).toBeInTheDocument();
    expect(
      screen.getByText('Public links cannot be created without remote storage.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Present' })).not.toBeDisabled();
  });

  it('exports the current slide as a PNG file', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    enableSyncedSharing(services);
    const downloadDataUrl = vi.fn();
    services.exportService = {
      getPageImageFileName: () => 'slide.png',
      getPdfFileName: () => 'deck.pdf',
      downloadDataUrl,
    };

    render(<EditorShell services={services} />);

    await waitForShareButtonReady();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(downloadDataUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^data:image\/png/),
      'slide.png',
    );
  });

  it('creates and shows a public link from the share panel', async () => {
    const user = userEvent.setup();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000301');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    });
    const services = createAppServices();
    enableSyncedSharing(services);

    render(<EditorShell services={services} />);

    await waitForShareButtonReady();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    const expectedPublicUrl = `${
      window.location.origin
    }/editor/s/00000000-0000-4000-8000-000000000301?src=${encodeURIComponent(
      'http://localhost:9000/localstudio/mirrors/public-shares/00000000-0000-4000-8000-000000000301/share.json',
    )}`;
    expect(await screen.findByDisplayValue(expectedPublicUrl)).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expectedPublicUrl);
  });

  it('enters fullscreen presentation mode from the share panel', async () => {
    const user = userEvent.setup();
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    const services = createAppServices();
    enableSyncedSharing(services);

    render(<EditorShell services={services} />);

    await waitForShareButtonReady();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    await user.click(screen.getByRole('button', { name: 'Present' }));

    expect(requestFullscreen).toHaveBeenCalled();
    expect(requestFullscreen.mock.instances[0]).toBe(screen.getByLabelText('Canvas workspace'));
  });

  it('shows speaker notes as a Canva-style side panel with controls', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    const notesToggle = screen.getByRole('button', { name: 'Toggle notes panel' });
    expect(notesToggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('heading', { name: 'Page 1 - Slide 1' })).not.toBeInTheDocument();

    await user.click(notesToggle);

    expect(notesToggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Page 1 - Slide 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Timer' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change notes text size' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close notes panel' })).toBeInTheDocument();
    expect(screen.getByText('0/5000')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Speaker notes'), 'Opening note');

    expect(screen.getByText('12/5000')).toBeInTheDocument();

    await user.click(notesToggle);
    expect(screen.queryByRole('heading', { name: 'Page 1 - Slide 1' })).not.toBeInTheDocument();
  });

  it('does not show the page size overlay on the canvas', () => {
    render(<EditorShell services={createAppServices()} />);

    expect(screen.queryByText('1920 x 1080')).not.toBeInTheDocument();
  });
});
