import { TRANSLATION_LANGUAGE_OPTIONS } from './translationLanguages';

export const DEFAULT_SLIDE_LANGUAGE_CODE = 'pt';

export function normalizeLanguageCode(languageCode: string | undefined) {
  const normalized = languageCode?.trim();
  if (!normalized) return DEFAULT_SLIDE_LANGUAGE_CODE;
  const lower = normalized.toLowerCase();
  const aliases: Record<string, string> = {
    ca: 'es',
    gl: 'es',
    he: 'iw',
    'pt-br': 'pt',
    'pt-pt': 'pt',
    nb: 'no',
    nn: 'no',
    'zh-hk': 'zh-Hant',
    'zh-mo': 'zh-Hant',
    'zh-tw': 'zh-Hant',
  };
  const aliased = aliases[lower] ?? lower;
  if (aliased === 'zh-hant') return 'zh-Hant';
  if (isSupportedTranslationLanguageCode(aliased)) return aliased;
  const baseLanguage = aliased.split('-')[0];
  if (baseLanguage && isSupportedTranslationLanguageCode(baseLanguage)) {
    return baseLanguage;
  }
  return DEFAULT_SLIDE_LANGUAGE_CODE;
}

export function getLanguageOption(languageCode: string | undefined) {
  const code = normalizeLanguageCode(languageCode);
  return (
    TRANSLATION_LANGUAGE_OPTIONS.find((option) => option.code === code) ??
    TRANSLATION_LANGUAGE_OPTIONS.find((option) => option.code === DEFAULT_SLIDE_LANGUAGE_CODE)!
  );
}

export function getLanguageDisplayCode(languageCode: string) {
  return languageCode === 'zh-Hant' ? 'ZH-HANT' : languageCode.toUpperCase();
}

export function isSupportedTranslationLanguageCode(languageCode: string | null | undefined) {
  return TRANSLATION_LANGUAGE_OPTIONS.some((option) => option.code === languageCode);
}
