import type { Asset, ImportWarning, ProjectDocument, ProjectFont } from '../../domain/documents/model';
import type { PptxImportInput } from '../importing/pptx/pptxImportService';
import type {
  GeneratedSlideElement,
  GeneratedSlideTask,
  GeneratedSlideTasksDocument,
} from '../../domain/generated-slides/generatedSlide';

export type ModelStatus = 'unavailable' | 'needs-download' | 'downloading' | 'ready' | 'failed';
export type AiCapability =
  | 'prompt'
  | 'translation'
  | 'language-detection'
  | 'image-generation'
  | 'image-editing';
export type AiProviderRuntime = 'chrome-built-in' | 'webgpu-huggingface';
export type AiProviderCompatibility = 'compatible' | 'incompatible' | 'unknown';

export interface ModelDownloadProgressDetails {
  estimatedRemainingMs?: number | undefined;
  loadedBytes?: number | undefined;
  totalBytes?: number | undefined;
}

export interface ModelState {
  id: string;
  label: string;
  description?: string;
  error?: string | undefined;
  estimatedRemainingMs?: number | undefined;
  loadedBytes?: number | undefined;
  provider: 'chrome' | 'transformers';
  status: ModelStatus;
  progress: number;
  required: boolean;
  totalBytes?: number | undefined;
}

export interface AiProviderState {
  id: string;
  label: string;
  description: string;
  capability: Extract<AiCapability, 'prompt' | 'translation' | 'language-detection'>;
  runtime: AiProviderRuntime;
  compatibility: AiProviderCompatibility;
  disabledReason?: string | undefined;
  modelId?: string | undefined;
  readiness: ModelStatus;
  selected: boolean;
}

export interface ProjectRepository {
  importProject?(): Promise<ProjectDocument | null>;
  importMirrorFiles?(files: MirrorFile[]): Promise<ProjectDocument>;
  loadProject(options?: { projectName?: string }): Promise<ProjectDocument | null>;
  saveProject(project: ProjectDocument, options?: { projectDirectoryName?: string }): Promise<void>;
  saveProjectAs?(
    project: ProjectDocument,
    options?: { projectDirectoryName?: string },
  ): Promise<void>;
  getVersionHistory?(): Promise<VersionHistoryEntry[]>;
  saveVersion?(
    project: ProjectDocument,
    metadata: VersionSnapshotMetadata,
  ): Promise<VersionHistoryEntry>;
  loadVersion?(versionId: string): Promise<ProjectDocument | null>;
}

export interface MirrorFile {
  path: string;
  blob: Blob;
}

export type MirrorStatus = 'disabled' | 'idle' | 'syncing' | 'synced' | 'failed';

export interface MirrorState {
  enabled: boolean;
  status: MirrorStatus;
  lastSyncedAt?: string;
  error?: string;
}

export interface MirrorSyncProgress {
  current: number;
  total: number;
  label: string;
}

export interface MirrorProjectSummary {
  id: string;
  name: string;
  syncedAt: string;
}

export interface MirrorService<TConfig = unknown> {
  loadConfig(): TConfig | null;
  saveConfig(config: TConfig): void;
  clearConfig(): void;
  syncProject(
    project: ProjectDocument,
    repository: ProjectRepository,
    config: TConfig,
    options?: { onProgress?: (progress: MirrorSyncProgress) => void },
  ): Promise<MirrorState>;
  listProjects(config: TConfig): Promise<MirrorProjectSummary[]>;
  downloadProject(projectId: string, config: TConfig): Promise<MirrorFile[]>;
  deleteProject?(projectId: string, config: TConfig): Promise<void>;
  getPublicObjectUrl?(key: string, config: TConfig): string;
  uploadPublicObject?(key: string, blob: Blob, config: TConfig): Promise<void>;
}

export interface VersionHistoryEntry {
  id: string;
  createdAt: string;
  authorName: string;
  projectName: string;
  summary: string;
  firstChangedPageId?: string;
  firstChangedElementId?: string;
  changeCount: number;
  fileName: string;
}

export interface VersionHistoryManifest {
  schemaVersion: 1;
  projectId: string;
  latestVersionId?: string;
  versions: VersionHistoryEntry[];
}

export interface VersionSnapshotMetadata {
  previousProject?: ProjectDocument | undefined;
  force?: boolean | undefined;
}

export interface ExportService {
  getPageImageFileName(project: ProjectDocument, pageId: string, extension: 'png' | 'jpeg'): string;
  getImagesArchiveFileName(project: ProjectDocument): string;
  getPdfFileName(project: ProjectDocument): string;
  getPowerPointFileName(project: ProjectDocument): string;
  downloadBlob(blob: Blob, fileName: string): void;
  downloadDataUrl(dataUrl: string, fileName: string): void;
}

export interface PresentationImportService {
  importPowerPoint(input: PptxImportInput): Promise<ProjectDocument>;
}

