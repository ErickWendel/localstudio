import { vi } from 'vitest';
import { localSetupService } from '../../../src/services/browser/localSetupService';

describe('localSetupService.BrowserLocalSetupService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: undefined,
    });
    window.localStorage.clear();
  });

  it('reports filesystem and Chrome local AI readiness', async () => {
    vi.stubGlobal('showDirectoryPicker', vi.fn());
    vi.stubGlobal('Translator', {
      availability: vi.fn().mockResolvedValue('available'),
    });
    const service = new localSetupService.BrowserLocalSetupService();

    const state = await service.checkReadiness();

    expect(state.fileSystem.status).toBe('ready');
    expect(state.chromeTranslation.status).toBe('ready');
    expect(state.chromeTranslation.label).toBe('Local AI Providers');
    expect(state.chromeTranslation.detail).toBe('Chrome Built-in AI is ready.');
  });

  it('reports missing browser capabilities as unavailable', async () => {
    vi.stubGlobal('showDirectoryPicker', undefined);
    vi.stubGlobal('Translator', undefined);
    const service = new localSetupService.BrowserLocalSetupService();

    const state = await service.checkReadiness();

    expect(state.fileSystem.status).toBe('unavailable');
    expect(state.chromeTranslation.status).toBe('unavailable');
    expect(state.chromeTranslation.detail).toBe('No compatible local AI provider was found in this browser.');
  });

  it('uses WebGPU provider compatibility when Chrome AI needs setup', async () => {
    vi.stubGlobal('showDirectoryPicker', vi.fn());
    vi.stubGlobal('Translator', {
      availability: vi.fn().mockResolvedValue('downloadable'),
    });
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: {},
    });
    const service = new localSetupService.BrowserLocalSetupService();

    const state = await service.checkReadiness();

    expect(state.chromeTranslation.status).toBe('ready');
    expect(state.chromeTranslation.detail).toBe('Chrome AI needs setup, but WebGPU local models are available.');
  });

  it('reports downloading Chrome AI as unavailable when no WebGPU fallback exists', async () => {
    vi.stubGlobal('showDirectoryPicker', vi.fn());
    vi.stubGlobal('Translator', {
      availability: vi.fn().mockResolvedValue('downloading'),
    });
    const service = new localSetupService.BrowserLocalSetupService();

    const state = await service.checkReadiness();

    expect(state.chromeTranslation.status).toBe('unavailable');
    expect(state.chromeTranslation.detail).toBe('Chrome AI needs setup and no WebGPU fallback is available.');
  });

  it('stores setup completion in localStorage', () => {
    const service = new localSetupService.BrowserLocalSetupService();

    expect(service.hasCompletedSetup()).toBe(false);

    service.markSetupComplete();

    expect(window.localStorage.getItem(localSetupService.SETUP_COMPLETE_KEY)).toBe('true');
    expect(service.hasCompletedSetup()).toBe(true);
  });
});
