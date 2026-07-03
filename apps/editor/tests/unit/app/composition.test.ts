import { createAppServices } from '../../../src/app/composition';
import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { BrowserFileSystemProjectRepository } from '../../../src/services/storage/browserFileSystemProjectRepository';
import { BrowserImageGenerationService } from '../../../src/services/image-generation/browserImageGenerationService';
import { DisabledProjectRepository } from '../../../src/services/storage/disabledProjectRepository';
import { OpfsProjectRepository } from '../../../src/services/storage/opfsProjectRepository';
import { BrowserStockMediaService } from '../../../src/services/stock-media/stockMediaService';

describe('createAppServices', () => {
  const testWindow = window as Window & { showDirectoryPicker?: unknown };
  const originalShowDirectoryPicker = testWindow.showDirectoryPicker;
  const originalStorage = navigator.storage;

  afterEach(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: originalShowDirectoryPicker,
    });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: originalStorage,
    });
  });

  it('uses disk-backed project storage when the File System Access API is available', () => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: () => Promise.resolve({}),
    });

    const services = createAppServices();
    expect(services.persistenceAvailable).toBe(true);
    expect(services.persistenceMode).toBe('directory');
    expect(services.projectRepository).toBeInstanceOf(BrowserFileSystemProjectRepository);
  });

  it('uses OPFS-backed project storage when only browser-private storage is available', () => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { getDirectory: () => Promise.resolve({}) },
    });

    const services = createAppServices();
    expect(services.persistenceAvailable).toBe(true);
    expect(services.persistenceMode).toBe('opfs');
    expect(services.projectRepository).toBeInstanceOf(OpfsProjectRepository);
  });

  it('uses disabled persistence when no filesystem storage API is available', () => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: undefined,
    });

    const services = createAppServices();
    expect(services.persistenceAvailable).toBe(false);
    expect(services.persistenceMode).toBe('none');
    expect(services.projectRepository).toBeInstanceOf(DisabledProjectRepository);
  });

  it('wires the browser image generation service', () => {
    expect(createAppServices().imageGenerationService).toBeInstanceOf(BrowserImageGenerationService);
  });

  it('wires the browser stock media service', () => {
    expect(createAppServices().stockMediaService).toBeInstanceOf(BrowserStockMediaService);
  });

  it('starts new app services with a blank project by default', () => {
    const project = createAppServices().initialProject;
    const blankProject = sampleProject.createBlankProject();

    expect(project.name).toBe(blankProject.name);
    expect(project.assets).toEqual({});
    expect(project.elements).toEqual({});
    expect(project.pages).toHaveLength(1);
    expect(project.pages[0]).toMatchObject({
      background: { type: 'color', color: '#050D10' },
      elementIds: [],
      name: 'Slide 1',
    });
  });
});
