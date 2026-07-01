import { browserStorage } from '../../../services/browser/browserStorage';
import { translationLanguageUtils } from '../translation/translationLanguageUtils';

const PERSISTENCE_PREFERENCE_KEY = 'ew-canvas-ai.persistence-enabled';
const TRANSLATION_TARGET_LANGUAGE_KEY = 'localstudio.ai.translation-target-language';

function readPersistencePreference() {
  return browserStorage.getBrowserLocalStorage()?.getItem(PERSISTENCE_PREFERENCE_KEY) === 'true';
}

function writePersistencePreference(enabled: boolean) {
  browserStorage.getBrowserLocalStorage()?.setItem(PERSISTENCE_PREFERENCE_KEY, enabled ? 'true' : 'false');
}

function readTranslationTargetLanguage() {
  const storedTarget = browserStorage.getBrowserLocalStorage()?.getItem(TRANSLATION_TARGET_LANGUAGE_KEY);
  return translationLanguageUtils.isSupportedTranslationLanguageCode(storedTarget) ? (storedTarget ?? '') : '';
}

function writeTranslationTargetLanguage(languageCode: string) {
  if (languageCode) {
    browserStorage.getBrowserLocalStorage()?.setItem(TRANSLATION_TARGET_LANGUAGE_KEY, languageCode);
    return;
  }
  browserStorage.getBrowserLocalStorage()?.removeItem?.(TRANSLATION_TARGET_LANGUAGE_KEY);
}

export const editorPreferences = {
  readPersistencePreference,
  writePersistencePreference,
  readTranslationTargetLanguage,
  writeTranslationTargetLanguage,
};
