import type { LocalSetupService, LocalSetupState, SetupCapabilityState } from '../contracts/interfaces';
import { browserStorage } from './browserStorage';

const SETUP_COMPLETE_KEY = 'localstudio.ai.setup-complete';

type TranslationAvailability = 'unavailable' | 'available' | 'downloadable' | 'downloading' | (string & {});

type TranslatorApi = {
  availability?: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<TranslationAvailability>;
};

type SetupWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: unknown;
    Translator?: TranslatorApi;
  };

class BrowserLocalSetupService implements LocalSetupService {
  async checkReadiness(): Promise<LocalSetupState> {
    return {
      fileSystem: this.checkFileSystem(),
      chromeTranslation: await this.checkLocalAiProviders(),
    };
  }

  markSetupComplete(): void {
    browserStorage.getBrowserLocalStorage()?.setItem(SETUP_COMPLETE_KEY, 'true');
  }

  hasCompletedSetup(): boolean {
    return browserStorage.getBrowserLocalStorage()?.getItem(SETUP_COMPLETE_KEY) === 'true';
  }

  private checkFileSystem(): SetupCapabilityState {
    const browserWindow = window as SetupWindow;
    if (typeof browserWindow.showDirectoryPicker === 'function') {
      return {
        label: 'Project Files',
        status: 'ready',
        detail: 'Local project folders are supported.',
      };
    }

    return {
      label: 'Project Files',
      status: 'unavailable',
      detail: 'Chrome File System Access API is required.',
    };
  }

  private async checkLocalAiProviders(): Promise<SetupCapabilityState> {
    const browserWindow = window as SetupWindow;
    const translator = browserWindow.Translator;
    const hasWebGpu = typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
    if (!translator?.availability) {
      if (hasWebGpu) {
        return {
          label: 'Local AI Providers',
          status: 'ready',
          detail: 'WebGPU local AI models can be configured in AI Tools.',
        };
      }
      return {
        label: 'Local AI Providers',
        status: 'unavailable',
        detail: 'No compatible local AI provider was found in this browser.',
      };
    }

    try {
      const result = await translator.availability({ sourceLanguage: 'en', targetLanguage: 'pt' });
      if (result === 'available') {
        return { label: 'Local AI Providers', status: 'ready', detail: 'Chrome Built-in AI is ready.' };
      }
      if (result === 'downloadable' || result === 'downloading') {
        if (hasWebGpu) {
          return {
            label: 'Local AI Providers',
            status: 'ready',
            detail: 'Chrome AI needs setup, but WebGPU local models are available.',
          };
        }
        return {
          label: 'Local AI Providers',
          status: 'unavailable',
          detail: 'Chrome AI needs setup and no WebGPU fallback is available.',
        };
      }
    } catch {
      if (hasWebGpu) {
        return {
          label: 'Local AI Providers',
          status: 'ready',
          detail: 'Chrome AI readiness could not be checked, but WebGPU local models are available.',
        };
      }
      return {
        label: 'Local AI Providers',
        status: 'unavailable',
        detail: 'Local AI readiness could not be checked.',
      };
    }

    if (hasWebGpu) {
      return {
        label: 'Local AI Providers',
        status: 'ready',
        detail: 'WebGPU local AI models can be configured in AI Tools.',
      };
    }

    return {
      label: 'Local AI Providers',
      status: 'unavailable',
      detail: 'No compatible local AI provider was found in this browser.',
    };
  }
}

export const localSetupService = {
  SETUP_COMPLETE_KEY,
  BrowserLocalSetupService,
};
