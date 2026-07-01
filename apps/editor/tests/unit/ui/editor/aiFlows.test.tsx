import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAppServices as createRealAppServices } from '../../../../src/app/composition';
import type {
  GeneratedSlideElement,
  GeneratedSlideTask,
  GeneratedSlideTasksDocument,
} from '../../../../src/domain/generated-slides/generatedSlide';
import type { Asset } from '../../../../src/domain/documents/model';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type {
  AiProviderState,
  ImageGenerationService,
  ImageGenerationOptions,
  ModelSetupService,
  ModelState,
  PromptApiAvailability,
  PromptService,
  TranslatorService,
} from '../../../../src/services/contracts/interfaces';
import { aiModelCatalog } from '../../../../src/services/model-setup/aiModelCatalog';
import { inMemoryAiServices } from '../../../../src/services/testing/inMemoryAiServices';
import { modelSetupService } from '../../../../src/services/model-setup/modelSetupService';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { promptRecipes } from '../../../../src/ui/editor/prompting/promptRecipes';

const createImageExample = promptRecipes.imagePromptExamples[0];

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

  getProviderStates = vi.fn((): Promise<AiProviderState[]> => Promise.resolve(this.createProviderStates()));

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

  getProviderStates = vi.fn((): Promise<AiProviderState[]> => Promise.resolve(this.createProviderStates()));

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
        compatibility: 'compatible',
        modelId: 'gemma-4-webgpu-llm',
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
      new Promise<Awaited<ReturnType<ImageGenerationService['generateImage']>>>((resolve) => {
        options?.onProgress?.({ label: 'Generating image 1/4', progress: 25 });
        setTimeout(() => {
          resolve({
            id: 'asset-slow-generated',
            type: 'image',
            name: 'slow.png',
            mimeType: 'image/png',
            objectUrl:
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lMFeWAAAAABJRU5ErkJggg==',
          });
        }, 250);
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
        compatibility: 'compatible',
        modelId: aiModelCatalog.GEMMA_LLM_MODEL_ID,
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
        compatibility: 'compatible',
        modelId: aiModelCatalog.TRANSLATEGEMMA_MODEL_ID,
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

describe('mocked AI flows', () => {
  const leftHeroSlideExample =
    'Slide with the placeholder image expanded large on the left, the neon green title “AI Design Revolution” on the right, and the subtitle “Browser-native creative” below it.';
  const gridSlideExample = 'Three-image grid about Web AI, with matching captions.';
  const bulletsSlideExample = 'Top title and three body bullets about why Web AI is useful.';
  const urlImageSlideExample =
    'Slide using https://img-c.udemycdn.com/course/480x270/5625134_794c.jpg as the main image, with a short title and caption.';
  const colorsSlideExample =
    'Slide with a deep purple background, gold title "Web AI Advantage", and white subtitle "Fast local intelligence".';

  it('downloads required models from AI Tools panel', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    expect(screen.queryByRole('button', { name: 'Download Required Models' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download Image Editing Models' }));

    expect(await screen.findByText('Image Editing Models')).toBeInTheDocument();
    expect(screen.getAllByText('Ready').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Image Editing Models')).toBeInTheDocument();
    expect(screen.getByText('Image Generation Models')).toBeInTheDocument();
  });

  it('exposes selected-object AI shortcuts', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.click(screen.getByRole('button', { name: 'Selected Image' }));
    expect(screen.getByLabelText('BG Remover')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Title' }));
    expect(screen.getByLabelText('Translate Selected Text')).toBeInTheDocument();
  });

  it('starts in create image mode from the prompt bar', () => {
    render(<EditorShell services={createAppServices()} />);

    expect(screen.getByText('Create image')).toBeInTheDocument();
    expect(screen.getByLabelText('Create image prompt')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: createImageExample,
      }),
    ).toBeInTheDocument();
  });

  it('fills the prompt from contextual examples', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.promptService = new TestPromptService('ready');
    render(<EditorShell services={services} />);

    await user.click(
      screen.getByRole('button', {
        name: createImageExample,
      }),
    );

    expect(screen.getByLabelText('Create image prompt')).toHaveValue(createImageExample);

    await user.clear(screen.getByLabelText('Create image prompt'));
    await user.click(
      screen.getByRole('button', {
        name: leftHeroSlideExample,
      }),
    );

    expect(screen.getByRole('textbox', { name: 'Slide structure prompt' })).toHaveValue(leftHeroSlideExample);
    expect(screen.getByRole('button', { name: gridSlideExample })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: bulletsSlideExample })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: urlImageSlideExample })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: colorsSlideExample })).toBeInTheDocument();
  });

  it('clears create image mode when the prompt text is deleted', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.promptService = new TestPromptService('ready');
    render(<EditorShell services={services} />);

    await user.type(screen.getByLabelText('Create image prompt'), 'hero image');

    await user.clear(screen.getByLabelText('Create image prompt'));

    await waitFor(() => {
      expect(screen.queryByText('Create image')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('textbox', { name: 'Slide structure prompt' })).toHaveValue('');
    expect(
      screen.getByPlaceholderText('Describe slide structure or organize current content...'),
    ).toBeInTheDocument();
  });

  it('clears create image mode when the mode token is clicked', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.promptService = new TestPromptService('ready');
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Remove Create image mode' }));

    expect(screen.queryByRole('button', { name: 'Remove Create image mode' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Slide structure prompt' })).toHaveValue('');
  });

  it('redirects create image prompt typing to AI Tools when image generation models are not ready', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    render(<EditorShell services={services} />);

    await user.type(screen.getByLabelText('Create image prompt'), 'cyberpunk course cover');

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'AI Tools' })).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.getByRole('article', { name: 'Image Generation Models' })).toHaveClass('model-row-attention');
    expect(screen.getByText('Download image generation models before creating images.')).toBeInTheDocument();
  });

  it('downloads image generation models before allowing create image prompts', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Image Generation Models' }));

    await waitFor(() => {
      expect(screen.getByRole('article', { name: 'Image Generation Models' })).toHaveTextContent('Ready');
    });

    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.type(screen.getByLabelText('Create image prompt'), 'neon cover');

    expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Create image prompt')).toHaveValue('neon cover');
  });

  it('prepares Gemma automatically when selected as the LLM model', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const promptService = new PromptProviderSelectionService('downloadable');
    services.promptService = promptService;
    services.modelSetupService = new PromptModelSetupService(() => promptService.markGemmaNeedsDownload());
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.selectOptions(screen.getAllByLabelText('LLM Model')[1]!, 'gemma-4-webgpu');

    await waitFor(() => {
      expect(promptService.preparePromptApi).toHaveBeenCalled();
    });
    const llmCard = screen.getByRole('article', { name: 'LLM Model' });
    expect(within(llmCard).getByText('Ready')).toBeInTheDocument();
  });

  it('keeps Gemma selected after removing its cached model', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const promptService = new PromptProviderSelectionService('downloadable');
    services.promptService = promptService;
    services.modelSetupService = new PromptModelSetupService(() => promptService.markGemmaNeedsDownload());
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.selectOptions(screen.getAllByLabelText('LLM Model')[1]!, 'gemma-4-webgpu');
    await waitFor(() => {
      expect(promptService.preparePromptApi).toHaveBeenCalled();
    });
    await user.click(screen.getByRole('button', { name: 'Remove LLM Model' }));

    expect(screen.getAllByLabelText('LLM Model')[1]).toHaveValue('gemma-4-webgpu');
    expect(screen.getByRole('button', { name: 'Download LLM Model' })).toBeInTheDocument();
  });

  it('prepares TranslateGemma automatically when selected as the translation model', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translatorService = new TranslationProviderSelectionService();
    services.translatorService = translatorService;
    services.modelSetupService = new TranslationModelSetupService(() =>
      translatorService.markTranslateGemmaNeedsDownload(),
    );
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.selectOptions(screen.getByLabelText('Translation Model'), 'translategemma-webgpu');

    await waitFor(() => {
      expect(translatorService.prepareTranslation).toHaveBeenCalled();
    });
    const translationCard = screen.getByRole('article', { name: 'Translate Design' });
    expect(within(translationCard).getByRole('button', { name: 'Remove Translation Model' })).toBeInTheDocument();
  });

  it('keeps TranslateGemma selected after removing its cached model', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translatorService = new TranslationProviderSelectionService();
    services.translatorService = translatorService;
    services.modelSetupService = new TranslationModelSetupService(() =>
      translatorService.markTranslateGemmaNeedsDownload(),
    );
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.selectOptions(screen.getByLabelText('Translation Model'), 'translategemma-webgpu');
    await waitFor(() => {
      expect(translatorService.prepareTranslation).toHaveBeenCalled();
    });
    await user.click(screen.getByRole('button', { name: 'Remove Translation Model' }));

    expect(screen.getByLabelText('Translation Model')).toHaveValue('translategemma-webgpu');
    expect(screen.getByRole('button', { name: 'Download Translation Model' })).toBeInTheDocument();
  });

  it('generates an image from create image mode and inserts it into the active slide', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    services.imageGenerationService = new inMemoryAiServices.MockImageGenerationService();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Image Generation Models' }));
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.type(screen.getByLabelText('Create image prompt'), 'A neon bonsai browser');
    await user.click(screen.getByRole('button', { name: 'Submit prompt' }));

    expect(await screen.findByText('A neon bonsai browser.png')).toBeInTheDocument();
    expect(screen.getByLabelText('Create image prompt')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled();
  });

  it('passes selected create image options to the generator', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const generateImage = vi.fn((_prompt: string, options?: ImageGenerationOptions): Promise<Asset> => {
      options?.onProgress?.({ label: 'Generating image 1/4', progress: 25 });
      return Promise.resolve({
        id: 'asset-generated-wide',
        type: 'image',
        name: 'wide.png',
        mimeType: 'image/png',
        objectUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lMFeWAAAAABJRU5ErkJggg==',
      });
    });
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    services.imageGenerationService = { generateImage };
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Image Generation Models' }));
    await user.click(screen.getByRole('button', { name: '16:9' }));
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.type(screen.getByLabelText('Create image prompt'), 'A wide generated image');
    await user.click(screen.getByRole('button', { name: 'Submit prompt' }));

    await waitFor(() => {
      expect(generateImage).toHaveBeenCalledWith(
        'A wide generated image',
        expect.objectContaining({
          height: 432,
          steps: 4,
          width: 768,
        }),
      );
    });
  });

  it('replaces the selected image using the selected image frame as generation size', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const generateImage = vi.fn((_prompt: string, options?: ImageGenerationOptions): Promise<Asset> => {
      options?.onProgress?.({ label: 'Generating replacement 1/4', progress: 25 });
      return Promise.resolve({
        id: 'asset-generated-replacement',
        type: 'image',
        name: 'replacement.png',
        mimeType: 'image/png',
        objectUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lMFeWAAAAABJRU5ErkJggg==',
      });
    });
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    services.imageGenerationService = { generateImage };
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Image Generation Models' }));
    await user.click(screen.getByRole('button', { name: '16:9' }));
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.click(screen.getByRole('button', { name: 'Selected Image' }));
    await user.type(screen.getByLabelText('Create image prompt'), 'Replace with a neon studio');
    await user.click(screen.getByRole('button', { name: 'Submit prompt' }));

    await waitFor(() => {
      expect(generateImage).toHaveBeenCalledWith(
        'Replace with a neon studio',
        expect.objectContaining({
          height: 736,
          width: 976,
        }),
      );
    });
    expect(screen.getByRole('button', { name: 'Selected Image' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled();
  });

  it('shows a stop action instead of allowing duplicate create image submissions', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const imageGenerationService = new SlowImageGenerationService();
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    services.imageGenerationService = imageGenerationService;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Image Generation Models' }));
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.type(screen.getByLabelText('Create image prompt'), 'A slow generated image');
    await user.click(screen.getByRole('button', { name: 'Submit prompt' }));
    expect(screen.getByLabelText('Create image prompt')).toHaveValue('A slow generated image');

    expect(screen.getByLabelText('Create image prompt')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Stop generation' })).toBeInTheDocument();
    expect(await screen.findByText('Generating image 1/4 25%')).toBeInTheDocument();
    await waitFor(() => {
      expect(imageGenerationService.generateImage).toHaveBeenCalledTimes(1);
    });
  });

  it('disables the prompt input while generating and stops late image results', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const imageGenerationService = new DeferredImageGenerationService();
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    services.imageGenerationService = imageGenerationService;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Image Generation Models' }));
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.type(screen.getByLabelText('Create image prompt'), 'A slow generated image');
    await user.click(screen.getByRole('button', { name: 'Submit prompt' }));

    expect(screen.getByLabelText('Create image prompt')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Stop generation' }));
    expect(screen.getByLabelText('Create image prompt')).not.toBeDisabled();

    imageGenerationService.resolve({
      id: 'asset-cancelled-generated',
      type: 'image',
      name: 'cancelled.png',
      mimeType: 'image/png',
      objectUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lMFeWAAAAABJRU5ErkJggg==',
    });

    await waitFor(() => {
      expect(screen.queryByText('cancelled.png')).not.toBeInTheDocument();
    });
  });

  it('shows ready LLM configuration without a prepare action when available on startup', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.promptService = new TestPromptService('ready');
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Prepare LLM Model' })).not.toBeInTheDocument();
    });
    expect(screen.getAllByRole('article')[0]).toHaveAccessibleName('LLM Model');
    expect(screen.getByText('Choose the local model used for prompt-to-slides.')).toBeInTheDocument();
    expect(screen.getAllByText('Ready').length).toBeGreaterThanOrEqual(1);
  });

  it('generates a slide progressively from the default prompt bar mode', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const promptService = new TestPromptService('ready');
    services.promptService = promptService;
    render(<EditorShell services={services} />);

    await user.type(screen.getByLabelText('Create image prompt'), 'switch mode');
    await user.clear(screen.getByLabelText('Create image prompt'));
    await user.click(
      screen.getByRole('button', {
        name: bulletsSlideExample,
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Submit prompt' }));

    await waitFor(() => {
      expect(promptService.generateSlideTasksFromPrompt).toHaveBeenCalledWith(
        bulletsSlideExample,
        expect.any(Object),
      );
      expect(promptService.generateSlideElementFromTask).toHaveBeenCalled();
    });
    expect(screen.getByRole('textbox', { name: 'Slide structure prompt' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Undo' })).not.toBeDisabled();
  });

  it('shows a tooltip when image generation is requested outside Create image mode', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const promptService = new TestPromptService('ready');
    services.promptService = promptService;
    render(<EditorShell services={services} />);

    await user.type(screen.getByLabelText('Create image prompt'), 'switch mode');
    await user.clear(screen.getByLabelText('Create image prompt'));
    await user.type(screen.getByRole('textbox', { name: 'Slide structure prompt' }), 'generate an image of a frozen tree');
    await user.click(screen.getByRole('button', { name: 'Submit prompt' }));

    expect(promptService.generateSlideTasksFromPrompt).not.toHaveBeenCalled();
    expect(screen.getByText('Use Create image from the + menu to generate images.')).toBeInTheDocument();
  });

  it('configures the default translation target from AI Tools', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new PreparingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.selectOptions(screen.getByLabelText('Translate to'), 'es');

    expect(screen.getByLabelText('Translate to')).toHaveValue('es');
    expect(translator.prepareTranslation).toHaveBeenCalledWith('en', 'es', expect.any(Object));
    expect((await screen.findAllByText('Ready')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Translation language preparation').querySelector('.model-progress')).toBeNull();
    expect(screen.getByText('Pair: en → es')).toBeInTheDocument();
    expect(window.localStorage.getItem('localstudio.ai.translation-target-language')).toBe('es');
    expect(
      screen.getByText('Choose the language that will be used for all translations in this deck.'),
    ).toBeInTheDocument();
  });

  it('prepares an uncached translation model when selected from the dropdown', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new ConfigurableTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.selectOptions(screen.getByLabelText('Translation Model'), 'translategemma-webgpu');

    await waitFor(() => {
      expect(translator.prepareTranslation).toHaveBeenCalledWith('en', 'en', expect.any(Object));
    });
    expect(screen.getByLabelText('Translation Model')).toHaveValue('translategemma-webgpu');
    await waitFor(() => {
      expect(screen.getByLabelText('Translation model preparation')).toHaveTextContent('Ready');
    });
  });

  it('does not reprepare a cached external translation model when the target language changes', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new ConfigurableTranslatorService({ translateGemmaReady: true });
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.selectOptions(screen.getByLabelText('Translation Model'), 'translategemma-webgpu');
    await waitFor(() => {
      expect(screen.getByLabelText('Translation Model')).toHaveValue('translategemma-webgpu');
    });
    translator.prepareTranslation.mockClear();

    await user.selectOptions(screen.getByLabelText('Translate to'), 'es');

    expect(screen.getByLabelText('Translate to')).toHaveValue('es');
    expect(translator.prepareTranslation).not.toHaveBeenCalled();
    expect(await screen.findByText('Pair: en → es')).toBeInTheDocument();
  });

  it('prepares an uncached LLM model when selected from the dropdown', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const promptService = new ConfigurablePromptService();
    services.promptService = promptService;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'LLM Model' }), 'gemma-4-webgpu');

    await waitFor(() => {
      expect(promptService.preparePromptApi).toHaveBeenCalledWith(expect.any(Object));
    });
    expect(screen.getByRole('combobox', { name: 'LLM Model' })).toHaveValue('gemma-4-webgpu');
    expect(screen.getByLabelText('LLM preparation')).toHaveTextContent('Ready');
  });

  it('lists Chrome-supported translation target languages', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));

    const options = within(screen.getByLabelText('Translate to')).getAllByRole<HTMLOptionElement>('option');
    expect(options).toHaveLength(40);
    expect(options.map((option) => option.value)).toEqual([
      '',
      'ar',
      'bn',
      'bg',
      'zh',
      'zh-Hant',
      'hr',
      'cs',
      'da',
      'nl',
      'en',
      'fi',
      'fr',
      'de',
      'el',
      'iw',
      'hi',
      'hu',
      'id',
      'it',
      'ja',
      'kn',
      'ko',
      'lt',
      'mr',
      'no',
      'pl',
      'pt',
      'ro',
      'ru',
      'sk',
      'sl',
      'es',
      'sv',
      'ta',
      'te',
      'th',
      'tr',
      'uk',
      'vi',
    ]);
    expect(screen.getByRole('option', { name: 'Hebrew (iw) 🇮🇱' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Chinese (Traditional) (zh-Hant) 🇹🇼' })).toBeInTheDocument();
  });
});
