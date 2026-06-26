import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LANGUAGE_DETECTION_PROVIDER_STORAGE_KEY,
  createTranslateGemmaMessages,
  toTranslateGemmaLanguageCode,
} from '../../../src/services/browserTranslatorService';
import {
  LANGUAGE_DETECTION_MODEL_ID,
  LANGUAGE_DETECTION_TRANSFORMERS_MODEL_ID,
  TRANSLATEGEMMA_MODEL_ID,
} from '../../../src/services/aiModelIds';
import type { ModelSetupService, ModelState } from '../../../src/services/interfaces';
import { BrowserTranslatorService } from '../../../src/services/browserTranslatorService';
import { InMemoryModelSetupService } from '../../../src/services/modelSetupService';
import { createEstimatedProgressTicker } from '../../../src/services/progress';
import type { LanguageDetectionRuntime } from '../../../src/services/webGpuLanguageDetectionRuntime';

class RecordingModelSetupService extends InMemoryModelSetupService implements ModelSetupService {
  override downloadModel = vi.fn((id: string, options?: { onProgress?: (progress: number) => void }): Promise<ModelState> => {
    options?.onProgress?.(50);
    return super.downloadModel(id, options);
  });
}

class TestLanguageDetectionRuntime implements LanguageDetectionRuntime {
  preload = vi.fn((_modelId: string, options?: { onProgress?: (progress: number) => void }) => {
    options?.onProgress?.(80);
    return Promise.resolve();
  });

  detectLanguage = vi.fn(() => Promise.resolve({ language: 'fr', score: 0.99 }));
}

class DeferredModelSetupService extends InMemoryModelSetupService implements ModelSetupService {
  resolveDownload: (() => void) | undefined;

  override downloadModel = vi.fn((id: string, options?: { onProgress?: (progress: number) => void }): Promise<ModelState> => {
    options?.onProgress?.(99);
    return new Promise<ModelState>((resolve) => {
      this.resolveDownload = () => {
        resolve({
          id,
          label: id,
          provider: 'transformers',
          required: false,
          status: 'ready',
          progress: 100,
        });
      };
    });
  });
}

function createStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('TranslateGemma helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('can keep progress moving during silent WebGPU finalization', () => {
    vi.useFakeTimers();
    const progress: number[] = [];

    const stop = createEstimatedProgressTicker((value) => progress.push(value), {
      intervalMs: 100,
      max: 98,
      start: 92,
      step: 2,
    });

    vi.advanceTimersByTime(350);
    stop();
    vi.advanceTimersByTime(350);

    expect(progress).toEqual([94, 96, 98]);
    vi.useRealTimers();
  });

  it('advances TranslateGemma progress while model setup is finalizing silently', async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: {},
    });
    const modelSetupService = new DeferredModelSetupService();
    const progress: number[] = [];
    const textRuntime = {
      generate: vi.fn(),
      preload: vi.fn(() => Promise.resolve()),
    };
    const service = new BrowserTranslatorService(
      modelSetupService,
      undefined,
      undefined,
      textRuntime,
    );

    await service.setSelectedProvider?.('translategemma-webgpu');
    const preparePromise = service.prepareTranslation('en', 'es', {
      onProgress: (value) => progress.push(value),
    });
    await Promise.resolve();
    vi.advanceTimersByTime(3_100);

    expect(modelSetupService.downloadModel).toHaveBeenCalledWith(
      TRANSLATEGEMMA_MODEL_ID,
      expect.any(Object),
    );
    expect(progress.some((value) => value > 92 && value < 100)).toBe(true);

    modelSetupService.resolveDownload?.();
    await preparePromise;
    expect(progress.at(-1)).toBe(100);
    vi.useRealTimers();
  });

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

  it('uses Chrome native language detection when available', async () => {
    const detect = vi.fn(() => Promise.resolve([{ detectedLanguage: 'es' }]));
    vi.stubGlobal('LanguageDetector', {
      create: vi.fn(() => Promise.resolve({ detect })),
    });
    const modelSetupService = new RecordingModelSetupService();
    const languageRuntime = new TestLanguageDetectionRuntime();
    const service = new BrowserTranslatorService(
      modelSetupService,
      undefined,
      undefined,
      undefined,
      languageRuntime,
    );

    await expect(service.detectLanguage('Hola mundo')).resolves.toBe('es');

    expect(modelSetupService.downloadModel).not.toHaveBeenCalled();
    expect(languageRuntime.detectLanguage).not.toHaveBeenCalled();
  });

  it('falls back to the WebGPU language detection model when native detection is unavailable', async () => {
    vi.stubGlobal('LanguageDetector', undefined);
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: {},
    });
    const modelSetupService = new RecordingModelSetupService();
    const languageRuntime = new TestLanguageDetectionRuntime();
    const progress: number[] = [];
    const service = new BrowserTranslatorService(
      modelSetupService,
      undefined,
      undefined,
      undefined,
      languageRuntime,
    );

    await expect(
      service.detectLanguage('Bonjour tout le monde', {
        onProgress: (value) => progress.push(value),
      }),
    ).resolves.toBe('fr');

    expect(modelSetupService.downloadModel).toHaveBeenCalledWith(
      LANGUAGE_DETECTION_MODEL_ID,
      expect.any(Object),
    );
    expect(languageRuntime.preload).not.toHaveBeenCalled();
    expect(languageRuntime.detectLanguage).toHaveBeenCalledWith(
      LANGUAGE_DETECTION_TRANSFORMERS_MODEL_ID,
      'Bonjour tout le monde',
    );
    expect(progress.at(-1)).toBe(100);
  });

  it('does not prepare the WebGPU language detector when model preparation is disabled', async () => {
    vi.stubGlobal('LanguageDetector', undefined);
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: {},
    });
    const modelSetupService = new RecordingModelSetupService();
    const languageRuntime = new TestLanguageDetectionRuntime();
    const service = new BrowserTranslatorService(
      modelSetupService,
      undefined,
      createStorage({ 'localstudio.ai.language-detection-provider': 'language-detection-webgpu' }),
      undefined,
      languageRuntime,
    );

    await expect(
      service.detectLanguage('Bonjour tout le monde', {
        allowModelPreparation: false,
      }),
    ).resolves.toBe('en');

    expect(modelSetupService.downloadModel).not.toHaveBeenCalled();
    expect(languageRuntime.preload).not.toHaveBeenCalled();
    expect(languageRuntime.detectLanguage).not.toHaveBeenCalled();
  });

  it('exposes configurable language detection provider states', async () => {
    vi.stubGlobal('LanguageDetector', undefined);
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: {},
    });
    const service = new BrowserTranslatorService(
      new RecordingModelSetupService(),
      undefined,
      createStorage(),
      undefined,
      new TestLanguageDetectionRuntime(),
    );

    const states = await service.getLanguageDetectionProviderStates();

    expect(states).toEqual([
      expect.objectContaining({
        id: 'chrome-language-detector-api',
        compatibility: 'incompatible',
        readiness: 'unavailable',
        selected: false,
      }),
      expect.objectContaining({
        id: 'language-detection-webgpu',
        compatibility: 'compatible',
        modelId: LANGUAGE_DETECTION_MODEL_ID,
        readiness: 'needs-download',
        selected: true,
      }),
    ]);
  });

  it('persists explicit language detection provider selection', async () => {
    vi.stubGlobal('LanguageDetector', {
      create: vi.fn(() => Promise.resolve({ detect: vi.fn() })),
    });
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: {},
    });
    const storage = createStorage();
    const service = new BrowserTranslatorService(
      new RecordingModelSetupService(),
      undefined,
      storage,
      undefined,
      new TestLanguageDetectionRuntime(),
    );

    const states = await service.setLanguageDetectionProvider('language-detection-webgpu');

    expect(storage.getItem(LANGUAGE_DETECTION_PROVIDER_STORAGE_KEY)).toBe('language-detection-webgpu');
    expect(states.find((state) => state.id === 'language-detection-webgpu')).toMatchObject({
      selected: true,
      readiness: 'needs-download',
    });
  });
});
