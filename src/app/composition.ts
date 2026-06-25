import { createSampleProject } from '../domain/sampleProject';
import {
  MockBackgroundRemovalService,
  MockMagicEraserService,
  MockPaletteService,
  MockSmartGrabService,
  MockTranslatorService,
} from '../services/inMemoryAiServices';
import { BrowserExportService } from '../services/exportService';
import { IndexedDbProjectRepository } from '../services/indexedDbProjectRepository';
import { InMemoryModelSetupService } from '../services/modelSetupService';

export function createAppServices() {
  return {
    initialProject: createSampleProject(),
    projectRepository: new IndexedDbProjectRepository(),
    exportService: new BrowserExportService(),
    modelSetupService: new InMemoryModelSetupService(),
    translatorService: new MockTranslatorService(),
    paletteService: new MockPaletteService(),
    backgroundRemovalService: new MockBackgroundRemovalService(),
    smartGrabService: new MockSmartGrabService(),
    magicEraserService: new MockMagicEraserService(),
  };
}

export type AppServices = ReturnType<typeof createAppServices>;
