import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAppServices } from '../../../../src/app/composition';
import type { PromptApiAvailability, PromptService, TranslatorService } from '../../../../src/services/interfaces';
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

    expect(await screen.findAllByText('Ready')).toHaveLength(1);
    expect(screen.getByText('Image Editing Models')).toBeInTheDocument();
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

  it('redirects create image prompt typing to AI Tools when Prompt API is not ready', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.promptService = new TestPromptService('unavailable');
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Prompt actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Create image' }));
    await user.type(screen.getByLabelText('Create image prompt'), 'cyberpunk course cover');

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'AI Tools' })).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.getByRole('article', { name: 'Prompt API' })).toHaveClass('tool-card-attention');
    expect(screen.getByText('Prompt API must be prepared before using prompt-to-slides.')).toBeInTheDocument();
  });

  it('prepares Prompt API from AI Tools before allowing create image prompts', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const promptService = new TestPromptService('downloadable');
    services.promptService = promptService;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.click(screen.getByRole('button', { name: 'Prepare Prompt API' }));

    await waitFor(() => {
      expect(promptService.preparePromptApi).toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'Prepare Prompt API' })).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('Ready').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('100%').length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole('tab', { name: 'Layout' }));
    await user.click(screen.getByRole('button', { name: 'Prompt actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Create image' }));
    await user.type(screen.getByLabelText('Create image prompt'), 'neon cover');

    expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Create image prompt')).toHaveValue('neon cover');
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
