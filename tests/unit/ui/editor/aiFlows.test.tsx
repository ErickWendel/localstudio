import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAppServices } from '../../../../src/app/composition';
import type {
  GeneratedSlideElement,
  GeneratedSlideTask,
  GeneratedSlideTasksDocument,
} from '../../../../src/domain/generatedSlide';
import type { Asset } from '../../../../src/domain/model';
import type {
  ImageGenerationService,
  ImageGenerationOptions,
  PromptApiAvailability,
  PromptService,
  TranslatorService,
} from '../../../../src/services/interfaces';
import { MockImageGenerationService } from '../../../../src/services/inMemoryAiServices';
import { InMemoryModelSetupService } from '../../../../src/services/modelSetupService';
import { EditorShell } from '../../../../src/ui/editor/EditorShell';

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

class TestPromptService implements PromptService {
  constructor(private availability: PromptApiAvailability = 'unavailable') {}

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

describe('mocked AI flows', () => {
  it('downloads required models from AI Tools panel', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.modelSetupService = new InMemoryModelSetupService();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    expect(screen.queryByRole('button', { name: 'Download Required Models' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download Image Editing Models' }));

    expect(await screen.findByText('Image Editing Models')).toBeInTheDocument();
    expect(screen.getAllByText('Ready').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Image Editing Models')).toBeInTheDocument();
    expect(screen.getByText('Image Generation Models')).toBeInTheDocument();
  });

  it('exposes selected-object AI shortcuts', () => {
    render(<EditorShell services={createAppServices()} />);

    expect(screen.getByLabelText('Remove Background')).toBeInTheDocument();
    expect(screen.getByLabelText('Translate Selected Text')).toBeInTheDocument();
  });

  it('selects create image mode from the prompt plus menu', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    expect(screen.queryByText('Create image')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'A slide with the title Why Web AI Matters and a subtitle about private AI running in the browser',
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Prompt actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Create image' }));

    expect(screen.getByText('Create image')).toBeInTheDocument();
    expect(screen.getByLabelText('Create image prompt')).toHaveFocus();
    expect(
      screen.getByRole('button', {
        name: 'An icy Bonsai tree, in a rainy forest with snowy mountains in the background, photo realistic',
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
        name: 'A slide with a placeholder image on the left, the title Local AI Is Faster in the middle, and subtext below',
      }),
    );

    expect(screen.getByRole('textbox', { name: 'Slide structure prompt' })).toHaveValue(
      'A slide with a placeholder image on the left, the title Local AI Is Faster in the middle, and subtext below',
    );

    await user.click(screen.getByRole('button', { name: 'Prompt actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Create image' }));
    await user.click(
      screen.getByRole('button', {
        name: 'An icy Bonsai tree, in a rainy forest with snowy mountains in the background, photo realistic',
      }),
    );

    expect(screen.getByLabelText('Create image prompt')).toHaveValue(
      'An icy Bonsai tree, in a rainy forest with snowy mountains in the background, photo realistic',
    );
  });

  it('clears create image mode when the prompt text is deleted', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.promptService = new TestPromptService('ready');
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Prompt actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Create image' }));
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

  it('redirects create image prompt typing to AI Tools when image generation models are not ready', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.modelSetupService = new InMemoryModelSetupService();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Prompt actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Create image' }));
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
    services.modelSetupService = new InMemoryModelSetupService();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Image Generation Models' }));

    await waitFor(() => {
      expect(screen.getByRole('article', { name: 'Image Generation Models' })).toHaveTextContent('Ready');
    });

    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.click(screen.getByRole('button', { name: 'Prompt actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Create image' }));
    await user.type(screen.getByLabelText('Create image prompt'), 'neon cover');

    expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Create image prompt')).toHaveValue('neon cover');
  });

  it('generates an image from create image mode and inserts it into the active slide', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.modelSetupService = new InMemoryModelSetupService();
    services.imageGenerationService = new MockImageGenerationService();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Image Generation Models' }));
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.click(screen.getByRole('button', { name: 'Prompt actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Create image' }));
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
    services.modelSetupService = new InMemoryModelSetupService();
    services.imageGenerationService = { generateImage };
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Image Generation Models' }));
    await user.click(screen.getByRole('button', { name: '16:9' }));
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.click(screen.getByRole('button', { name: 'Prompt actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Create image' }));
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

  it('blocks duplicate create image submissions while generation is running', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const imageGenerationService = new SlowImageGenerationService();
    services.modelSetupService = new InMemoryModelSetupService();
    services.imageGenerationService = imageGenerationService;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Download Image Generation Models' }));
    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.click(screen.getByRole('button', { name: 'Prompt actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Create image' }));
    await user.type(screen.getByLabelText('Create image prompt'), 'A slow generated image');
    await user.click(screen.getByRole('button', { name: 'Submit prompt' }));
    expect(screen.getByLabelText('Create image prompt')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Generating image' }));

    expect(await screen.findByText('Generating image 1/4 25%')).toBeInTheDocument();
    await waitFor(() => {
      expect(imageGenerationService.generateImage).toHaveBeenCalledTimes(1);
    });
  });

  it('shows ready Prompt API first without a prepare action when available on startup', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.promptService = new TestPromptService('ready');
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Prepare Prompt API' })).not.toBeInTheDocument();
    });
    expect(screen.getAllByRole('article')[0]).toHaveAccessibleName('Prompt API');
    expect(screen.getByText('Prompt to slides using Chrome Built-in AI.')).toBeInTheDocument();
    expect(screen.getAllByText('Ready').length).toBeGreaterThanOrEqual(1);
  });

  it('generates a slide progressively from the default prompt bar mode', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const promptService = new TestPromptService('ready');
    services.promptService = promptService;
    render(<EditorShell services={services} />);

    await user.click(
      screen.getByRole('button', {
        name: 'A slide with the title Why Web AI Matters and a subtitle about private AI running in the browser',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Submit prompt' }));

    await waitFor(() => {
      expect(promptService.generateSlideTasksFromPrompt).toHaveBeenCalledWith(
        'A slide with the title Why Web AI Matters and a subtitle about private AI running in the browser',
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
    expect(await screen.findByText('Ready')).toBeInTheDocument();
    expect(screen.getAllByText('100%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Pair: en → es')).toBeInTheDocument();
    expect(window.localStorage.getItem('localstudio.ai.translation-target-language')).toBe('es');
    expect(
      screen.getByText('Choose the language that will be used for all translations in this deck.'),
    ).toBeInTheDocument();
  });

  it('lists Chrome-supported translation target languages', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));

    const options = screen.getAllByRole<HTMLOptionElement>('option');
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
