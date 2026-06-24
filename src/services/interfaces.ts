import type { ProjectDocument } from '../domain/model';

export type ModelStatus = 'unavailable' | 'needs-download' | 'downloading' | 'ready' | 'failed';

export interface ModelState {
  id: string;
  label: string;
  provider: 'chrome' | 'transformers';
  status: ModelStatus;
  progress: number;
  required: boolean;
}

export interface ProjectRepository {
  loadProject(): Promise<ProjectDocument | null>;
  saveProject(project: ProjectDocument): Promise<void>;
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
  removeBackground(assetId: string): Promise<{ assetId: string }>;
}

export interface SmartCropService {
  suggestCrop(
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
