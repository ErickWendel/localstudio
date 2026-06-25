import { createSampleProject } from '../domain/sampleProject';
import type { ProjectDocument } from '../domain/model';
import type {
  BackgroundRemovalService,
  ExportService,
  LocalSetupService,
  MagicEraserService,
  ModelSetupService,
  PaletteService,
  ProjectRepository,
  SmartGrabService,
  TranslatorService,
} from '../services/interfaces';
import {
  MockMagicEraserService,
  MockPaletteService,
  MockSmartGrabService,
  MockTranslatorService,
} from '../services/inMemoryAiServices';
import { BrowserExportService } from '../services/exportService';
import { BrowserBackgroundRemovalService } from '../services/browserBackgroundRemovalService';
import { BrowserFileSystemProjectRepository } from '../services/browserFileSystemProjectRepository';
import { DisabledProjectRepository } from '../services/disabledProjectRepository';
import { BrowserLocalSetupService } from '../services/localSetupService';
import { BrowserModelSetupService } from '../services/modelSetupService';

export interface AppServices {
  initialProject: ProjectDocument;
  skipStoredProjectLoad: boolean;
  storedProjectName?: string;
  projectRepository: ProjectRepository;
  exportService: ExportService;
  localSetupService: LocalSetupService;
  modelSetupService: ModelSetupService;
  translatorService: TranslatorService;
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
  return {
    initialProject: options.initialProject ?? createSampleProject(),
    skipStoredProjectLoad: options.skipStoredProjectLoad ?? false,
    ...(options.storedProjectName ? { storedProjectName: options.storedProjectName } : {}),
    projectRepository: createProjectRepository(),
    exportService: new BrowserExportService(),
    localSetupService: new BrowserLocalSetupService(),
    modelSetupService: new BrowserModelSetupService(),
    translatorService: new MockTranslatorService(),
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
