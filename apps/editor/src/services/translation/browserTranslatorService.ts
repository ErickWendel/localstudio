import { aiModelCatalog } from '../model-setup/aiModelCatalog';
import { chromeTranslatorService as chromeTranslator } from './chromeTranslatorService';
import type {
  AiProviderState,
  ModelDownloadProgressDetails,
  ModelSetupService,
  TranslatorService,
} from '../contracts/interfaces';
import { providerSelection } from '../model-setup/providerSelection';
import { progress as progressUtils } from '../model-setup/progress';
import { webGpuLanguageDetectionRuntime } from './webGpuLanguageDetectionRuntime';
import type { LanguageDetectionRuntime } from './webGpuLanguageDetectionRuntime';
import { webGpuTextGenerationRuntime } from '../prompting/webGpuTextGenerationRuntime';
import type { TextGenerationRuntime } from '../prompting/webGpuTextGenerationRuntime';

const CHROME_TRANSLATION_PROVIDER_ID = 'chrome-translator-api';
const TRANSLATEGEMMA_PROVIDER_ID = 'translategemma-webgpu';
const TRANSLATION_PROVIDER_STORAGE_KEY = 'localstudio.ai.translation-provider';
const CHROME_LANGUAGE_DETECTION_PROVIDER_ID = 'chrome-language-detector-api';
const WEBGPU_LANGUAGE_DETECTION_PROVIDER_ID = 'language-detection-webgpu';
const LANGUAGE_DETECTION_PROVIDER_STORAGE_KEY = 'localstudio.ai.language-detection-provider';

