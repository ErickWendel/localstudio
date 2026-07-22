export async function evaluateChromeTranslatorServiceContract() {
  const { chromeTranslatorService } = (await import(
    '/editor/src/services/translation/chromeTranslatorService.ts'
  )) as typeof import('../../../apps/editor/src/services/translation/chromeTranslatorService');
  const { browserTranslatorService } = (await import(
    '/editor/src/services/translation/browserTranslatorService.ts'
  )) as typeof import('../../../apps/editor/src/services/translation/browserTranslatorService');
  const chromeAiWindow = window as Window &
    typeof globalThis & {
      LanguageDetector?: unknown;
      Translator?: unknown;
    };
  const originalTranslator = chromeAiWindow.Translator;
  const originalLanguageDetector = chromeAiWindow.LanguageDetector;
  const originalGpuDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'gpu')
    ?? Object.getOwnPropertyDescriptor(navigator, 'gpu');
  const progress: number[] = [];
  const browserProgress: number[] = [];
  const createdPairs: string[] = [];
  const browserModelDownloads: string[] = [];
  const generatedPayloads: unknown[] = [];
  const captureError = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    return 'missing-error';
  };

  try {
    Object.defineProperty(chromeAiWindow, 'LanguageDetector', {
      configurable: true,
      value: {
        create: async () => {
          await Promise.resolve();
          return {
            detect: async () => {
              await Promise.resolve();
              return [{ detectedLanguage: 'zh-TW' }];
            },
          };
        },
      },
    });
    Object.defineProperty(chromeAiWindow, 'Translator', {
      configurable: true,
      value: {
        availability: async ({ targetLanguage }: { sourceLanguage: string; targetLanguage: string }) => {
          await Promise.resolve();
          if (targetLanguage === 'fr') return 'unavailable';
          return targetLanguage === 'pt' ? 'downloadable' : 'available';
        },
        create: async ({
          monitor,
          sourceLanguage,
          targetLanguage,
        }: {
          monitor?: (target: EventTarget) => void;
          sourceLanguage: string;
          targetLanguage: string;
        }) => {
          await Promise.resolve();
          createdPairs.push(`${sourceLanguage}:${targetLanguage}`);
          if (targetLanguage === 'it') throw new Error('translator create failed');
          const monitorTarget = new EventTarget();
          monitor?.(monitorTarget);
          monitorTarget.dispatchEvent(new ProgressEvent('downloadprogress', { loaded: 0.42 }));
          return {
            ready: Promise.resolve(),
            translate: async (text: string) => {
              await Promise.resolve();
              return `${sourceLanguage}->${targetLanguage}:${text}`;
            },
          };
        },
      },
    });

    const service = new chromeTranslatorService.ChromeTranslatorService();
    const detected = await service.detectLanguage('traditional chinese');
    await service.prepareTranslation('en-US', 'pt-BR', {
      onProgress: (value) => progress.push(value),
    });
    const translated = await service.translate('hello', 'pt-BR', { sourceLanguage: 'en-US' });
    const sameLanguage = await service.translate('same', 'en-US', { sourceLanguage: 'en' });
    const unavailableMessage = await captureError(() => service.prepareTranslation('en', 'fr'));
    const createFailureMessage = await captureError(() => service.prepareTranslation('en', 'it'));

    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      value: {},
    });
    const storage = new Map<string, string>();
    const modelSetupService = {
      downloadModel: async (
        modelId: string,
        options?: { onProgress?: (progress: number) => void },
      ) => {
        await Promise.resolve();
        browserModelDownloads.push(modelId);
        options?.onProgress?.(40);
        options?.onProgress?.(100);
      },
      getModelStates: async () => {
        await Promise.resolve();
        return [
          {
            id: 'translategemma-webgpu',
            progress: 100,
            status: 'ready',
          },
          {
            id: 'language-detection-webgpu',
            progress: 100,
            status: 'ready',
          },
        ];
      },
      removeModel: async () => {
        await Promise.resolve();
      },
    };
    const textRuntime = {
      generate: async (_modelId: string, messages: unknown) => {
        await Promise.resolve();
        generatedPayloads.push(messages);
        return 'translated by gemma';
      },
    };
    const languageRuntime = {
      detectLanguage: async () => {
        await Promise.resolve();
        return { language: 'pt_BR', score: 0.9 };
      },
    };
    Object.defineProperty(chromeAiWindow, 'Translator', {
      configurable: true,
      value: undefined,
    });
    const browserService = new browserTranslatorService.BrowserTranslatorService(
      modelSetupService,
      undefined,
      {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => {
          storage.delete(key);
        },
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      },
      textRuntime,
      languageRuntime,
    );
    const defaultProviderId = browserService.getSelectedProviderId();
    const noChromeStates = await browserService.getProviderStates();
    Object.defineProperty(chromeAiWindow, 'Translator', {
      configurable: true,
      value: {
        availability: async () => {
          await Promise.resolve();
          return 'unavailable';
        },
      },
    });
    const unavailableStates = await browserService.getProviderStates();
    Object.defineProperty(chromeAiWindow, 'Translator', {
      configurable: true,
      value: {
        availability: async () => {
          await Promise.resolve();
          throw new Error('translator availability failed');
        },
      },
    });
    const throwingStates = await browserService.getProviderStates();
    const unknownProviderMessage = await captureError(() =>
      browserService.setSelectedProvider('missing-provider'),
    );
    await browserService.setSelectedProvider(browserTranslatorService.TRANSLATEGEMMA_PROVIDER_ID);
    await browserService.prepareTranslation('en-US', 'pt-BR', {
      onProgress: (value) => browserProgress.push(value),
    });
    const gemmaTranslation = await browserService.translate('hello world', 'pt-BR', {
      sourceLanguage: 'en-US',
    });
    const unsupportedGemmaMessage = await captureError(() =>
      browserService.translate('hello world', 'xx-ZZ', { sourceLanguage: 'en-US' }),
    );
    const unknownLanguageProviderMessage = await captureError(() =>
      browserService.setLanguageDetectionProvider('missing-language-provider'),
    );
    await browserService.setLanguageDetectionProvider(
      browserTranslatorService.WEBGPU_LANGUAGE_DETECTION_PROVIDER_ID,
    );
    const webGpuDetected = await browserService.detectLanguage('ola mundo', {
      onProgress: (value) => browserProgress.push(value),
    });
    const skippedPreparationDetected = await browserService.detectLanguage('skip model', {
      allowModelPreparation: false,
    });
    Object.defineProperty(chromeAiWindow, 'LanguageDetector', {
      configurable: true,
      value: undefined,
    });
    const languageStates = await browserService.getLanguageDetectionProviderStates();

    Object.defineProperty(chromeAiWindow, 'LanguageDetector', {
      configurable: true,
      value: undefined,
    });
    const fallbackDetected = await service.detectLanguage('fallback');

    return {
      createFailureMessage,
      createdPairs,
      detected,
      fallbackDetected,
      hasDetector: chromeTranslatorService.hasChromeLanguageDetector(),
      browserTranslator: {
        browserModelDownloads,
        browserProgress,
        defaultProviderId,
        gemmaTranslation,
        generatedPayloads,
        languageStates: languageStates.map((state) => ({
          id: state.id,
          readiness: state.readiness,
          selected: state.selected,
        })),
        noChromeStates: noChromeStates.map((state) => ({
          id: state.id,
          disabledReason: state.disabledReason,
          readiness: state.readiness,
        })),
        skippedPreparationDetected,
        throwingStateReason: throwingStates[0]?.disabledReason,
        unavailableStateReason: unavailableStates[0]?.disabledReason,
        unknownLanguageProviderMessage,
        unknownProviderMessage,
        unsupportedGemmaMessage,
        webGpuDetected,
      },
      normalized: [
        chromeTranslatorService.normalizeDetectedLanguageCode('ca-ES'),
        chromeTranslatorService.normalizeDetectedLanguageCode('zh-hant'),
      ],
      progress,
      sameLanguage,
      translated,
      unavailableMessage,
    };
  } finally {
    Object.defineProperty(chromeAiWindow, 'Translator', {
      configurable: true,
      value: originalTranslator,
    });
    Object.defineProperty(chromeAiWindow, 'LanguageDetector', {
      configurable: true,
      value: originalLanguageDetector,
    });
    if (originalGpuDescriptor) {
      Object.defineProperty(navigator, 'gpu', originalGpuDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'gpu');
    }
  }
}
