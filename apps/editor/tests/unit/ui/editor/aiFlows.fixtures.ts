import { vi } from 'vitest';
import { createAppServices as createRealAppServices } from '../../../../src/app/composition';
import type { Asset } from '../../../../src/domain/documents/model';
import type {
  GeneratedSlideElement,
  GeneratedSlideTask,
  GeneratedSlideTasksDocument,
} from '../../../../src/domain/generated-slides/generatedSlide';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type {
  AiProviderState,
  ImageGenerationService,
  ModelSetupService,
  ModelState,
  PromptApiAvailability,
  PromptService,
  TranslatorService,
} from '../../../../src/services/contracts/interfaces';
import { aiModelCatalog } from '../../../../src/services/model-setup/aiModelCatalog';
import { modelSetupService } from '../../../../src/services/model-setup/modelSetupService';
import { promptRecipes } from '../../../../src/ui/editor/prompting/promptRecipes';

const createImageExample = promptRecipes.imagePromptExamples[0];

const promptExampleLabels = {
  bulletsSlide:
    'Top title and three body bullets about why Web AI is useful.',
  colorsSlide:
    'Slide with a deep purple background, gold title "Web AI Advantage", and white subtitle "Fast local intelligence".',
  gridSlide: 'Three-image grid about Web AI, with matching captions.',
  leftHeroSlide:
    'Slide with the placeholder image expanded large on the left, the neon green title “AI Design Revolution” on the right, and the subtitle “Browser-native creative” below it.',
  urlImageSlide:
    'Slide using https://img-c.udemycdn.com/course/480x270/5625134_794c.jpg as the main image, with a short title and caption.',
};

function createAppServices(options: Parameters<typeof createRealAppServices>[0] = {}) {
  return createRealAppServices({
    initialProject: sampleProject.createSampleProject(),
    ...options,
  });
}

class PreparingTranslatorService implements TranslatorService {
  prepareTranslation = vi.fn(
    (
      sourceLanguage: string,
      targetLanguage: string,
      options?: { onProgress?: (progress: number) => void },
    ) => {
      void sourceLanguage;
      void targetLanguage;
      options?.onProgress?.(35);
      options?.onProgress?.(100);
      return Promise.resolve();
    },
  );

  detectLanguage(): Promise<string> {
    return Promise.resolve('en');
  }

  translate(text: string, targetLanguage: string): Promise<string> {
    return Promise.resolve(`${targetLanguage}:${text}`);
  }
}

class ConfigurableTranslatorService extends PreparingTranslatorService {
  private selectedProviderId = 'chrome-translator-api';
  private translateGemmaReady: boolean;

  constructor(options: { translateGemmaReady?: boolean } = {}) {
    super();
    this.translateGemmaReady = options.translateGemmaReady ?? false;
  }

  getProviderStates = vi.fn((): Promise<AiProviderState[]> =>
    Promise.resolve(this.createProviderStates()),
  );

  setSelectedProvider = vi.fn((providerId: string): Promise<AiProviderState[]> => {
    this.selectedProviderId = providerId;
    return Promise.resolve(this.createProviderStates());
  });

  override prepareTranslation = vi.fn(
    (
      sourceLanguage: string,
      targetLanguage: string,
      options?: { onProgress?: (progress: number) => void },
    ) => {
      void sourceLanguage;
      void targetLanguage;
      options?.onProgress?.(91);
      options?.onProgress?.(100);
      this.translateGemmaReady = true;
      return Promise.resolve();
    },
  );

  private createProviderStates(): AiProviderState[] {
    return [
      {
        id: 'chrome-translator-api',
        label: 'Chrome Built-in Translator',
        description: 'Uses Chrome built-in local translation support.',
        capability: 'translation',
        runtime: 'chrome-built-in',
        compatibility: 'compatible',
        readiness: 'ready',
        selected: this.selectedProviderId === 'chrome-translator-api',
      },
      {
        id: 'translategemma-webgpu',
        label: 'TranslateGemma 4B',
        description: 'Browser-local WebGPU translation model.',
        capability: 'translation',
        runtime: 'webgpu-huggingface',
        compatibility: 'compatible',
        modelId: 'translategemma-webgpu',
        readiness: this.translateGemmaReady ? 'ready' : 'needs-download',
        selected: this.selectedProviderId === 'translategemma-webgpu',
      },
    ];
  }
}

