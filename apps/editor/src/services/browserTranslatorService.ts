import {
  LANGUAGE_DETECTION_MODEL_ID,
  LANGUAGE_DETECTION_DISPLAY_NAME,
  LANGUAGE_DETECTION_TRANSFORMERS_MODEL_ID,
  TRANSLATEGEMMA_DISPLAY_NAME,
  TRANSLATEGEMMA_MODEL_ID,
  TRANSLATEGEMMA_TRANSFORMERS_MODEL_ID,
} from './aiModelIds';
import {
  ChromeTranslatorService,
  hasChromeLanguageDetector,
  normalizeDetectedLanguageCode,
} from './chromeTranslatorService';
import type { AiProviderState, ModelSetupService, TranslatorService } from './interfaces';
import {
  getBrowserProviderStorage,
  getModelReadiness,
  isWebGpuCompatible,
  selectDefaultProvider,
} from './providerSelection';
import { createMonotonicProgressReporter, mapProgressToRange } from './progress';
import {
  TransformersLanguageDetectionRuntime,
  type LanguageDetectionRuntime,
} from './webGpuLanguageDetectionRuntime';
import { TransformersTextGenerationRuntime, type TextGenerationRuntime } from './webGpuTextGenerationRuntime';

export const CHROME_TRANSLATION_PROVIDER_ID = 'chrome-translator-api';
export const TRANSLATEGEMMA_PROVIDER_ID = 'translategemma-webgpu';
export const TRANSLATION_PROVIDER_STORAGE_KEY = 'localstudio.ai.translation-provider';
export const CHROME_LANGUAGE_DETECTION_PROVIDER_ID = 'chrome-language-detector-api';
export const WEBGPU_LANGUAGE_DETECTION_PROVIDER_ID = 'language-detection-webgpu';
export const LANGUAGE_DETECTION_PROVIDER_STORAGE_KEY = 'localstudio.ai.language-detection-provider';

interface TranslationProvider {
  id: string;
  label: string;
  description: string;
  runtime: AiProviderState['runtime'];
  modelId?: string | undefined;
  checkCompatibility(): { compatible: boolean; disabledReason?: string | undefined } | Promise<{ compatible: boolean; disabledReason?: string | undefined }>;
  prepare(
    sourceLanguage: string,
    targetLanguage: string,
    modelSetupService: ModelSetupService,
    options?: { onProgress?: (progress: number) => void },
  ): Promise<void>;
  translate(text: string, targetLanguage: string, options?: { sourceLanguage?: string }): Promise<string>;
  detectLanguage?(text: string): Promise<string>;
}

interface LanguageDetectionProvider {
  id: string;
  label: string;
  description: string;
  runtime: AiProviderState['runtime'];
  modelId?: string | undefined;
  checkCompatibility(): { compatible: boolean; disabledReason?: string | undefined };
  prepare(modelSetupService: ModelSetupService, options?: { onProgress?: (progress: number) => void }): Promise<void>;
  detectLanguage(text: string): Promise<string>;
}

type ChromeTranslatorApi = {
  availability?: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<string>;
};

type TranslationWindow = Window &
  typeof globalThis & {
    Translator?: ChromeTranslatorApi;
  };

const TRANSLATEGEMMA_LANGUAGE_CODES = new Set([
  'ar',
  'bg',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'fr',
  'he',
  'hi',
  'hr',
  'hu',
  'id',
  'it',
  'ja',
  'ko',
  'nl',
  'pl',
  'pt_BR',
  'ro',
  'ru',
  'sk',
  'sl',
  'sv',
  'sw',
  'th',
  'tr',
  'uk',
  'vi',
  'zh',
]);

const TRANSLATEGEMMA_LANGUAGE_ALIASES: Record<string, string> = {
  he: 'he',
  iw: 'he',
  pt: 'pt_BR',
  'pt-BR': 'pt_BR',
  'pt_BR': 'pt_BR',
  zh: 'zh',
  'zh-CN': 'zh',
  'zh-Hant': 'zh',
  'zh-TW': 'zh',
};

function getChromeTranslatorApi() {
  if (typeof window === 'undefined') return undefined;
  return (window as TranslationWindow).Translator;
}

