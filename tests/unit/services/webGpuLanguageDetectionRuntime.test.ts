import { describe, expect, it } from 'vitest';
import { extractDetectedLanguage } from '../../../src/services/webGpuLanguageDetectionRuntime';

describe('extractDetectedLanguage', () => {
  it('extracts the top language from text-classification output', () => {
    expect(extractDetectedLanguage([{ label: 'fr', score: 0.998 }])).toEqual({
      language: 'fr',
      score: 0.998,
    });
  });

  it('extracts the top language from nested top-k output', () => {
    expect(extractDetectedLanguage([[{ label: 'pt', score: 0.991 }]])).toEqual({
      language: 'pt',
      score: 0.991,
    });
  });
});