class ConfigurablePromptService implements PromptService {
  private selectedProviderId = 'chrome-prompt-api';
  private availability: PromptApiAvailability = 'downloadable';
  private gemmaReady = false;

  checkAvailability = vi.fn(() => Promise.resolve(this.gemmaReady ? 'ready' : this.availability));

  getProviderStates = vi.fn((): Promise<AiProviderState[]> =>
    Promise.resolve(this.createProviderStates()),
  );

  setSelectedProvider = vi.fn((providerId: string): Promise<AiProviderState[]> => {
    this.selectedProviderId = providerId;
    return Promise.resolve(this.createProviderStates());
  });

  preparePromptApi = vi.fn((options?: { onProgress?: (progress: number) => void }) => {
    options?.onProgress?.(91);
    options?.onProgress?.(100);
    this.gemmaReady = true;
    this.availability = 'ready';
    return Promise.resolve();
  });

  generateSlideTasksFromPrompt = vi.fn((): Promise<GeneratedSlideTasksDocument> =>
    Promise.resolve({
      language: 'en',
      page: {
        name: 'Generated Web AI Slide',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
      },
      tasks: [{ type: 'add-title', id: 'title', text: 'Why Web AI Matters', placementHint: 'center' }],
    }),
  );

  generateSlideElementFromTask = vi.fn(
    (task: Exclude<GeneratedSlideTask, { type: 'set-background' }>): Promise<GeneratedSlideElement> =>
      Promise.resolve({
        type: 'text',
        id: task.id,
        text: 'text' in task ? task.text : 'Why Web AI Matters',
        x: 720,
        y: 280,
        width: 800,
        height: 180,
        rotation: 0,
        opacity: 1,
        fontFamily: 'Orbitron',
        fontSize: 76,
        fontWeight: 800,
        fill: '#37FD76',
        align: 'center',
      }),
  );

  private createProviderStates(): AiProviderState[] {
    return [
      {
        id: 'chrome-prompt-api',
        label: 'Chrome Built-in Prompt API',
        description: 'Prompt to slides using Chrome Built-in AI.',
        capability: 'prompt',
        runtime: 'chrome-built-in',
        compatibility: 'compatible',
        readiness: 'ready',
        selected: this.selectedProviderId === 'chrome-prompt-api',
      },
      {
        id: 'gemma-4-webgpu',
        label: 'Gemma 4 E2B',
        description: 'Browser-local Gemma LLM for prompt-to-slides.',
        capability: 'prompt',
        runtime: 'webgpu-huggingface',
        modelId: 'gemma-4-webgpu-llm',
        compatibility: 'compatible',
        readiness: this.gemmaReady ? 'ready' : 'needs-download',
        selected: this.selectedProviderId === 'gemma-4-webgpu',
      },
    ];
  }
}

class TestPromptService implements PromptService {
  constructor(protected availability: PromptApiAvailability = 'unavailable') {}

  checkAvailability = vi.fn(() => Promise.resolve(this.availability));

  preparePromptApi = vi.fn((options?: { onProgress?: (progress: number) => void }) => {
    options?.onProgress?.(35);
    options?.onProgress?.(100);
    this.availability = 'ready';
    return Promise.resolve();
  });

  generateSlideTasksFromPrompt = vi.fn((): Promise<GeneratedSlideTasksDocument> => {
    this.availability = 'ready';
    return Promise.resolve({
      language: 'en',
      page: {
        name: 'Generated Web AI Slide',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
      },
      tasks: [
        { type: 'set-background', color: '#050D10' },
        { type: 'add-title', id: 'title', text: 'Why Web AI Matters', placementHint: 'right side' },
      ],
    });
  });

  generateSlideElementFromTask = vi.fn(
    (task: Exclude<GeneratedSlideTask, { type: 'set-background' }>): Promise<GeneratedSlideElement> =>
      Promise.resolve({
        type: 'text',
        id: task.id,
        text: 'text' in task ? task.text : 'Why Web AI Matters',
        x: 960,
        y: 280,
        width: 760,
        height: 160,
        rotation: 0,
        opacity: 1,
        fontFamily: 'Orbitron',
        fontSize: 76,
        fontWeight: 800,
        fill: '#37FD76',
        align: 'center',
      }),
  );
}

