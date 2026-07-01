import { getBrowserLocalStorage } from '../../services/browserStorage';
import { isSupportedTranslationLanguageCode } from './translationLanguageUtils';

const PERSISTENCE_PREFERENCE_KEY = 'ew-canvas-ai.persistence-enabled';
const TRANSLATION_TARGET_LANGUAGE_KEY = 'localstudio.ai.translation-target-language';

export function readPersistencePreference() {
  return getBrowserLocalStorage()?.getItem(PERSISTENCE_PREFERENCE_KEY) === 'true';
}

export function writePersistencePreference(enabled: boolean) {
  getBrowserLocalStorage()?.setItem(PERSISTENCE_PREFERENCE_KEY, enabled ? 'true' : 'false');
}

export function readTranslationTargetLanguage() {
  const storedTarget = getBrowserLocalStorage()?.getItem(TRANSLATION_TARGET_LANGUAGE_KEY);
  return isSupportedTranslationLanguageCode(storedTarget) ? (storedTarget ?? '') : '';
}

export function writeTranslationTargetLanguage(languageCode: string) {
  if (languageCode) {
    getBrowserLocalStorage()?.setItem(TRANSLATION_TARGET_LANGUAGE_KEY, languageCode);
    return;
  }
  getBrowserLocalStorage()?.removeItem?.(TRANSLATION_TARGET_LANGUAGE_KEY);
}
