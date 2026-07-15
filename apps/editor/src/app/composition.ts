import { sampleProject } from '../domain/projects/sampleProject';
import type { ProjectDocument } from '../domain/documents/model';
import type {
  BackgroundRemovalService,
  ExportService,
  FontImportService,
  ImageGenerationService,
  LocalFontMirrorService,
  MagicEraserService,
  MirrorService,
  ModelSetupService,
  PaletteService,
  PresentationImportService,
  PresentationExportService,
  PersistenceStorageMode,
  PromptService,
  ProjectRepository,
  SmartGrabService,
  ShareService,
  StockMediaService,
  TranslatorService,
} from '../services/contracts/interfaces';
import { inMemoryAiServices } from '../services/testing/inMemoryAiServices';
import { browserTranslatorService } from '../services/translation/browserTranslatorService';
import { browserPromptService } from '../services/prompting/browserPromptService';
import { BrowserExportService } from '../services/exporting/exportService';
import { BrowserBackgroundRemovalService } from '../services/background-removal/browserBackgroundRemovalService';
import { BrowserImageGenerationService } from '../services/image-generation/browserImageGenerationService';
import { BrowserFileSystemProjectRepository } from '../services/storage/browserFileSystemProjectRepository';
import { DisabledProjectRepository } from '../services/storage/disabledProjectRepository';
import { OpfsProjectRepository } from '../services/storage/opfsProjectRepository';
import { modelSetupService } from '../services/model-setup/modelSetupService';
import { BrowserShareService } from '../services/sharing/shareService';
import { LazyPptxImportService } from '../services/importing/pptx/lazyPptxImportService';
import { LazyPptxExportService } from '../services/exporting/lazyPptxExportService';
import { BrowserStockMediaService } from '../services/stock-media/stockMediaService';
import { BrowserGoogleFontsImportService } from '../services/fonts/googleFontsImportService';
import { BrowserLocalFontMirrorService } from '../services/fonts/localFontMirrorService';
import { webGpuLanguageDetectionRuntime } from '../services/translation/webGpuLanguageDetectionRuntime';
import { webGpuTextGenerationRuntime } from '../services/prompting/webGpuTextGenerationRuntime';
import { minioMirrorService } from '../services/mirror/minioMirrorService';
import type { MinioMirrorConfig } from '../services/mirror/minioMirrorService';

export interface AppServices {
  initialProject: ProjectDocument;
  skipStoredProjectLoad: boolean;
  storedProjectName?: string;
  persistenceAvailable: boolean;
  persistenceMode: PersistenceStorageMode;
  projectRepository: ProjectRepository;
  exportService: ExportService;
  fontImportService: FontImportService;
  localFontMirrorService: LocalFontMirrorService;
  presentationImportService: PresentationImportService;
  presentationExportService: PresentationExportService;
  shareService: ShareService;
  stockMediaService: StockMediaService;
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
  const persistenceMode = getPersistenceStorageMode();
  const persistenceAvailable = persistenceMode !== 'none';
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
    persistenceMode,
    projectRepository: createProjectRepository(persistenceMode),
    exportService: new BrowserExportService(),
    fontImportService: new BrowserGoogleFontsImportService(),
    localFontMirrorService: new BrowserLocalFontMirrorService(),
    presentationImportService: new LazyPptxImportService(),
    presentationExportService: new LazyPptxExportService(),
    shareService: new BrowserShareService({ mirrorService }),
    stockMediaService: new BrowserStockMediaService(),
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

function getPersistenceStorageMode(): PersistenceStorageMode {
  if (
    typeof window !== 'undefined' &&
    typeof (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
  ) {
    return 'directory';
  }
  if (
    typeof navigator !== 'undefined' &&
    typeof (
      navigator as Navigator & {
        storage?: StorageManager & { getDirectory?: unknown };
      }
    ).storage?.getDirectory === 'function'
  ) {
    return 'opfs';
  }
  return 'none';
}

function createProjectRepository(persistenceMode: PersistenceStorageMode): ProjectRepository {
  if (persistenceMode === 'directory') {
    return new BrowserFileSystemProjectRepository();
  }
  if (persistenceMode === 'opfs') {
    return new OpfsProjectRepository();
  }
  return new DisabledProjectRepository();
}
