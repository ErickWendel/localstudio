import type { Asset, ProjectDocument } from '../domain/model';

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

export interface TranslatorService {
  detectLanguage(text: string): Promise<string>;
  translate(text: string, targetLanguage: string): Promise<string>;
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