export interface PresentationExportWarning {
  category?: 'animation' | 'content-type' | 'fidelity' | 'media' | 'relationship' | 'transition';
  code: string;
  elementId?: string;
  message: string;
  pageId?: string;
}

export interface PresentationExportResult {
  blob: Blob;
  stats: PresentationExportStats;
  warnings: PresentationExportWarning[];
}

export interface PresentationExportStats {
  animationBuildCount: number;
  mediaElementCount: number;
  slideCount: number;
}

export type PresentationExportProgressStage =
  | 'building-slides'
  | 'downloading'
  | 'embedding-media'
  | 'patching-package'
  | 'preparing'
  | 'validating-package'
  | 'writing-package';

export interface PresentationExportProgress {
  current?: number | undefined;
  detail?: string | undefined;
  label: string;
  stage: PresentationExportProgressStage;
  total?: number | undefined;
}

export interface PresentationExportOptions {
  onProgress?: (progress: PresentationExportProgress) => void;
}

export interface PresentationExportService {
  exportPowerPoint(
    project: ProjectDocument,
    options?: PresentationExportOptions,
  ): Promise<PresentationExportResult>;
}

export interface FontImportRequest {
  family: string;
  fontStyle: 'normal' | 'italic';
  fontWeight: number;
}

export type FontResolutionStatus =
  | 'available-system'
  | 'downloaded-exact'
  | 'downloaded-compatible'
  | 'missing-needs-user'
  | 'failed';

export interface FontResolution {
  family?: string;
  fontStyle: 'normal' | 'italic';
  fontWeight: number;
  message?: string;
  requestedFamily: string;
  status: FontResolutionStatus;
}

export interface FontImportResult {
  fonts: Record<string, ProjectFont>;
  resolutions: FontResolution[];
  warnings: ImportWarning[];
}

export interface FontCatalogItem {
  aliases?: string[];
  family: string;
  source: 'google-fonts' | 'local-font-folder';
}

export interface FontImportService {
  listDownloadableFonts(): FontCatalogItem[];
  resolveAndDownloadFonts(requests: FontImportRequest[]): Promise<FontImportResult>;
  loadProjectFonts(project: ProjectDocument): Promise<void>;
}

export interface LocalFontMirrorSettings {
  enabled: boolean;
  folderLabel?: string | undefined;
  supported: boolean;
  systemHint: string;
}

export interface LocalFontMirrorProgress {
  label: string;
  stage:
    | 'adding-project-fonts'
    | 'checking-local-fonts'
    | 'requesting-font-folder'
    | 'scanning-font-folder'
    | 'uploading-test-fonts'
    | 'verifying-mirrored-fonts';
}

export interface LocalFontMirrorResult {
  project: ProjectDocument;
  addedFonts: ProjectFont[];
  unresolvedFamilies: string[];
  warnings: ImportWarning[];
}

export interface LocalFontMirrorTestResult {
  warning?: string | undefined;
}

export interface LocalFontMirrorService {
  getSettings(): LocalFontMirrorSettings;
  setEnabled(enabled: boolean): LocalFontMirrorSettings;
  chooseFontFolder(): Promise<LocalFontMirrorSettings>;
  listAvailableFonts(): Promise<FontCatalogItem[]>;
  importFontFamily(
    project: ProjectDocument,
    request: FontImportRequest,
    options?: { onProgress?: (progress: LocalFontMirrorProgress) => void },
  ): Promise<LocalFontMirrorResult>;
  importProjectFonts(
    project: ProjectDocument,
    options?: { onProgress?: (progress: LocalFontMirrorProgress) => void },
  ): Promise<LocalFontMirrorResult>;
  getTestFontFiles(
    options?: { onProgress?: (progress: LocalFontMirrorProgress) => void },
  ): Promise<File[]>;
  validateTestFontFiles(
    files: File[],
    options?: { onProgress?: (progress: LocalFontMirrorProgress) => void },
  ): Promise<LocalFontMirrorTestResult>;
}

export type ShareStatus = 'published' | 'copied' | 'syncing' | 'sync-failed';

export interface ShareMetadata {
  shareId: string;
  publicUrl: string;
  embedUrl: string;
  embedHtml: string;
  createdAt: string;
  updatedAt: string;
  status: ShareStatus;
}

export interface ShareRecord {
  shareId: string;
  createdAt: string;
  updatedAt: string;
  project: ProjectDocument;
}

export interface ShareService {
  createShare(project: ProjectDocument): Promise<ShareMetadata>;
  updateShare(shareId: string, project: ProjectDocument): Promise<ShareMetadata>;
  getShare(shareId: string): Promise<ShareRecord | null>;
  getProjectShareMetadata(project: ProjectDocument): ShareMetadata;
  getPublicUrl(shareId: string): string;
  getEmbedUrl(shareId: string): string;
  getEmbedHtml(shareId: string): string;
}

export type StockMediaProvider = 'giphy' | 'unsplash';
export type StockMediaKind = 'gif' | 'image';

