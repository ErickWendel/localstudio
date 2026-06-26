import type { TranslatorService } from './interfaces';

type ChromeTranslationInstance = {
  ready?: Promise<void>;
  translate: (text: string) => Promise<string>;
};

type ChromeTranslatorApi = {
  availability?: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<string>;
  create?: (options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitorTarget: EventTarget) => void;
  }) => Promise<ChromeTranslationInstance>;
};

type ChromeLanguageDetectorApi = {
  create?: () => Promise<{ detect: (text: string) => Promise<Array<{ detectedLanguage: string }>> }>;
};

type ChromeAiWindow = Window &
  typeof globalThis & {
    LanguageDetector?: ChromeLanguageDetectorApi;
    Translator?: ChromeTranslatorApi;
  };

const DETECTED_LANGUAGE_FALLBACKS: Record<string, string> = {
  ca: 'es',
  gl: 'es',
  he: 'iw',
  nb: 'no',
  nn: 'no',
  'zh-hk': 'zh-Hant',
  'zh-mo': 'zh-Hant',
  'zh-tw': 'zh-Hant',
};

function normalizeLanguageCode(language: string) {
  const normalizedLanguage = language.toLowerCase();
  if (normalizedLanguage === 'zh-hant') return 'zh-Hant';
  const fallbackLanguage = DETECTED_LANGUAGE_FALLBACKS[normalizedLanguage];
  if (fallbackLanguage) return fallbackLanguage;
  const baseLanguage = normalizedLanguage.split('-')[0] || 'en';
  return DETECTED_LANGUAGE_FALLBACKS[baseLanguage] ?? baseLanguage;
}

function canCreateTranslatorFromAvailability(availability: string | undefined) {
  return (
    availability === undefined ||
    availability === 'available' ||
    availability === 'readily' ||
    availability === 'downloadable' ||
    availability === 'downloading' ||
    availability === 'after-download'
  );
}

function getTranslationKey(sourceLanguage: string, targetLanguage: string) {
  return `${sourceLanguage}:${targetLanguage}`;
}

export function hasChromeLanguageDetector() {
  return typeof window !== 'undefined' && Boolean((window as ChromeAiWindow).LanguageDetector?.create);
}

export function normalizeDetectedLanguageCode(language: string) {
  return normalizeLanguageCode(language);
}

export class ChromeTranslatorService implements TranslatorService {
  private readonly translators = new Map<string, Promise<ChromeTranslationInstance>>();

  async detectLanguage(text: string): Promise<string> {
    if (!hasChromeLanguageDetector()) return navigator.language || 'en';
    const createLanguageDetector = (window as ChromeAiWindow).LanguageDetector?.create;
    if (!createLanguageDetector) return navigator.language || 'en';

    const detector = await createLanguageDetector();
    const results = await detector.detect(text);
    return normalizeLanguageCode(results[0]?.detectedLanguage ?? navigator.language ?? 'en');
  }

  async prepareTranslation(
    sourceLanguage: string,
    targetLanguage: string,
    options?: { onProgress?: (progress: number) => void },
  ): Promise<void> {
    const normalizedSourceLanguage = normalizeLanguageCode(sourceLanguage);
    const normalizedTargetLanguage = normalizeLanguageCode(targetLanguage);
    if (normalizedSourceLanguage === normalizedTargetLanguage) {
      options?.onProgress?.(100);
      return;
    }

    await this.getTranslator(normalizedSourceLanguage, normalizedTargetLanguage, options);
  }

  async translate(text: string, targetLanguage: string, options?: { sourceLanguage?: string }): Promise<string> {
    const sourceLanguage = options?.sourceLanguage
      ? normalizeLanguageCode(options.sourceLanguage)
      : await this.detectLanguage(text);
    const normalizedTargetLanguage = normalizeLanguageCode(targetLanguage);
    if (sourceLanguage === normalizedTargetLanguage) return text;

    const translator = await this.getTranslator(sourceLanguage, normalizedTargetLanguage);
    return translator.translate(text);
  }

  private async getTranslator(
    sourceLanguage: string,
    targetLanguage: string,
    options?: { onProgress?: (progress: number) => void },
  ) {
    const translatorApi = (window as ChromeAiWindow).Translator;
    if (!translatorApi?.create) {
      throw new Error('Chrome Built-in AI translation is unavailable.');
    }

    const translationKey = getTranslationKey(sourceLanguage, targetLanguage);
    const cachedTranslator = this.translators.get(translationKey);
    if (cachedTranslator) {
      const translator = await cachedTranslator;
      options?.onProgress?.(100);
      return translator;
    }

    const availability = await translatorApi.availability?.({
      sourceLanguage,
      targetLanguage,
    });
    if (!canCreateTranslatorFromAvailability(availability)) {
      throw new Error(
        `Chrome Built-in AI translation is not ready for ${sourceLanguage} to ${targetLanguage}. Availability: ${availability ?? 'unknown'}.`,
      );
    }

    const translatorPromise = translatorApi
      .create({
        sourceLanguage,
        targetLanguage,
        monitor: (monitorTarget) => {
          monitorTarget.addEventListener('downloadprogress', (event) => {
            const progressEvent = event as ProgressEvent;
            options?.onProgress?.(Math.max(0, Math.min(100, Math.round(progressEvent.loaded * 100))));
          });
        },
      })
      .then(async (translator) => {
        await translator.ready;
        options?.onProgress?.(100);
        return translator;
      })
      .catch((error: unknown) => {
        this.translators.delete(translationKey);
        throw error;
      });

    this.translators.set(translationKey, translatorPromise);
    return translatorPromise;
  }
}
