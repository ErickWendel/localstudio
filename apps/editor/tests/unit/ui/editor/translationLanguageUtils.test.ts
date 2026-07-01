import { translationLanguageUtils } from '../../../../src/ui/editor/translation/translationLanguageUtils';

describe('translationLanguageUtils', () => {
  it('normalizes browser language aliases into supported translation codes', () => {
    expect(translationLanguageUtils.normalizeLanguageCode('pt-BR')).toBe('pt');
    expect(translationLanguageUtils.normalizeLanguageCode('gl')).toBe('es');
    expect(translationLanguageUtils.normalizeLanguageCode('he')).toBe('iw');
    expect(translationLanguageUtils.normalizeLanguageCode('zh-TW')).toBe('zh-Hant');
  });

  it('falls back to Portuguese for missing or unsupported languages', () => {
    expect(translationLanguageUtils.normalizeLanguageCode(undefined)).toBe('pt');
    expect(translationLanguageUtils.normalizeLanguageCode('zz-UNKNOWN')).toBe('pt');
  });

  it('returns display metadata for the normalized language option', () => {
    expect(translationLanguageUtils.getLanguageOption('zh-tw')).toMatchObject({
      code: 'zh-Hant',
      label: 'Chinese (Traditional)',
    });
    expect(translationLanguageUtils.getLanguageDisplayCode('zh-Hant')).toBe('ZH-HANT');
    expect(translationLanguageUtils.getLanguageDisplayCode('pt')).toBe('PT');
  });

  it('checks whether a target language can be selected', () => {
    expect(translationLanguageUtils.isSupportedTranslationLanguageCode('pt')).toBe(true);
    expect(translationLanguageUtils.isSupportedTranslationLanguageCode('pt-BR')).toBe(false);
    expect(translationLanguageUtils.isSupportedTranslationLanguageCode(undefined)).toBe(false);
  });
});
