import { createSampleProject } from '../domain/sampleProject';
import {
  MockBackgroundRemovalService,
  MockMagicEraserService,
  MockPaletteService,
  MockSmartCropService,
  MockTranslatorService,
} from '../services/inMemoryAiServices';
import { DisabledProjectRepository } from '../services/disabledProjectRepository';
import { InMemoryModelSetupService } from '../services/modelSetupService';

export function createAppServices() {
  return {
    initialProject: createSampleProject(),
    projectRepository: new DisabledProjectRepository(),
    modelSetupService: new InMemoryModelSetupService(),
    translatorService: new MockTranslatorService(),
    paletteService: new MockPaletteService(),
    backgroundRemovalService: new MockBackgroundRemovalService(),
    smartCropService: new MockSmartCropService(),
    magicEraserService: new MockMagicEraserService(),
  };
}

export type AppServices = ReturnType<typeof createAppServices>;
