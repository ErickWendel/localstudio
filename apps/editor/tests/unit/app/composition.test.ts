import { createAppServices } from '../../../src/app/composition';
import { BrowserFileSystemProjectRepository } from '../../../src/services/browserFileSystemProjectRepository';
import { BrowserImageGenerationService } from '../../../src/services/browserImageGenerationService';
import { DisabledProjectRepository } from '../../../src/services/disabledProjectRepository';

describe('createAppServices', () => {
  const testWindow = window as Window & { showDirectoryPicker?: unknown };
  const originalShowDirectoryPicker = testWindow.showDirectoryPicker;

  afterEach(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: originalShowDirectoryPicker,
    });
  });

  it('uses disk-backed project storage when the File System Access API is available', () => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: () => Promise.resolve({}),
    });

    expect(createAppServices().projectRepository).toBeInstanceOf(BrowserFileSystemProjectRepository);
  });

  it('uses disabled persistence when the File System Access API is unavailable', () => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: undefined,
    });

    expect(createAppServices().projectRepository).toBeInstanceOf(DisabledProjectRepository);
  });

  it('wires the browser image generation service', () => {
    expect(createAppServices().imageGenerationService).toBeInstanceOf(BrowserImageGenerationService);
  });
});
