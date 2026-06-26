import { describe, expect, it } from 'vitest';
import {
  createTranslateGemmaMessages,
  toTranslateGemmaLanguageCode,
} from '../../../src/services/browserTranslatorService';

describe('TranslateGemma helpers', () => {
  it('maps browser language codes to TranslateGemma codes', () => {
    expect(toTranslateGemmaLanguageCode('pt')).toBe('pt_BR');
    expect(toTranslateGemmaLanguageCode('pt-BR')).toBe('pt_BR');
    expect(toTranslateGemmaLanguageCode('iw')).toBe('he');
    expect(toTranslateGemmaLanguageCode('zh-Hant')).toBe('zh');
  });

  it('creates the structured message shape expected by TranslateGemma', () => {
    expect(
      createTranslateGemmaMessages({
        sourceLanguage: 'en',
        targetLanguage: 'pt',
        text: 'Browser-native AI',
      }),
    ).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            source_lang_code: 'en',
            target_lang_code: 'pt_BR',
            text: 'Browser-native AI',
          },
        ],
      },
    ]);
  });
});