interface TranslationProvider {
  id: string;
  label: string;
  description: string;
  runtime: AiProviderState['runtime'];
  modelId?: string | undefined;
  checkCompatibility():
    | { compatible: boolean; disabledReason?: string | undefined }
    | Promise<{ compatible: boolean; disabledReason?: string | undefined }>;
  prepare(
    sourceLanguage: string,
    targetLanguage: string,
    modelSetupService: ModelSetupService,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void>;
  translate(
    text: string,
    targetLanguage: string,
    options?: { sourceLanguage?: string },
  ): Promise<string>;
  detectLanguage?(text: string): Promise<string>;
}

interface LanguageDetectionProvider {
  id: string;
  label: string;
  description: string;
  runtime: AiProviderState['runtime'];
  modelId?: string | undefined;
  checkCompatibility(): { compatible: boolean; disabledReason?: string | undefined };
  prepare(
    modelSetupService: ModelSetupService,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void>;
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
  pt_BR: 'pt_BR',
  zh: 'zh',
  'zh-CN': 'zh',
  'zh-Hant': 'zh',
  'zh-TW': 'zh',
};

function getChromeTranslatorApi() {
  if (typeof window === 'undefined') return undefined;
  return (window as TranslationWindow).Translator;
}

function toTranslateGemmaLanguageCode(languageCode: string | undefined, fallback = 'en') {
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

function createTranslateGemmaMessages(options: {
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

  constructor(
    private readonly chromeTranslatorService = new chromeTranslator.ChromeTranslatorService(),
  ) {}

  async checkCompatibility() {
    const translator = getChromeTranslatorApi();
    if (!translator?.availability) {
      return {
        compatible: false,
        disabledReason: 'Chrome Built-in Translator is unavailable in this browser.',
      };
    }

    try {
      const availability = await translator.availability({
        sourceLanguage: 'en',
        targetLanguage: 'pt',
      });
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
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void> {
    return this.chromeTranslatorService.prepareTranslation(sourceLanguage, targetLanguage, options);
  }

  translate(
    text: string,
    targetLanguage: string,
    options?: { sourceLanguage?: string },
  ): Promise<string> {
    return this.chromeTranslatorService.translate(text, targetLanguage, options);
  }
}

class TranslateGemmaProvider implements TranslationProvider {
  id = TRANSLATEGEMMA_PROVIDER_ID;
  label = aiModelCatalog.TRANSLATEGEMMA_DISPLAY_NAME;
  description = 'Browser-local WebGPU translation model.';
  runtime = 'webgpu-huggingface' as const;
  modelId = aiModelCatalog.TRANSLATEGEMMA_MODEL_ID;

  constructor(
    private readonly runtimeClient: TextGenerationRuntime = new webGpuTextGenerationRuntime.TransformersTextGenerationRuntime(),
  ) {}

  checkCompatibility() {
    return providerSelection.isWebGpuCompatible()
      ? { compatible: true }
      : { compatible: false, disabledReason: 'WebGPU is required for TranslateGemma.' };
  }

  async prepare(
    _sourceLanguage: string,
    _targetLanguage: string,
    modelSetupService: ModelSetupService,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void> {
    const reportProgress = progressUtils.createMonotonicProgressReporter(options?.onProgress, {
      initial: 4,
      min: 4,
      max: 100,
    });
    await modelSetupService.downloadModel(aiModelCatalog.TRANSLATEGEMMA_MODEL_ID, {
      onProgress: (nextProgress, details) =>
        reportProgress(
          nextProgress >= 99 ? 99 : progressUtils.mapProgressToRange(nextProgress, 4, 99),
          details,
        ),
    });
    reportProgress(100);
  }

  async translate(
    text: string,
    targetLanguage: string,
    options?: { sourceLanguage?: string },
  ): Promise<string> {
    const messages = createTranslateGemmaMessages({
      sourceLanguage: options?.sourceLanguage,
      targetLanguage,
      text,
    });
    return this.runtimeClient.generate(
      aiModelCatalog.TRANSLATEGEMMA_TRANSFORMERS_MODEL_ID,
      messages,
      {
        max_new_tokens: Math.max(64, Math.min(1024, Math.ceil(text.length * 2.5))),
      },
    );
  }
}

class ChromeLanguageDetectionProvider implements LanguageDetectionProvider {
  id = CHROME_LANGUAGE_DETECTION_PROVIDER_ID;
  label = 'Chrome Built-in Language Detector';
  description = 'Detect slide text language using Chrome Built-in AI.';
  runtime = 'chrome-built-in' as const;

  constructor(
    private readonly chromeTranslatorService = new chromeTranslator.ChromeTranslatorService(),
  ) {}

  checkCompatibility() {
    return chromeTranslator.hasChromeLanguageDetector()
      ? { compatible: true }
      : {
          compatible: false,
          disabledReason: 'Chrome Built-in LanguageDetector is unavailable in this browser.',
        };
  }

  prepare(
    _modelSetupService: ModelSetupService,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ) {
    options?.onProgress?.(100);
    return Promise.resolve();
  }

  detectLanguage(text: string) {
    return this.chromeTranslatorService.detectLanguage(text);
  }
}

class WebGpuLanguageDetectionProvider implements LanguageDetectionProvider {
  id = WEBGPU_LANGUAGE_DETECTION_PROVIDER_ID;
  label = aiModelCatalog.LANGUAGE_DETECTION_DISPLAY_NAME;
  description = 'Browser-local XLM-RoBERTa language detection fallback.';
  runtime = 'webgpu-huggingface' as const;
  modelId = aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID;

  constructor(
    private readonly runtimeClient: LanguageDetectionRuntime = new webGpuLanguageDetectionRuntime.TransformersLanguageDetectionRuntime(),
  ) {}

  checkCompatibility() {
    return providerSelection.isWebGpuCompatible()
      ? { compatible: true }
      : {
          compatible: false,
          disabledReason: 'WebGPU is required for external language detection.',
        };
  }

  async prepare(
    modelSetupService: ModelSetupService,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ) {
    const reportProgress = progressUtils.createMonotonicProgressReporter(options?.onProgress, {
      initial: 4,
      min: 4,
      max: 100,
    });
    await modelSetupService.downloadModel(aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID, {
      onProgress: (nextProgress, details) =>
        reportProgress(
          nextProgress >= 99 ? 99 : progressUtils.mapProgressToRange(nextProgress, 4, 99),
          details,
        ),
    });
    reportProgress(100);
  }

  async detectLanguage(text: string) {
    const result = await this.runtimeClient.detectLanguage(
      aiModelCatalog.LANGUAGE_DETECTION_TRANSFORMERS_MODEL_ID,
      text,
    );
    return chromeTranslator.normalizeDetectedLanguageCode(result.language);
  }
}

class BrowserTranslatorService implements TranslatorService {
  private selectedProviderId: string | undefined;
  private selectedLanguageDetectionProviderId: string | undefined;
  private forceSelectedProvider = false;
  private forceSelectedLanguageDetectionProvider = false;
  private readonly providers: TranslationProvider[];
  private readonly languageDetectionProviders: LanguageDetectionProvider[];

  constructor(
    private readonly modelSetupService: ModelSetupService,
    providers?: TranslationProvider[],
    private readonly storage = providerSelection.getBrowserProviderStorage(),
    textGenerationRuntime: TextGenerationRuntime = new webGpuTextGenerationRuntime.TransformersTextGenerationRuntime(),
    languageDetectionRuntime: LanguageDetectionRuntime = new webGpuLanguageDetectionRuntime.TransformersLanguageDetectionRuntime(),
  ) {
    this.providers = providers ?? [
      new ChromeTranslationProvider(),
      new TranslateGemmaProvider(textGenerationRuntime),
    ];
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
        compatibility: compatibility.compatible
          ? ('compatible' as const)
          : ('incompatible' as const),
        disabledReason: compatibility.disabledReason,
        modelId: provider.modelId,
        readiness:
          provider.runtime === 'chrome-built-in'
            ? compatibility.compatible
              ? ('ready' as const)
              : ('unavailable' as const)
            : providerSelection.getModelReadiness(modelStates, provider.modelId),
        selected: false,
      } satisfies AiProviderState;
    });
    const selected = providerSelection.selectDefaultProvider(
      states,
      this.selectedLanguageDetectionProviderId,
      {
        forcePreferred: this.forceSelectedLanguageDetectionProvider,
      },
    );
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
              : providerSelection.getModelReadiness(modelStates, provider.modelId),
          selected: false,
        } satisfies AiProviderState;
      }),
    );
    const selected = providerSelection.selectDefaultProvider(states, this.selectedProviderId, {
      forcePreferred: this.forceSelectedProvider,
    });
    this.selectedProviderId = selected?.id;
    return states.map((state) => ({ ...state, selected: state.id === selected?.id }));
  }

