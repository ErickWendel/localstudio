import { createSampleProject } from '../domain/sampleProject';
import {
  MockBackgroundRemovalService,
  MockMagicEraserService,
  MockPaletteService,
  MockSmartCropService,
  MockTranslatorService,
} from '../services/inMemoryAiServices';
import { InMemoryModelSetupService } from '../services/modelSetupService';

export function createAppServices() {
  return {
    initialProject: createSampleProject(),
    modelSetupService: new InMemoryModelSetupService(),
    translatorService: new MockTranslatorService(),
    paletteService: new MockPaletteService(),
    backgroundRemovalService: new MockBackgroundRemovalService(),
    smartCropService: new MockSmartCropService(),
    magicEraserService: new MockMagicEraserService(),
  };
}

export type AppServices = ReturnType<typeof createAppServices>;
