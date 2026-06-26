import { createSampleProject } from '../domain/sampleProject';
import type { ProjectDocument } from '../domain/model';
import type {
  BackgroundRemovalService,
  ExportService,
  ImageGenerationService,
  LocalSetupService,
  MagicEraserService,
  ModelSetupService,
  PaletteService,
  PromptService,
  ProjectRepository,
  SmartGrabService,
  TranslatorService,
} from '../services/interfaces';
import {
  MockMagicEraserService,
  MockPaletteService,
  MockSmartGrabService,
} from '../services/inMemoryAiServices';
import { BrowserTranslatorService } from '../services/browserTranslatorService';
import { BrowserPromptService } from '../services/browserPromptService';
import { BrowserExportService } from '../services/exportService';
import { BrowserBackgroundRemovalService } from '../services/browserBackgroundRemovalService';
import { BrowserImageGenerationService } from '../services/browserImageGenerationService';
import { BrowserFileSystemProjectRepository } from '../services/browserFileSystemProjectRepository';
import { DisabledProjectRepository } from '../services/disabledProjectRepository';
import { BrowserLocalSetupService } from '../services/localSetupService';
import { BrowserModelSetupService } from '../services/modelSetupService';
import { TransformersLanguageDetectionRuntime } from '../services/webGpuLanguageDetectionRuntime';
import { TransformersTextGenerationRuntime } from '../services/webGpuTextGenerationRuntime';

export interface AppServices {
  initialProject: ProjectDocument;
  skipStoredProjectLoad: boolean;
  storedProjectName?: string;
  projectRepository: ProjectRepository;
  exportService: ExportService;
  localSetupService: LocalSetupService;
  modelSetupService: ModelSetupService;
  translatorService: TranslatorService;
  promptService: PromptService;
  imageGenerationService: ImageGenerationService;
  paletteService: PaletteService;
  backgroundRemovalService: BackgroundRemovalService;
  smartGrabService: SmartGrabService;
  magicEraserService: MagicEraserService;
}

interface CreateAppServicesOptions {
  initialProject?: ProjectDocument;
  skipStoredProjectLoad?: boolean;
  storedProjectName?: string;
}

export function createAppServices(options: CreateAppServicesOptions = {}): AppServices {
  const textGenerationRuntime = new TransformersTextGenerationRuntime();
  const languageDetectionRuntime = new TransformersLanguageDetectionRuntime();
  const modelSetupService = new BrowserModelSetupService(
    undefined,
    undefined,
    undefined,
    textGenerationRuntime,
    undefined,
    languageDetectionRuntime,
  );
  return {
    initialProject: options.initialProject ?? createSampleProject(),
    skipStoredProjectLoad: options.skipStoredProjectLoad ?? false,
    ...(options.storedProjectName ? { storedProjectName: options.storedProjectName } : {}),
    projectRepository: createProjectRepository(),
    exportService: new BrowserExportService(),
    localSetupService: new BrowserLocalSetupService(),
    modelSetupService,
    translatorService: new BrowserTranslatorService(
      modelSetupService,
      undefined,
      undefined,
      textGenerationRuntime,
      languageDetectionRuntime,
    ),
    promptService: new BrowserPromptService(modelSetupService, undefined, undefined, textGenerationRuntime),
    imageGenerationService: new BrowserImageGenerationService(),
    paletteService: new MockPaletteService(),
    backgroundRemovalService: new BrowserBackgroundRemovalService(),
    smartGrabService: new MockSmartGrabService(),
    magicEraserService: new MockMagicEraserService(),
  };
}

function createProjectRepository(): ProjectRepository {
  if (
    typeof window !== 'undefined' &&
    typeof (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
  ) {
    return new BrowserFileSystemProjectRepository();
  }
  return new DisabledProjectRepository();
}