  async prepareLanguageDetection(options?: {
    onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
  }) {
    await this.getSelectedLanguageDetectionProvider().prepare(this.modelSetupService, options);
  }

  async detectLanguage(
    text: string,
    options?: {
      allowModelPreparation?: boolean;
      onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void;
    },
  ): Promise<string> {
    const provider = this.getSelectedLanguageDetectionProvider();
    if (options?.allowModelPreparation === false && provider.runtime !== 'chrome-built-in') {
      return chromeTranslator.normalizeDetectedLanguageCode(navigator.language || 'en');
    }
    try {
      await provider.prepare(this.modelSetupService, options);
      return chromeTranslator.normalizeDetectedLanguageCode(await provider.detectLanguage(text));
    } catch {
      return chromeTranslator.normalizeDetectedLanguageCode(navigator.language || 'en');
    }
  }

  async prepareTranslation(
    sourceLanguage: string,
    targetLanguage: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void> {
    await this.getSelectedProvider().prepare(
      sourceLanguage,
      targetLanguage,
      this.modelSetupService,
      options,
    );
  }

  translate(
    text: string,
    targetLanguage: string,
    options?: { sourceLanguage?: string },
  ): Promise<string> {
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
        (provider) =>
          provider.id === CHROME_LANGUAGE_DETECTION_PROVIDER_ID &&
          provider.checkCompatibility().compatible,
      ) ??
      this.languageDetectionProviders.find(
        (provider) =>
          provider.id === WEBGPU_LANGUAGE_DETECTION_PROVIDER_ID &&
          provider.checkCompatibility().compatible,
      ) ??
      this.languageDetectionProviders[0]!
    );
  }
}

export const browserTranslatorService = {
  CHROME_TRANSLATION_PROVIDER_ID,
  TRANSLATEGEMMA_PROVIDER_ID,
  TRANSLATION_PROVIDER_STORAGE_KEY,
  CHROME_LANGUAGE_DETECTION_PROVIDER_ID,
  WEBGPU_LANGUAGE_DETECTION_PROVIDER_ID,
  LANGUAGE_DETECTION_PROVIDER_STORAGE_KEY,
  toTranslateGemmaLanguageCode,
  createTranslateGemmaMessages,
  BrowserTranslatorService,
};
