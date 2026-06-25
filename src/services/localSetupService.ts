import type { LocalSetupService, LocalSetupState, SetupCapabilityState } from './interfaces';

export const SETUP_COMPLETE_KEY = 'localstudio.ai.setup-complete';

type TranslationReadiness = 'no' | 'readily' | 'after-download';

type TranslationApi = {
  canTranslate?: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<TranslationReadiness>;
};

type SetupWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: unknown;
    translation?: TranslationApi;
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
    const canTranslate = browserWindow.translation?.canTranslate;
    if (!canTranslate) {
      return {
        label: 'Chrome Translation',
        status: 'unavailable',
        detail: 'Chrome Built-in AI translation is not available.',
      };
    }

    try {
      const result = await canTranslate({ sourceLanguage: 'en', targetLanguage: 'pt' });
      if (result === 'readily') {
        return { label: 'Chrome Translation', status: 'ready', detail: 'Translation is ready.' };
      }
      if (result === 'after-download') {
        return {
          label: 'Chrome Translation',
          status: 'needs-setup',
          detail: 'Chrome must download translation support.',
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
