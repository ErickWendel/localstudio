import { sampleProject } from '../domain/projects/sampleProject';
import type { ProjectDocument } from '../domain/model';
import type {
  BackgroundRemovalService,
  ExportService,
  ImageGenerationService,
  LocalSetupService,
  MagicEraserService,
  MirrorService,
  ModelSetupService,
  PaletteService,
  PromptService,
  ProjectRepository,
  SmartGrabService,
  ShareService,
  TranslatorService,
} from '../services/interfaces';
import { inMemoryAiServices } from '../services/testing/inMemoryAiServices';
import { browserTranslatorService } from '../services/translation/browserTranslatorService';
import { browserPromptService } from '../services/prompting/browserPromptService';
import { BrowserExportService } from '../services/exportService';
import { BrowserBackgroundRemovalService } from '../services/browserBackgroundRemovalService';
import { BrowserImageGenerationService } from '../services/browserImageGenerationService';
import { BrowserFileSystemProjectRepository } from '../services/browserFileSystemProjectRepository';
import { DisabledProjectRepository } from '../services/disabledProjectRepository';
import { localSetupService } from '../services/browser/localSetupService';
import { modelSetupService } from '../services/model-setup/modelSetupService';
import { BrowserShareService } from '../services/shareService';
import { webGpuLanguageDetectionRuntime } from '../services/translation/webGpuLanguageDetectionRuntime';
import { webGpuTextGenerationRuntime } from '../services/prompting/webGpuTextGenerationRuntime';
import { minioMirrorService } from '../services/mirror/minioMirrorService';
import type { MinioMirrorConfig } from '../services/mirror/minioMirrorService';

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
  mirrorService: MirrorService<MinioMirrorConfig>;
}

interface CreateAppServicesOptions {
  initialProject?: ProjectDocument;
  skipStoredProjectLoad?: boolean;
  storedProjectName?: string;
}

export function createAppServices(options: CreateAppServicesOptions = {}): AppServices {
  const textGenerationRuntime = new webGpuTextGenerationRuntime.TransformersTextGenerationRuntime();
  const languageDetectionRuntime = new webGpuLanguageDetectionRuntime.TransformersLanguageDetectionRuntime();
  const persistenceAvailable = isFileSystemAccessAvailable();
  const mirrorService = new minioMirrorService.MinioMirrorService();
  const browserModelSetupService = new modelSetupService.BrowserModelSetupService(
    undefined,
    undefined,
    undefined,
    textGenerationRuntime,
    undefined,
    languageDetectionRuntime,
  );
  return {
    initialProject: options.initialProject ?? sampleProject.createBlankProject(),
    skipStoredProjectLoad: options.skipStoredProjectLoad ?? false,
    ...(options.storedProjectName ? { storedProjectName: options.storedProjectName } : {}),
    persistenceAvailable,
    projectRepository: createProjectRepository(persistenceAvailable),
    exportService: new BrowserExportService(),
    shareService: new BrowserShareService({ mirrorService }),
    localSetupService: new localSetupService.BrowserLocalSetupService(),
    modelSetupService: browserModelSetupService,
    translatorService: new browserTranslatorService.BrowserTranslatorService(
      browserModelSetupService,
      undefined,
      undefined,
      textGenerationRuntime,
      languageDetectionRuntime,
    ),
    promptService: new browserPromptService.BrowserPromptService(
      browserModelSetupService,
      undefined,
      undefined,
      textGenerationRuntime,
    ),
    imageGenerationService: new BrowserImageGenerationService(),
    paletteService: new inMemoryAiServices.MockPaletteService(),
    backgroundRemovalService: new BrowserBackgroundRemovalService(),
    smartGrabService: new inMemoryAiServices.MockSmartGrabService(),
    magicEraserService: new inMemoryAiServices.MockMagicEraserService(),
    mirrorService,
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
