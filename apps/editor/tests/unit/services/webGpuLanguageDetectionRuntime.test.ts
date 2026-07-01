import { describe, expect, it } from 'vitest';
import { webGpuLanguageDetectionRuntime } from '../../../src/services/translation/webGpuLanguageDetectionRuntime';

describe('webGpuLanguageDetectionRuntime.extractDetectedLanguage', () => {
  it('extracts the top language from text-classification output', () => {
    expect(webGpuLanguageDetectionRuntime.extractDetectedLanguage([{ label: 'fr', score: 0.998 }])).toEqual({
      language: 'fr',
      score: 0.998,
    });
  });

  it('extracts the top language from nested top-k output', () => {
    expect(webGpuLanguageDetectionRuntime.extractDetectedLanguage([[{ label: 'pt', score: 0.991 }]])).toEqual({
      language: 'pt',
      score: 0.991,
    });
  });
});