export function toTranslateGemmaLanguageCode(languageCode: string | undefined, fallback = 'en') {
  const requestedCode = languageCode?.trim() || fallback;
  const baseCode = requestedCode.split('-')[0] ?? requestedCode;
  const translateGemmaCode =
    TRANSLATEGEMMA_LANGUAGE_ALIASES[requestedCode] ??
    TRANSLATEGEMMA_LANGUAGE_ALIASES[baseCode] ??
    requestedCode;

  if (TRANSLATEGEMMA_LANGUAGE_CODES.has(translateGemmaCode)) return translateGemmaCode;
  if (TRANSLATEGEMMA_LANGUAGE_CODES.has(baseCode)) return baseCode;

  throw new Error(`TranslateGemma does not support ${requestedCode}.`);
}

export function createTranslateGemmaMessages(options: {
  sourceLanguage?: string | undefined;
  targetLanguage: string;
  text: string;
}) {
  return [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          source_lang_code: toTranslateGemmaLanguageCode(options.sourceLanguage),
          target_lang_code: toTranslateGemmaLanguageCode(options.targetLanguage),
          text: options.text,
        },
      ],
    },
  ];
}

class ChromeTranslationProvider implements TranslationProvider {
  id = CHROME_TRANSLATION_PROVIDER_ID;
  label = 'Chrome Built-in Translator';
  description = 'Uses Chrome built-in local translation support.';
  runtime = 'chrome-built-in' as const;

  constructor(private readonly chromeTranslatorService = new ChromeTranslatorService()) {}

  async checkCompatibility() {
    const translator = getChromeTranslatorApi();
    if (!translator?.availability) {
      return {
        compatible: false,
        disabledReason: 'Chrome Built-in Translator is unavailable in this browser.',
      };
    }

    try {
      const availability = await translator.availability({ sourceLanguage: 'en', targetLanguage: 'pt' });
      return availability === 'unavailable'
        ? {
            compatible: false,
            disabledReason: 'Chrome Built-in Translator reports unavailable.',
          }
        : { compatible: true };
    } catch {
      return {
        compatible: false,
        disabledReason: 'Chrome Built-in Translator readiness could not be checked.',
      };
    }
  }

  detectLanguage(text: string): Promise<string> {
    return this.chromeTranslatorService.detectLanguage(text);
  }

  prepare(
    sourceLanguage: string,
    targetLanguage: string,
    _modelSetupService: ModelSetupService,
    options?: { onProgress?: (progress: number) => void },
  ): Promise<void> {
    return this.chromeTranslatorService.prepareTranslation(sourceLanguage, targetLanguage, options);
  }

  translate(text: string, targetLanguage: string, options?: { sourceLanguage?: string }): Promise<string> {
    return this.chromeTranslatorService.translate(text, targetLanguage, options);
  }
}

class TranslateGemmaProvider implements TranslationProvider {
  id = TRANSLATEGEMMA_PROVIDER_ID;
  label = TRANSLATEGEMMA_DISPLAY_NAME;
  description = 'Browser-local WebGPU translation model.';
  runtime = 'webgpu-huggingface' as const;
  modelId = TRANSLATEGEMMA_MODEL_ID;

  constructor(private readonly runtimeClient: TextGenerationRuntime = new TransformersTextGenerationRuntime()) {}

  checkCompatibility() {
    return isWebGpuCompatible()
      ? { compatible: true }
      : { compatible: false, disabledReason: 'WebGPU is required for TranslateGemma.' };
  }

  async prepare(
    _sourceLanguage: string,
    _targetLanguage: string,
    modelSetupService: ModelSetupService,
    options?: { onProgress?: (progress: number) => void },
  ): Promise<void> {
    const reportProgress = createMonotonicProgressReporter(options?.onProgress, { initial: 4, min: 4, max: 100 });
    await modelSetupService.downloadModel(TRANSLATEGEMMA_MODEL_ID, {
      onProgress: (progress) => reportProgress(progress >= 99 ? 99 : mapProgressToRange(progress, 4, 99)),
    });
    reportProgress(100);
  }

  async translate(text: string, targetLanguage: string, options?: { sourceLanguage?: string }): Promise<string> {
    const messages = createTranslateGemmaMessages({
      sourceLanguage: options?.sourceLanguage,
      targetLanguage,
      text,
    });
    return this.runtimeClient.generate(TRANSLATEGEMMA_TRANSFORMERS_MODEL_ID, messages, {
      max_new_tokens: Math.max(64, Math.min(1024, Math.ceil(text.length * 2.5))),
    });
  }
}

class ChromeLanguageDetectionProvider implements LanguageDetectionProvider {
  id = CHROME_LANGUAGE_DETECTION_PROVIDER_ID;
  label = 'Chrome Built-in Language Detector';
  description = 'Detect slide text language using Chrome Built-in AI.';
  runtime = 'chrome-built-in' as const;

