import type { LocalSetupService, LocalSetupState, SetupCapabilityState } from './interfaces';

export const SETUP_COMPLETE_KEY = 'localstudio.ai.setup-complete';

type TranslationAvailability = 'unavailable' | 'available' | 'downloadable' | 'downloading' | (string & {});

type TranslatorApi = {
  availability?: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<TranslationAvailability>;
};

type SetupWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: unknown;
    Translator?: TranslatorApi;
  };

export class BrowserLocalSetupService implements LocalSetupService {
  async checkReadiness(): Promise<LocalSetupState> {
    return {
      fileSystem: this.checkFileSystem(),
      chromeTranslation: await this.checkChromeTranslation(),
    };
  }

  markSetupComplete(): void {
    window.localStorage.setItem(SETUP_COMPLETE_KEY, 'true');
  }

  hasCompletedSetup(): boolean {
    return window.localStorage.getItem(SETUP_COMPLETE_KEY) === 'true';
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

  private async checkChromeTranslation(): Promise<SetupCapabilityState> {
    const browserWindow = window as SetupWindow;
    const translator = browserWindow.Translator;
    if (!translator?.availability) {
      return {
        label: 'Chrome Translation',
        status: 'unavailable',
        detail: 'Chrome Built-in AI translation is not available.',
      };
    }

    try {
      const result = await translator.availability({ sourceLanguage: 'en', targetLanguage: 'pt' });
      if (result === 'available') {
        return { label: 'Chrome Translation', status: 'ready', detail: 'Translation is ready.' };
      }
      if (result === 'downloadable' || result === 'downloading') {
        return {
          label: 'Chrome Translation',
          status: 'unavailable',
          detail: 'Chrome translation is not ready in this browser session.',
        };
      }
    } catch {
      return {
        label: 'Chrome Translation',
        status: 'unavailable',
        detail: 'Translation readiness could not be checked.',
      };
    }

    return {
      label: 'Chrome Translation',
      status: 'unavailable',
      detail: 'Translation is unavailable in this browser.',
    };
  }
}
