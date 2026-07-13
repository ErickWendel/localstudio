import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const {
  ConcurrentRecordingTranslatorService,
  RecordingTranslatorService,
  SavingProjectRepository,
  createAppServices,
  createDeferred,
  createMultiTextProject,
  createReadyPrepareTranslationMock,
  createThreeColumnCaptionProject,
  openLeftTab,
  selectTitleLayer,
} = editorShellTestHarness;

describe('EditorShell translation workflows', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/editor/');
    vi.restoreAllMocks();
  });

  it('translates selected text from the floating toolbar', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    await selectTitleLayer(user);
    await user.click(screen.getByRole('button', { name: 'Translate Selected Text' }));

    await waitFor(() => {
      expect(translator.translate).toHaveBeenCalledWith('AI Design Revolution', 'pt', {
        sourceLanguage: 'en',
      });
    });
  });

  it('updates the header language chip after translating the current slide', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    expect(
      await screen.findByRole('button', { name: 'Current slide language English' }),
    ).toBeInTheDocument();
    expect(translator.detectLanguage).toHaveBeenCalledWith(expect.any(String), {
      allowModelPreparation: false,
    });

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    expect(await screen.findByText('Pair: en → pt')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Translate Slide 1' })[0]!);

    expect(
      await screen.findByRole('button', { name: 'Current slide language Portuguese' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Pair: pt → pt')).toBeInTheDocument();
  });

  it('restores the toolbar source language after undoing a slide translation with Ctrl+Z', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    await user.click(screen.getAllByRole('button', { name: 'Translate Slide 1' })[0]!);

    expect(
      await screen.findByRole('button', { name: 'Current slide language Portuguese' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Translation path options' }));
    expect(screen.getByLabelText<HTMLSelectElement>('Translate from').value).toBe('pt');

    screen.getByRole('button', { name: 'Translate deck' }).focus();
    await user.keyboard('{Control>}z{/Control}');

    expect(
      await screen.findByRole('button', { name: 'Current slide language English' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText<HTMLSelectElement>('Translate from').value).toBe('en');
  });

  it('ignores repeated translate clicks while a translation is running', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translation = createDeferred<string>();
    const translate = vi.fn().mockReturnValue(translation.promise);
    services.translatorService = {
      detectLanguage: vi.fn().mockResolvedValue('en'),
      prepareTranslation: createReadyPrepareTranslationMock(),
      translate,
    };
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'es');
    await selectTitleLayer(user);
    await user.dblClick(screen.getByRole('button', { name: 'Translate Selected Text' }));

    expect(translate).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Translating text...')).toBeInTheDocument();

    translation.resolve('Texto traducido');
  });

  it('shows translation errors instead of leaving an unhandled promise', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.translatorService = {
      detectLanguage: vi.fn().mockResolvedValue('en'),
      prepareTranslation: createReadyPrepareTranslationMock(),
      translate: vi
        .fn()
        .mockRejectedValue(new Error('Chrome Built-in AI translation is not ready.')),
    };
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'es');
    await selectTitleLayer(user);
    await user.click(screen.getByRole('button', { name: 'Translate Selected Text' }));

    expect(
      await screen.findByText('Chrome Built-in AI translation is not ready.'),
    ).toBeInTheDocument();
  });

  it('fits translated selected text back into the original text frame', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    const translate = vi
      .fn()
      .mockResolvedValue('Revolucion\n de diseno impulsada por inteligencia artificial');
    services.projectRepository = repository;
    services.translatorService = {
      detectLanguage: vi.fn().mockResolvedValue('en'),
      prepareTranslation: createReadyPrepareTranslationMock(),
      translate,
    };
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'es');
    await selectTitleLayer(user);
    await user.click(screen.getByRole('button', { name: 'Translate Selected Text' }));

    await waitFor(() => {
      expect(translate).toHaveBeenCalledWith('AI Design Revolution', 'es', {
        sourceLanguage: 'en',
      });
    });
    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));

    await waitFor(() => {
      const title = repository.savedProjects.at(-1)?.elements['text-title'];
      expect(title).toMatchObject({
        fontSize: 96,
        text: 'Revolucion de diseno impulsada por inteligencia artificial',
        width: 600,
        x: 1160,
      });
      expect(title?.height).toBeGreaterThan(240);
    });
  });

  it('keeps translated slide captions anchored to their original columns', async () => {
    const user = userEvent.setup();
    const project = createThreeColumnCaptionProject();
    const repository = new SavingProjectRepository();
    const translations: Record<string, string> = {
      'Exploring the future of artificial intelligence':
        'Explorando o futuro da inteligencia artificial',
      'A look at the latest advancements and applications':
        'Veja os ultimos avancos e aplicacoes',
      'The impact of Web AI on society': 'O impacto da Web AI na sociedade',
    };
    const translate = vi.fn((text: string) => Promise.resolve(translations[text] ?? text));
    const services = createAppServices({ initialProject: project });
    services.projectRepository = repository;
    services.translatorService = {
      detectLanguage: vi.fn().mockResolvedValue('en'),
      prepareTranslation: createReadyPrepareTranslationMock(),
      translate,
    };
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    await user.click(screen.getByRole('button', { name: 'Translate Hero split' }));
    await waitFor(() => {
      expect(translate).toHaveBeenCalledTimes(3);
    });
    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));

    await waitFor(() => {
      const savedProject = repository.savedProjects.at(-1);
      expect(savedProject?.elements['caption-left']).toMatchObject({
        text: 'Explorando o futuro da inteligencia artificial',
        x: 120,
        width: 500,
      });
      expect(savedProject?.elements['caption-center']).toMatchObject({
        text: 'Veja os ultimos avancos e aplicacoes',
        x: 680,
        width: 500,
      });
      expect(savedProject?.elements['caption-right']).toMatchObject({
        text: 'O impacto da Web AI na sociedade',
        x: 1240,
        width: 500,
      });
      expect(savedProject?.elements['caption-left']?.height).toBeGreaterThanOrEqual(96);
    });
  });

  it('redirects the first translation attempt to AI Tools until a target language is selected', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await selectTitleLayer(user);
    await user.click(screen.getByRole('button', { name: 'Translate Selected Text' }));

    expect(screen.getByRole('tab', { name: 'AI Tools' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Translate to')).toHaveValue('');
    expect(translator.translate).not.toHaveBeenCalled();
  });

  it('translates every visible unlocked text element on the current slide', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    await user.click(screen.getAllByRole('button', { name: 'Translate Slide 1' })[0]!);

    await waitFor(() => {
      expect(translator.translate).toHaveBeenCalledWith('AI Design Revolution', 'pt', {
        sourceLanguage: 'en',
      });
      expect(translator.translate).toHaveBeenCalledWith(
        'Browser-native creative automation',
        'pt',
        {
          sourceLanguage: 'en',
        },
      );
    });
  });

  it('uses the prepared source language when translating back to another language', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translate = vi.fn().mockResolvedValue('AI Design Revolution');
    services.translatorService = {
      detectLanguage: vi.fn().mockResolvedValueOnce('es').mockResolvedValue('gl'),
      prepareTranslation: createReadyPrepareTranslationMock(),
      translate,
    };
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'en');
    await selectTitleLayer(user);
    await user.click(screen.getByRole('button', { name: 'Translate Selected Text' }));

    await waitFor(() => {
      expect(translate).toHaveBeenCalledWith('AI Design Revolution', 'en', {
        sourceLanguage: 'es',
      });
    });
  });

  it('translates the full deck from the Edit menu', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Current slide language English' }),
      ).toBeInTheDocument();
    });
    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('menuitem', { name: 'Translate Deck' }));

    await waitFor(() => {
      expect(translator.translate).toHaveBeenCalledWith('AI Design Revolution', 'pt', {
        sourceLanguage: 'en',
      });
      expect(translator.translate).toHaveBeenCalledWith(
        'Browser-native creative automation',
        'pt',
        {
          sourceLanguage: 'en',
        },
      );
    });
  });

  it('uses the active slide language as the full-deck translation source', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    translator.detectLanguage.mockResolvedValueOnce('en').mockResolvedValueOnce('cy');
    translator.prepareTranslation.mockRejectedValueOnce(
      new Error('Chrome Built-in AI translation is not ready for cy to pt.'),
    );
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Current slide language English' }),
      ).toBeInTheDocument();
    });
    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    await waitFor(() => {
      expect(translator.prepareTranslation).toHaveBeenCalled();
    });

    await user.click(screen.getByRole('button', { name: 'Translate deck' }));

    await waitFor(() => {
      expect(translator.prepareTranslation).toHaveBeenCalledWith('en', 'pt');
      expect(translator.translate).toHaveBeenCalledWith('AI Design Revolution', 'pt', {
        sourceLanguage: 'en',
      });
    });
  });

  it('translates the full deck with the toolbar-selected language path', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Current slide language English' }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Translation path options' }));
    await user.selectOptions(screen.getByLabelText('Translate from'), 'es');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'en');
    await user.click(screen.getByRole('button', { name: 'Translate deck' }));

    await waitFor(() => {
      expect(translator.prepareTranslation).toHaveBeenCalledWith('es', 'en');
      expect(translator.translate).toHaveBeenCalledWith('AI Design Revolution', 'en', {
        sourceLanguage: 'es',
      });
    });
  });

  it('translates the full deck from the toolbar icon with bounded concurrency', async () => {
    const user = userEvent.setup();
    const services = createAppServices({ initialProject: createMultiTextProject(8) });
    const translator = new ConcurrentRecordingTranslatorService();
    services.translatorService = translator;
    const { container } = render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    await waitFor(() => {
      expect(translator.prepareTranslation).toHaveBeenCalled();
    });
    const translateDeckButton = screen.getByRole('button', { name: 'Translate deck' });
    await waitFor(() => {
      expect(translateDeckButton).not.toBeDisabled();
    });
    await user.click(translateDeckButton);

    await waitFor(() => {
      expect(translator.translate).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(/^Translating Slide [1-3] · 0\/8$/)).toBeInTheDocument();
    });
    expect(translateDeckButton).toHaveClass('deck-translate-button-active');
    expect(container.querySelector('.scroll-page-translating')).toBeInTheDocument();

    translator.finishTranslations();
    await waitFor(() => {
      expect(translator.translate).toHaveBeenCalledTimes(8);
    });
    expect(translator.maxConcurrentTranslations).toBeLessThanOrEqual(3);
  });
});
