import { vi } from 'vitest';
import { BrowserLocalSetupService, SETUP_COMPLETE_KEY } from '../../../src/services/localSetupService';

describe('BrowserLocalSetupService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('reports filesystem and chrome translation readiness', async () => {
    vi.stubGlobal('showDirectoryPicker', vi.fn());
    vi.stubGlobal('translation', {
      canTranslate: vi.fn().mockResolvedValue('readily'),
    });
    const service = new BrowserLocalSetupService();

    const state = await service.checkReadiness();

    expect(state.fileSystem.status).toBe('ready');
    expect(state.chromeTranslation.status).toBe('ready');
  });

  it('reports missing browser capabilities as unavailable', async () => {
    vi.stubGlobal('showDirectoryPicker', undefined);
    vi.stubGlobal('translation', undefined);
    const service = new BrowserLocalSetupService();

    const state = await service.checkReadiness();

    expect(state.fileSystem.status).toBe('unavailable');
    expect(state.chromeTranslation.status).toBe('unavailable');
  });

  it('reports chrome translation after-download as needing setup', async () => {
    vi.stubGlobal('showDirectoryPicker', vi.fn());
    vi.stubGlobal('translation', {
      canTranslate: vi.fn().mockResolvedValue('after-download'),
    });
    const service = new BrowserLocalSetupService();

    const state = await service.checkReadiness();

    expect(state.chromeTranslation.status).toBe('needs-setup');
  });

  it('stores setup completion in localStorage', () => {
    const service = new BrowserLocalSetupService();

    expect(service.hasCompletedSetup()).toBe(false);

    service.markSetupComplete();

    expect(window.localStorage.getItem(SETUP_COMPLETE_KEY)).toBe('true');
    expect(service.hasCompletedSetup()).toBe(true);
  });
});
