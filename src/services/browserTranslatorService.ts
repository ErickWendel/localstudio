import { TRANSLATEGEMMA_MODEL_ID, TRANSLATEGEMMA_TRANSFORMERS_MODEL_ID } from './aiModelIds';
import { ChromeTranslatorService } from './chromeTranslatorService';
import type { AiProviderState, ModelSetupService, TranslatorService } from './interfaces';
import {
  getBrowserProviderStorage,
  getModelReadiness,
  isWebGpuCompatible,
  selectDefaultProvider,
} from './providerSelection';
import { createMonotonicProgressReporter, mapProgressToRange } from './progress';
import { TransformersTextGenerationRuntime, type TextGenerationRuntime } from './webGpuTextGenerationRuntime';

export const CHROME_TRANSLATION_PROVIDER_ID = 'chrome-translator-api';
export const TRANSLATEGEMMA_PROVIDER_ID = 'translategemma-webgpu';
export const TRANSLATION_PROVIDER_STORAGE_KEY = 'localstudio.ai.translation-provider';

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

type ChromeTranslatorApi = {
  availability?: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<string>;
};

type TranslationWindow = Window &
  typeof globalThis & {
    Translator?: ChromeTranslatorApi;
  };

function getChromeTranslatorApi() {
  if (typeof window === 'undefined') return undefined;
  return (window as TranslationWindow).Translator;
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
  label = 'TranslateGemma WebGPU';
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
      onProgress: (progress) => reportProgress(mapProgressToRange(progress, 4, 92)),
    });
    await this.runtimeClient.preload(TRANSLATEGEMMA_TRANSFORMERS_MODEL_ID, {
      onProgress: (progress) => reportProgress(mapProgressToRange(progress, 4, 99)),
    });
    reportProgress(100);
  }

  async translate(text: string, targetLanguage: string, options?: { sourceLanguage?: string }): Promise<string> {
    const prompt = [
      `Translate the following text from ${options?.sourceLanguage ?? 'auto'} to ${targetLanguage}.`,
      'Return only the translated text, with no explanation.',
      '',
      text,
    ].join('\n');
    return this.runtimeClient.generate(TRANSLATEGEMMA_TRANSFORMERS_MODEL_ID, prompt);
  }
}

export class BrowserTranslatorService implements TranslatorService {
  private selectedProviderId: string | undefined;
  private forceSelectedProvider = false;
  private readonly providers: TranslationProvider[];

  constructor(
    private readonly modelSetupService: ModelSetupService,
    providers?: TranslationProvider[],
    private readonly storage = getBrowserProviderStorage(),
    textGenerationRuntime: TextGenerationRuntime = new TransformersTextGenerationRuntime(),
  ) {
    this.providers = providers ?? [new ChromeTranslationProvider(), new TranslateGemmaProvider(textGenerationRuntime)];
    this.selectedProviderId = storage?.getItem(TRANSLATION_PROVIDER_STORAGE_KEY) ?? undefined;
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

  async detectLanguage(text: string): Promise<string> {
    const provider = this.getSelectedProvider();
    if (provider.detectLanguage) return provider.detectLanguage(text);
    return navigator.language || 'en';
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
}
