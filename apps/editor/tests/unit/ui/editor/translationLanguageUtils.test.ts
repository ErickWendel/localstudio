import {
  getLanguageDisplayCode,
  getLanguageOption,
  isSupportedTranslationLanguageCode,
  normalizeLanguageCode,
} from '../../../../src/ui/editor/translationLanguageUtils';

describe('translationLanguageUtils', () => {
  it('normalizes browser language aliases into supported translation codes', () => {
    expect(normalizeLanguageCode('pt-BR')).toBe('pt');
    expect(normalizeLanguageCode('gl')).toBe('es');
    expect(normalizeLanguageCode('he')).toBe('iw');
    expect(normalizeLanguageCode('zh-TW')).toBe('zh-Hant');
  });

  it('falls back to Portuguese for missing or unsupported languages', () => {
    expect(normalizeLanguageCode(undefined)).toBe('pt');
    expect(normalizeLanguageCode('zz-UNKNOWN')).toBe('pt');
  });

  it('returns display metadata for the normalized language option', () => {
    expect(getLanguageOption('zh-tw')).toMatchObject({
      code: 'zh-Hant',
      label: 'Chinese (Traditional)',
    });
    expect(getLanguageDisplayCode('zh-Hant')).toBe('ZH-HANT');
    expect(getLanguageDisplayCode('pt')).toBe('PT');
  });

  it('checks whether a target language can be selected', () => {
    expect(isSupportedTranslationLanguageCode('pt')).toBe(true);
    expect(isSupportedTranslationLanguageCode('pt-BR')).toBe(false);
    expect(isSupportedTranslationLanguageCode(undefined)).toBe(false);
  });
});
