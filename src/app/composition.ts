import { createSampleProject } from '../domain/sampleProject';
import type { ProjectDocument } from '../domain/model';
import type {
  BackgroundRemovalService,
  ExportService,
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
import { IndexedDbProjectRepository } from '../services/indexedDbProjectRepository';
import { BrowserModelSetupService } from '../services/modelSetupService';

export interface AppServices {
  initialProject: ProjectDocument;
  projectRepository: ProjectRepository;
  exportService: ExportService;
  modelSetupService: ModelSetupService;
  translatorService: TranslatorService;
  paletteService: PaletteService;
  backgroundRemovalService: BackgroundRemovalService;
  smartGrabService: SmartGrabService;
  magicEraserService: MagicEraserService;
}

export function createAppServices(): AppServices {
  return {
    initialProject: createSampleProject(),
    projectRepository: new IndexedDbProjectRepository(),
    exportService: new BrowserExportService(),
    modelSetupService: new BrowserModelSetupService(),
    translatorService: new MockTranslatorService(),
    paletteService: new MockPaletteService(),
    backgroundRemovalService: new BrowserBackgroundRemovalService(),
    smartGrabService: new MockSmartGrabService(),
    magicEraserService: new MockMagicEraserService(),
  };
}
