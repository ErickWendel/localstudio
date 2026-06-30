import { createBlankProject } from '../domain/sampleProject';
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
  ShareService,
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
import { BrowserShareService } from '../services/shareService';
import { TransformersLanguageDetectionRuntime } from '../services/webGpuLanguageDetectionRuntime';
import { TransformersTextGenerationRuntime } from '../services/webGpuTextGenerationRuntime';

export interface AppServices {
  initialProject: ProjectDocument;
  skipStoredProjectLoad: boolean;
  storedProjectName?: string;
  persistenceAvailable: boolean;
  projectRepository: ProjectRepository;
  exportService: ExportService;
  shareService: ShareService;
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
  const persistenceAvailable = isFileSystemAccessAvailable();
  const modelSetupService = new BrowserModelSetupService(
    undefined,
    undefined,
    undefined,
    textGenerationRuntime,
    undefined,
    languageDetectionRuntime,
  );
  return {
    initialProject: options.initialProject ?? createBlankProject(),
    skipStoredProjectLoad: options.skipStoredProjectLoad ?? false,
    ...(options.storedProjectName ? { storedProjectName: options.storedProjectName } : {}),
    persistenceAvailable,
    projectRepository: createProjectRepository(persistenceAvailable),
    exportService: new BrowserExportService(),
    shareService: new BrowserShareService(),
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

function isFileSystemAccessAvailable() {
  return (
    typeof window !== 'undefined' &&
    typeof (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
  );
}

function createProjectRepository(persistenceAvailable: boolean): ProjectRepository {
  if (persistenceAvailable) {
    return new BrowserFileSystemProjectRepository();
  }
  return new DisabledProjectRepository();
}