  constructor(private readonly chromeTranslatorService = new ChromeTranslatorService()) {}

  checkCompatibility() {
    return hasChromeLanguageDetector()
      ? { compatible: true }
      : { compatible: false, disabledReason: 'Chrome Built-in LanguageDetector is unavailable in this browser.' };
  }

  prepare(_modelSetupService: ModelSetupService, options?: { onProgress?: (progress: number) => void }) {
    options?.onProgress?.(100);
    return Promise.resolve();
  }

  detectLanguage(text: string) {
    return this.chromeTranslatorService.detectLanguage(text);
  }
}

class WebGpuLanguageDetectionProvider implements LanguageDetectionProvider {
  id = WEBGPU_LANGUAGE_DETECTION_PROVIDER_ID;
  label = LANGUAGE_DETECTION_DISPLAY_NAME;
  description = 'Browser-local XLM-RoBERTa language detection fallback.';
  runtime = 'webgpu-huggingface' as const;
  modelId = LANGUAGE_DETECTION_MODEL_ID;

  constructor(private readonly runtimeClient: LanguageDetectionRuntime = new TransformersLanguageDetectionRuntime()) {}

  checkCompatibility() {
    return isWebGpuCompatible()
      ? { compatible: true }
      : { compatible: false, disabledReason: 'WebGPU is required for external language detection.' };
  }

  async prepare(modelSetupService: ModelSetupService, options?: { onProgress?: (progress: number) => void }) {
    const reportProgress = createMonotonicProgressReporter(options?.onProgress, { initial: 4, min: 4, max: 100 });
    await modelSetupService.downloadModel(LANGUAGE_DETECTION_MODEL_ID, {
      onProgress: (progress) => reportProgress(progress >= 99 ? 99 : mapProgressToRange(progress, 4, 99)),
    });
    reportProgress(100);
  }

  async detectLanguage(text: string) {
    const result = await this.runtimeClient.detectLanguage(LANGUAGE_DETECTION_TRANSFORMERS_MODEL_ID, text);
    return normalizeDetectedLanguageCode(result.language);
  }
}

export class BrowserTranslatorService implements TranslatorService {
  private selectedProviderId: string | undefined;
  private selectedLanguageDetectionProviderId: string | undefined;
  private forceSelectedProvider = false;
  private forceSelectedLanguageDetectionProvider = false;
  private readonly providers: TranslationProvider[];
  private readonly languageDetectionProviders: LanguageDetectionProvider[];

  constructor(
    private readonly modelSetupService: ModelSetupService,
    providers?: TranslationProvider[],
    private readonly storage = getBrowserProviderStorage(),
    textGenerationRuntime: TextGenerationRuntime = new TransformersTextGenerationRuntime(),
    private readonly languageDetectionRuntime: LanguageDetectionRuntime = new TransformersLanguageDetectionRuntime(),
  ) {
    this.providers = providers ?? [new ChromeTranslationProvider(), new TranslateGemmaProvider(textGenerationRuntime)];
    this.languageDetectionProviders = [
      new ChromeLanguageDetectionProvider(),
      new WebGpuLanguageDetectionProvider(languageDetectionRuntime),
    ];
    this.selectedProviderId = storage?.getItem(TRANSLATION_PROVIDER_STORAGE_KEY) ?? undefined;
    this.selectedLanguageDetectionProviderId =
      storage?.getItem(LANGUAGE_DETECTION_PROVIDER_STORAGE_KEY) ?? undefined;
  }

  getSelectedProviderId() {
    return this.selectedProviderId ?? CHROME_TRANSLATION_PROVIDER_ID;
  }

  async setSelectedProvider(providerId: string) {
    const provider = this.providers.find((item) => item.id === providerId);
    if (!provider) throw new Error(`Unknown translation provider: ${providerId}`);
    this.selectedProviderId = provider.id;
    this.forceSelectedProvider = true;
    this.storage?.setItem(TRANSLATION_PROVIDER_STORAGE_KEY, provider.id);
    return this.getProviderStates();
  }

