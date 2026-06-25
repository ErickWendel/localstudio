import type { Asset, ProjectDocument } from '../domain/model';
import type {
  GeneratedSlideElement,
  GeneratedSlideTask,
  GeneratedSlideTasksDocument,
} from '../domain/generatedSlide';

export type ModelStatus = 'unavailable' | 'needs-download' | 'downloading' | 'ready' | 'failed';

export interface ModelState {
  id: string;
  label: string;
  description?: string;
  provider: 'chrome' | 'transformers';
  status: ModelStatus;
  progress: number;
  required: boolean;
}

export interface ProjectRepository {
  importProject?(): Promise<ProjectDocument | null>;
  loadProject(options?: { projectName?: string }): Promise<ProjectDocument | null>;
  saveProject(project: ProjectDocument): Promise<void>;
}

export interface ExportService {
  getPageImageFileName(project: ProjectDocument, pageId: string, extension: 'png' | 'jpeg'): string;
  getPdfFileName(project: ProjectDocument): string;
  downloadDataUrl(dataUrl: string, fileName: string): void;
}

export interface ModelSetupService {
  getModelStates(): Promise<ModelState[]>;
  downloadRequiredModels(): Promise<ModelState[]>;
  downloadModel(id: string): Promise<ModelState>;
}

export type SetupCapabilityStatus = 'unavailable' | 'needs-setup' | 'ready';

export interface SetupCapabilityState {
  label: string;
  status: SetupCapabilityStatus;
  detail: string;
}

export interface LocalSetupState {
  fileSystem: SetupCapabilityState;
  chromeTranslation: SetupCapabilityState;
}

export interface LocalSetupService {
  checkReadiness(): Promise<LocalSetupState>;
  markSetupComplete(): void;
  hasCompletedSetup(): boolean;
}

export interface TranslatorService {
  detectLanguage(text: string): Promise<string>;
  prepareTranslation(
    sourceLanguage: string,
    targetLanguage: string,
    options?: { onProgress?: (progress: number) => void },
  ): Promise<void>;
  translate(text: string, targetLanguage: string, options?: { sourceLanguage?: string }): Promise<string>;
}

export type PromptApiAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'ready';

export interface PromptService {
  checkAvailability(): Promise<PromptApiAvailability>;
  preparePromptApi(options?: { onProgress?: (progress: number) => void }): Promise<void>;
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
    options?: { points?: Array<{ x: number; y: number; positive: boolean }>; subjectPoint?: { x: number; y: number } },
  ): Promise<{ maskUrl: string; score: number }>;
  removeBackground(
    asset: Asset,
    options?: { points?: Array<{ x: number; y: number; positive: boolean }>; subjectPoint?: { x: number; y: number } },
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