export interface StockMediaConfig {
  giphyApiKey: string;
  unsplashAccessKey: string;
}

export interface StockMediaProviderStatus {
  configured: boolean;
  provider: StockMediaProvider;
}

export interface StockMediaProviderState {
  gifs: StockMediaProviderStatus;
  images: StockMediaProviderStatus;
}

export interface StockMediaItem {
  id: string;
  provider: StockMediaProvider;
  kind: StockMediaKind;
  title: string;
  authorName?: string | undefined;
  authorUrl?: string | undefined;
  thumbnailUrl: string;
  mediaUrl: string;
  videoUrl?: string | undefined;
  width: number;
  height: number;
  downloadLocation?: string | undefined;
}

export interface DownloadedStockMedia {
  blob: Blob;
  mimeType: string;
  objectUrl: string;
}

export interface StockMediaService {
  loadConfig(): StockMediaConfig | null;
  saveConfig(config: StockMediaConfig): void;
  clearConfig(): void;
  getProviderState(): StockMediaProviderState;
  searchImages(query: string): Promise<StockMediaItem[]>;
  searchGifs(query: string): Promise<StockMediaItem[]>;
  downloadMedia(item: StockMediaItem, sourceUrl?: string): Promise<DownloadedStockMedia>;
  trackImageDownload(item: StockMediaItem): Promise<void>;
}

export interface ModelSetupService {
  getModelStates(): Promise<ModelState[]>;
  downloadRequiredModels(): Promise<ModelState[]>;
  downloadModel(
    id: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<ModelState>;
  removeModel?(id: string): Promise<ModelState>;
}

export type PersistenceStorageMode = 'directory' | 'opfs' | 'none';

export interface TranslatorService {
  getProviderStates?(): Promise<AiProviderState[]>;
  getSelectedProviderId?(): string;
  setSelectedProvider?(providerId: string): Promise<AiProviderState[]>;
  getLanguageDetectionProviderStates?(): Promise<AiProviderState[]>;
  setLanguageDetectionProvider?(providerId: string): Promise<AiProviderState[]>;
  prepareLanguageDetection?(options?: {
    onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
  }): Promise<void>;
  detectLanguage(
    text: string,
    options?: {
      allowModelPreparation?: boolean;
      onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
    },
  ): Promise<string>;
  prepareTranslation(
    sourceLanguage: string,
    targetLanguage: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void>;
  translate(
    text: string,
    targetLanguage: string,
    options?: { sourceLanguage?: string },
  ): Promise<string>;
}

export type PromptApiAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'ready';

export interface PromptService {
  getProviderStates?(): Promise<AiProviderState[]>;
  getSelectedProviderId?(): string;
  setSelectedProvider?(providerId: string): Promise<AiProviderState[]>;
  checkAvailability(): Promise<PromptApiAvailability>;
  preparePromptApi(options?: {
    onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
  }): Promise<void>;
  generateSlideTasksFromPrompt(
    prompt: string,
    options?: { targetLanguageHint?: string },
  ): Promise<GeneratedSlideTasksDocument>;
  generateSlideElementFromTask(
    task: Exclude<GeneratedSlideTask, { type: 'set-background' }>,
    context: {
      userPrompt: string;
      allTasks: GeneratedSlideTask[];
      page: GeneratedSlideTasksDocument['page'];
      existingElements: GeneratedSlideElement[];
    },
  ): Promise<GeneratedSlideElement>;
}

export interface ImageGenerationOptions {
  height?: number;
  seed?: number;
  steps?: number;
  width?: number;
  onProgress?: (state: { label: string; progress: number }) => void;
}

export interface ImageGenerationService {
  generateImage(prompt: string, options?: ImageGenerationOptions): Promise<Asset>;
}

export interface PaletteService {
  generatePalette(prompt: string): Promise<{ name: string; colors: string[] }>;
}

export interface BackgroundRemovalService {
  prepareBackgroundRemoval(
    asset: Asset,
    options?: { onProgress?: (progress: number) => void },
  ): Promise<void>;
  previewBackgroundMask(
    asset: Asset,
    options?: {
      points?: Array<{ x: number; y: number; positive: boolean }>;
      subjectPoint?: { x: number; y: number };
    },
  ): Promise<{ maskUrl: string; score: number }>;
  removeBackground(
    asset: Asset,
    options?: {
      points?: Array<{ x: number; y: number; positive: boolean }>;
      subjectPoint?: { x: number; y: number };
    },
  ): Promise<{ asset: Asset; bounds?: { x: number; y: number; width: number; height: number } }>;
}

export interface SmartGrabService {
  suggestSubjectRegion(
    assetId: string,
    aspectRatio: number,
  ): Promise<{ x: number; y: number; width: number; height: number }>;
}

export interface MagicEraserService {
  createMask(
    assetId: string,
    points: Array<{ x: number; y: number; positive: boolean }>,
  ): Promise<{ maskAssetId: string }>;
}