class SlowImageGenerationService implements ImageGenerationService {
  generateImage = vi.fn(
    (_prompt: string, options?: Parameters<ImageGenerationService['generateImage']>[1]) =>
      new Promise<Awaited<ReturnType<ImageGenerationService['generateImage']>>>(() => {
        options?.onProgress?.({ label: 'Generating image 1/4', progress: 25 });
      }),
  );
}

class PromptProviderSelectionService extends TestPromptService {
  private selectedProviderId = 'chrome-prompt-api';

  getProviderStates = vi.fn((): Promise<AiProviderState[]> =>
    Promise.resolve([
      {
        id: 'chrome-prompt-api',
        label: 'Chrome Built-in Prompt API',
        description: 'Prompt to slides using Chrome Built-in AI.',
        capability: 'prompt',
        runtime: 'chrome-built-in',
        compatibility: 'compatible',
        readiness: 'ready',
        selected: this.selectedProviderId === 'chrome-prompt-api',
      },
      {
        id: 'gemma-4-webgpu',
        label: 'Gemma 4 WebGPU',
        description: 'Browser-local Gemma LLM for prompt-to-slides.',
        capability: 'prompt',
        runtime: 'webgpu-huggingface',
        modelId: aiModelCatalog.GEMMA_LLM_MODEL_ID,
        compatibility: 'compatible',
        readiness: this.availability === 'ready' ? 'ready' : 'needs-download',
        selected: this.selectedProviderId === 'gemma-4-webgpu',
      },
    ]),
  );

  getSelectedProviderId() {
    return this.selectedProviderId;
  }

  markGemmaNeedsDownload() {
    this.availability = 'downloadable';
  }

  setSelectedProvider(providerId: string) {
    this.selectedProviderId = providerId;
    return this.getProviderStates();
  }
}

class PromptModelSetupService extends modelSetupService.InMemoryModelSetupService implements ModelSetupService {
  constructor(private readonly onGemmaRemoved?: () => void) {
    super();
  }

  private gemmaState: ModelState = {
    id: aiModelCatalog.GEMMA_LLM_MODEL_ID,
    label: 'Gemma 4 WebGPU LLM',
    provider: 'transformers',
    status: 'needs-download',
    progress: 0,
    required: false,
  };

  override async getModelStates(): Promise<ModelState[]> {
    const states = await super.getModelStates();
    return [...states.filter((state) => state.id !== aiModelCatalog.GEMMA_LLM_MODEL_ID), { ...this.gemmaState }];
  }

  override async downloadModel(id: string, options?: { onProgress?: (progress: number) => void }): Promise<ModelState> {
    if (id !== aiModelCatalog.GEMMA_LLM_MODEL_ID) return super.downloadModel(id, options);
    options?.onProgress?.(40);
    options?.onProgress?.(100);
    this.gemmaState = { ...this.gemmaState, status: 'ready', progress: 100 };
    return { ...this.gemmaState };
  }

  override async removeModel(id: string): Promise<ModelState> {
    if (id !== aiModelCatalog.GEMMA_LLM_MODEL_ID) return super.removeModel(id);
    this.onGemmaRemoved?.();
    this.gemmaState = { ...this.gemmaState, status: 'needs-download', progress: 0 };
    return { ...this.gemmaState };
  }
}

class TranslationProviderSelectionService extends PreparingTranslatorService {
  private selectedProviderId = 'chrome-translator-api';
  private translateGemmaReady = false;

  override prepareTranslation = vi.fn(
    (
      sourceLanguage: string,
      targetLanguage: string,
      options?: { onProgress?: (progress: number) => void },
    ) => {
      void sourceLanguage;
      void targetLanguage;
      options?.onProgress?.(45);
      options?.onProgress?.(100);
      this.translateGemmaReady = true;
      return Promise.resolve();
    },
  );

  getProviderStates = vi.fn((): Promise<AiProviderState[]> =>
    Promise.resolve([
      {
        id: 'chrome-translator-api',
        label: 'Chrome Built-in Translator',
        description: 'Translate visible text using Chrome Built-in AI.',
        capability: 'translation',
        runtime: 'chrome-built-in',
        compatibility: 'compatible',
        readiness: 'ready',
        selected: this.selectedProviderId === 'chrome-translator-api',
      },
      {
        id: 'translategemma-webgpu',
        label: 'TranslateGemma WebGPU',
        description: 'Browser-local translation model.',
        capability: 'translation',
        runtime: 'webgpu-huggingface',
        modelId: aiModelCatalog.TRANSLATEGEMMA_MODEL_ID,
        compatibility: 'compatible',
        readiness: this.translateGemmaReady ? 'ready' : 'needs-download',
        selected: this.selectedProviderId === 'translategemma-webgpu',
      },
    ]),
  );

