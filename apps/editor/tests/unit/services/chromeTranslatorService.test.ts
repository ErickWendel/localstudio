import { vi } from 'vitest';
import { ChromeTranslatorService } from '../../../src/services/chromeTranslatorService';

describe('ChromeTranslatorService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects language with Chrome LanguageDetector when available', async () => {
    vi.stubGlobal('LanguageDetector', {
      create: vi.fn().mockResolvedValue({
        detect: vi.fn().mockResolvedValue([{ detectedLanguage: 'en' }]),
      }),
    });
    const service = new ChromeTranslatorService();

    await expect(service.detectLanguage('Hello')).resolves.toBe('en');
  });

  it('maps unsupported detector languages to supported translator languages', async () => {
    vi.stubGlobal('LanguageDetector', {
      create: vi.fn().mockResolvedValue({
        detect: vi.fn().mockResolvedValue([{ detectedLanguage: 'gl' }]),
      }),
    });
    const service = new ChromeTranslatorService();

    await expect(service.detectLanguage('Revolución de deseño')).resolves.toBe('es');
  });

  it('translates with Chrome Translator API', async () => {
    const availability = vi.fn().mockResolvedValue('available');
    const create = vi.fn().mockResolvedValue({
      translate: vi.fn().mockResolvedValue('Ola'),
    });
    vi.stubGlobal('LanguageDetector', {
      create: vi.fn().mockResolvedValue({
        detect: vi.fn().mockResolvedValue([{ detectedLanguage: 'en' }]),
      }),
    });
    vi.stubGlobal('Translator', {
      availability,
      create,
    });
    const service = new ChromeTranslatorService();

    await expect(service.translate('Hello', 'pt')).resolves.toBe('Ola');
    expect(availability).toHaveBeenCalledWith({ sourceLanguage: 'en', targetLanguage: 'pt' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ sourceLanguage: 'en', targetLanguage: 'pt' }),
    );
  });

  it('creates a translator when the language pair is downloadable', async () => {
    const create = vi.fn().mockResolvedValue({
      ready: Promise.resolve(),
      translate: vi.fn().mockResolvedValue('Hello'),
    });
    vi.stubGlobal('LanguageDetector', {
      create: vi.fn().mockResolvedValue({
        detect: vi.fn().mockResolvedValue([{ detectedLanguage: 'es' }]),
      }),
    });
    vi.stubGlobal('Translator', {
      availability: vi.fn().mockResolvedValue('downloadable'),
      create,
    });
    const service = new ChromeTranslatorService();

    await expect(service.translate('Hola', 'en')).resolves.toBe('Hello');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ sourceLanguage: 'es', targetLanguage: 'en' }),
    );
  });

  it('prepares a downloadable language pair and reports download progress', async () => {
    const progressTarget = new EventTarget();
    const onProgress = vi.fn();
    vi.stubGlobal('Translator', {
      availability: vi.fn().mockResolvedValue('downloadable'),
      create: vi.fn().mockImplementation((options: { monitor?: (target: EventTarget) => void }) => {
        options.monitor?.(progressTarget);
        const progressEvent = new Event('downloadprogress') as ProgressEvent;
        Object.defineProperty(progressEvent, 'loaded', { value: 0.42 });
        progressTarget.dispatchEvent(progressEvent);
        return Promise.resolve({
          ready: Promise.resolve(),
          translate: vi.fn().mockResolvedValue('Hello'),
        });
      }),
    });
    const service = new ChromeTranslatorService();

    await service.prepareTranslation('es', 'en', { onProgress });

    expect(onProgress).toHaveBeenCalledWith(42);
    expect(onProgress).toHaveBeenLastCalledWith(100);
  });

  it('reuses a prepared translator for later translations', async () => {
    const translate = vi.fn().mockResolvedValue('Hello');
    const create = vi.fn().mockResolvedValue({
      ready: Promise.resolve(),
      translate,
    });
    vi.stubGlobal('LanguageDetector', {
      create: vi.fn().mockResolvedValue({
        detect: vi.fn().mockResolvedValue([{ detectedLanguage: 'es' }]),
      }),
    });
    vi.stubGlobal('Translator', {
      availability: vi.fn().mockResolvedValue('downloadable'),
      create,
    });
    const service = new ChromeTranslatorService();

    await service.prepareTranslation('es', 'en');
    await expect(service.translate('Hola', 'en')).resolves.toBe('Hello');

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('creates a translator when the language pair is already downloading', async () => {
    vi.stubGlobal('LanguageDetector', {
      create: vi.fn().mockResolvedValue({
        detect: vi.fn().mockResolvedValue([{ detectedLanguage: 'es' }]),
      }),
    });
    vi.stubGlobal('Translator', {
      availability: vi.fn().mockResolvedValue('downloading'),
      create: vi.fn().mockResolvedValue({
        ready: Promise.resolve(),
        translate: vi.fn().mockResolvedValue('Hello'),
      }),
    });
    const service = new ChromeTranslatorService();

    await expect(service.translate('Hola', 'en')).resolves.toBe('Hello');
  });

  it('creates a translator for legacy after-download availability', async () => {
    const create = vi.fn().mockResolvedValue({
      ready: Promise.resolve(),
      translate: vi.fn().mockResolvedValue('Hello'),
    });
    vi.stubGlobal('LanguageDetector', {
      create: vi.fn().mockResolvedValue({
        detect: vi.fn().mockResolvedValue([{ detectedLanguage: 'es' }]),
      }),
    });
    vi.stubGlobal('Translator', {
      availability: vi.fn().mockResolvedValue('after-download'),
      create,
    });
    const service = new ChromeTranslatorService();

    await expect(service.translate('Hola', 'en')).resolves.toBe('Hello');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ sourceLanguage: 'es', targetLanguage: 'en' }),
    );
  });

  it('creates a translator for legacy readily availability', async () => {
    vi.stubGlobal('LanguageDetector', {
      create: vi.fn().mockResolvedValue({
        detect: vi.fn().mockResolvedValue([{ detectedLanguage: 'en' }]),
      }),
    });
    vi.stubGlobal('Translator', {
      availability: vi.fn().mockResolvedValue('readily'),
      create: vi.fn().mockResolvedValue({
        ready: Promise.resolve(),
        translate: vi.fn().mockResolvedValue('Ola'),
      }),
    });
    const service = new ChromeTranslatorService();

    await expect(service.translate('Hello', 'pt')).resolves.toBe('Ola');
  });

  it('rejects unsupported language pairs before creating a translator', async () => {
    const create = vi.fn();
    vi.stubGlobal('LanguageDetector', {
      create: vi.fn().mockResolvedValue({
        detect: vi.fn().mockResolvedValue([{ detectedLanguage: 'es' }]),
      }),
    });
    vi.stubGlobal('Translator', {
      availability: vi.fn().mockResolvedValue('unavailable'),
      create,
    });
    const service = new ChromeTranslatorService();

    await expect(service.translate('Hola', 'en')).rejects.toThrow(
      'Chrome Built-in AI translation is not ready for es to en. Availability: unavailable.',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('detects source language and skips translation when source and target match', async () => {
    const availability = vi.fn();
    const create = vi.fn();
    vi.stubGlobal('LanguageDetector', {
      create: vi.fn().mockResolvedValue({
        detect: vi.fn().mockResolvedValue([{ detectedLanguage: 'pt-BR' }]),
      }),
    });
    vi.stubGlobal('Translator', { availability, create });
    const service = new ChromeTranslatorService();

    await expect(service.translate('Ola', 'pt')).resolves.toBe('Ola');
    expect(availability).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('uses an explicit source language instead of re-detecting text', async () => {
    const detectorCreate = vi.fn();
    const create = vi.fn().mockResolvedValue({
      ready: Promise.resolve(),
      translate: vi.fn().mockResolvedValue('Hello'),
    });
    vi.stubGlobal('LanguageDetector', { create: detectorCreate });
    vi.stubGlobal('Translator', {
      availability: vi.fn().mockResolvedValue('available'),
      create,
    });
    const service = new ChromeTranslatorService();

    await expect(service.translate('Hola', 'en', { sourceLanguage: 'es' })).resolves.toBe('Hello');
    expect(detectorCreate).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ sourceLanguage: 'es', targetLanguage: 'en' }),
    );
  });

  it('normalizes explicit unsupported source aliases before creating translators', async () => {
    const create = vi.fn().mockResolvedValue({
      ready: Promise.resolve(),
      translate: vi.fn().mockResolvedValue('Hello'),
    });
    vi.stubGlobal('Translator', {
      availability: vi.fn().mockResolvedValue('available'),
      create,
    });
    const service = new ChromeTranslatorService();

    await expect(service.translate('Hola', 'en', { sourceLanguage: 'gl' })).resolves.toBe('Hello');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ sourceLanguage: 'es', targetLanguage: 'en' }),
    );
  });

  it('rejects when Chrome Translator is unavailable', async () => {
    vi.stubGlobal('Translator', undefined);
    const service = new ChromeTranslatorService();

    await expect(service.translate('Hello', 'pt')).rejects.toThrow(
      'Chrome Built-in AI translation is unavailable.',
    );
  });
});
