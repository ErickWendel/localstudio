import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createAppServices as createRealAppServices } from '../../../../src/app/composition';
import type { Asset, ProjectDocument } from '../../../../src/domain/documents/model';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type {
  BackgroundRemovalService,
  MirrorFile,
  MirrorProjectSummary,
  MirrorService,
  MirrorState,
  ProjectRepository,
  ShareMetadata,
  ShareRecord,
  ShareService,
  StockMediaConfig,
  StockMediaItem,
  StockMediaProviderState,
  StockMediaService,
  TranslatorService,
  VersionHistoryEntry,
} from '../../../../src/services/contracts/interfaces';
import type { MinioMirrorConfig } from '../../../../src/services/mirror/minioMirrorService';

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

class VersionHistoryProjectRepository extends SavingProjectRepository {
  constructor(
    private readonly project: ProjectDocument,
    private readonly versionProject: ProjectDocument,
    private readonly entries: VersionHistoryEntry[],
  ) {
    super();
  }

  override loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(this.project);
  }

  getVersionHistory(): Promise<VersionHistoryEntry[]> {
    return Promise.resolve(this.entries);
  }

  loadVersion(): Promise<ProjectDocument | null> {
    return Promise.resolve(this.versionProject);
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
export const editorShellTestHarness = {
  ConcurrentRecordingTranslatorService,
  DeferredLoadingProjectRepository,
  ImportingProjectRepository,
  InstantBackgroundRemovalService,
  InvalidImageStockMediaService,
  LoadingProjectRepository,
  ReadyStockMediaService,
  RecordingMirrorService,
  RecordingShareService,
  RecordingTranslatorService,
  RejectingLoadProjectRepository,
  RejectingProjectRepository,
  RemoteMirrorImportingProjectRepository,
  SavingProjectRepository,
  VersionHistoryProjectRepository,
  createAppServices,
  createClipboardData,
  createDeferred,
  createMultiTextProject,
  createProjectWithVideo,
  createReadyPrepareTranslationMock,
  enableSyncedSharing,
  mirrorConfig,
  mockControllableVideoMetadataLoad,
  mockVideoMetadataLoad,
  openLeftTab,
  selectImageLayer,
  selectTitleLayer,
  startFullscreenPresentation,
  stockImage,
  waitForShareButtonReady,
};