  async getLanguageDetectionProviderStates(): Promise<AiProviderState[]> {
    const modelStates = await this.modelSetupService.getModelStates();
    const states = this.languageDetectionProviders.map((provider) => {
      const compatibility = provider.checkCompatibility();
      return {
        id: provider.id,
        label: provider.label,
        description: provider.description,
        capability: 'language-detection' as const,
        runtime: provider.runtime,
        compatibility: compatibility.compatible ? 'compatible' as const : 'incompatible' as const,
        disabledReason: compatibility.disabledReason,
        modelId: provider.modelId,
        readiness:
          provider.runtime === 'chrome-built-in'
            ? compatibility.compatible
              ? 'ready' as const
              : 'unavailable' as const
            : getModelReadiness(modelStates, provider.modelId),
        selected: false,
      } satisfies AiProviderState;
    });
    const selected = selectDefaultProvider(states, this.selectedLanguageDetectionProviderId, {
      forcePreferred: this.forceSelectedLanguageDetectionProvider,
    });
    this.selectedLanguageDetectionProviderId = selected?.id;
    return states.map((state) => ({ ...state, selected: state.id === selected?.id }));
  }

  async setLanguageDetectionProvider(providerId: string) {
    const provider = this.languageDetectionProviders.find((item) => item.id === providerId);
    if (!provider) throw new Error(`Unknown language detection provider: ${providerId}`);
    this.selectedLanguageDetectionProviderId = provider.id;
    this.forceSelectedLanguageDetectionProvider = true;
    this.storage?.setItem(LANGUAGE_DETECTION_PROVIDER_STORAGE_KEY, provider.id);
    return this.getLanguageDetectionProviderStates();
  }

  async getProviderStates(): Promise<AiProviderState[]> {
    const modelStates = await this.modelSetupService.getModelStates();
    const states = await Promise.all(
      this.providers.map(async (provider) => {
        const compatibility = await provider.checkCompatibility();
        return {
          id: provider.id,
          label: provider.label,
          description: provider.description,
          capability: 'translation' as const,
          runtime: provider.runtime,
          compatibility: compatibility.compatible ? 'compatible' : 'incompatible',
          disabledReason: compatibility.disabledReason,
          modelId: provider.modelId,
          readiness:
            provider.runtime === 'chrome-built-in'
              ? compatibility.compatible
                ? 'ready'
                : 'unavailable'
              : getModelReadiness(modelStates, provider.modelId),
          selected: false,
        } satisfies AiProviderState;
      }),
    );
    const selected = selectDefaultProvider(states, this.selectedProviderId, {
      forcePreferred: this.forceSelectedProvider,
    });
    this.selectedProviderId = selected?.id;
    return states.map((state) => ({ ...state, selected: state.id === selected?.id }));
  }

  async prepareLanguageDetection(options?: { onProgress?: (progress: number) => void }) {
    await this.getSelectedLanguageDetectionProvider().prepare(this.modelSetupService, options);
  }

  async detectLanguage(
    text: string,
    options?: { allowModelPreparation?: boolean; onProgress?: (progress: number) => void },
  ): Promise<string> {
    const provider = this.getSelectedLanguageDetectionProvider();
    if (options?.allowModelPreparation === false && provider.runtime !== 'chrome-built-in') {
      return normalizeDetectedLanguageCode(navigator.language || 'en');
    }
    try {
      await provider.prepare(this.modelSetupService, options);
      return normalizeDetectedLanguageCode(await provider.detectLanguage(text));
    } catch {
      return normalizeDetectedLanguageCode(navigator.language || 'en');
    }
  }

  async prepareTranslation(
    sourceLanguage: string,
    targetLanguage: string,
    options?: { onProgress?: (progress: number) => void },
  ): Promise<void> {
    await this.getSelectedProvider().prepare(sourceLanguage, targetLanguage, this.modelSetupService, options);
  }

  translate(text: string, targetLanguage: string, options?: { sourceLanguage?: string }): Promise<string> {
    return this.getSelectedProvider().translate(text, targetLanguage, options);
  }

  private getSelectedProvider() {
    return (
      this.providers.find((provider) => provider.id === this.selectedProviderId) ??
      this.providers.find((provider) => provider.id === CHROME_TRANSLATION_PROVIDER_ID) ??
      this.providers[0]!
    );
  }

  private getSelectedLanguageDetectionProvider() {
    const selectedProvider = this.languageDetectionProviders.find(
      (provider) => provider.id === this.selectedLanguageDetectionProviderId,
    );
    if (selectedProvider) return selectedProvider;

    return (
      this.languageDetectionProviders.find(
        (provider) => provider.id === CHROME_LANGUAGE_DETECTION_PROVIDER_ID && provider.checkCompatibility().compatible,
      ) ??
      this.languageDetectionProviders.find(
        (provider) => provider.id === WEBGPU_LANGUAGE_DETECTION_PROVIDER_ID && provider.checkCompatibility().compatible,
      ) ??
      this.languageDetectionProviders[0]!
    );
  }
}