  getSelectedProviderId() {
    return this.selectedProviderId;
  }

  markTranslateGemmaNeedsDownload() {
    this.translateGemmaReady = false;
  }

  setSelectedProvider(providerId: string) {
    this.selectedProviderId = providerId;
    return this.getProviderStates();
  }
}

class TranslationModelSetupService extends modelSetupService.InMemoryModelSetupService implements ModelSetupService {
  constructor(private readonly onTranslateGemmaRemoved?: () => void) {
    super();
  }

  override async removeModel(id: string): Promise<ModelState> {
    const next = await super.removeModel(id);
    if (id === aiModelCatalog.TRANSLATEGEMMA_MODEL_ID) {
      this.onTranslateGemmaRemoved?.();
    }
    return next;
  }
}

class LanguageDetectionProviderSelectionService extends PreparingTranslatorService {
  private selectedProviderId = 'chrome-language-detector-api';
  private languageDetectionReady = false;

  prepareLanguageDetection = vi.fn((options?: { onProgress?: (progress: number) => void }) => {
    options?.onProgress?.(45);
    options?.onProgress?.(100);
    this.languageDetectionReady = true;
    return Promise.resolve();
  });

  getLanguageDetectionProviderStates = vi.fn((): Promise<AiProviderState[]> =>
    Promise.resolve([
      {
        id: 'chrome-language-detector-api',
        label: 'Chrome Built-in Language Detector',
        description: 'Detect text language using Chrome Built-in AI.',
        capability: 'language-detection',
        runtime: 'chrome-built-in',
        compatibility: 'compatible',
        readiness: 'ready',
        selected: this.selectedProviderId === 'chrome-language-detector-api',
      },
      {
        id: 'language-detection-webgpu',
        label: 'XLM-RoBERTa Language Detection',
        description: 'Browser-local language detection model.',
        capability: 'language-detection',
        runtime: 'webgpu-huggingface',
        modelId: aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID,
        compatibility: 'compatible',
        readiness: this.languageDetectionReady ? 'ready' : 'needs-download',
        selected: this.selectedProviderId === 'language-detection-webgpu',
      },
    ]),
  );

  markLanguageDetectionNeedsDownload() {
    this.languageDetectionReady = false;
  }

  setLanguageDetectionProvider(providerId: string) {
    this.selectedProviderId = providerId;
    return this.getLanguageDetectionProviderStates();
  }
}

class LanguageDetectionModelSetupService
  extends modelSetupService.InMemoryModelSetupService
  implements ModelSetupService
{
  constructor(private readonly onLanguageDetectionRemoved?: () => void) {
    super();
  }

  override async removeModel(id: string): Promise<ModelState> {
    const next = await super.removeModel(id);
    if (id === aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID) {
      this.onLanguageDetectionRemoved?.();
    }
    return next;
  }
}

class DeferredImageGenerationService implements ImageGenerationService {
  resolve!: (asset: Asset) => void;

  generateImage = vi.fn(
    (_prompt: string, options?: Parameters<ImageGenerationService['generateImage']>[1]) =>
      new Promise<Awaited<ReturnType<ImageGenerationService['generateImage']>>>((resolve) => {
        this.resolve = resolve;
        options?.onProgress?.({ label: 'Generating image 1/4', progress: 25 });
      }),
  );
}

export const aiFlowTestFixtures = {
  ConfigurablePromptService,
  ConfigurableTranslatorService,
  DeferredImageGenerationService,
  LanguageDetectionModelSetupService,
  LanguageDetectionProviderSelectionService,
  PreparingTranslatorService,
  PromptModelSetupService,
  PromptProviderSelectionService,
  SlowImageGenerationService,
  TestPromptService,
  TranslationModelSetupService,
  TranslationProviderSelectionService,
  createAppServices,
  createImageExample,
  promptExampleLabels,
};
