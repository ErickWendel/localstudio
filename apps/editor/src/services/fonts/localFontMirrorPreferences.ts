import type { BrowserKeyValueStorage } from '../browser/browserStorage';
import { browserStorage } from '../browser/browserStorage';

export interface LocalFontMirrorPreference {
  enabled: boolean;
  folderLabel?: string | undefined;
}

interface LocalFontMirrorPreferencesOptions {
  storage?: BrowserKeyValueStorage;
}

const LOCAL_FONT_MIRROR_ENABLED_KEY = 'localstudio.ai.local-font-mirror.enabled';
const LOCAL_FONT_MIRROR_FOLDER_LABEL_KEY = 'localstudio.ai.local-font-mirror.folder-label';

function getStorage(options: LocalFontMirrorPreferencesOptions) {
  return options.storage ?? browserStorage.getBrowserLocalStorage();
}

export const localFontMirrorPreferences = {
  read(options: LocalFontMirrorPreferencesOptions = {}): LocalFontMirrorPreference {
    const storage = getStorage(options);
    return {
      enabled: storage?.getItem(LOCAL_FONT_MIRROR_ENABLED_KEY) === 'true',
      folderLabel: storage?.getItem(LOCAL_FONT_MIRROR_FOLDER_LABEL_KEY) ?? undefined,
    };
  },

  write(preference: LocalFontMirrorPreference, options: LocalFontMirrorPreferencesOptions = {}) {
    const storage = getStorage(options);
    storage?.setItem(LOCAL_FONT_MIRROR_ENABLED_KEY, preference.enabled ? 'true' : 'false');
    if (preference.folderLabel) {
      storage?.setItem(LOCAL_FONT_MIRROR_FOLDER_LABEL_KEY, preference.folderLabel);
      return;
    }
    storage?.removeItem?.(LOCAL_FONT_MIRROR_FOLDER_LABEL_KEY);
  },
};
