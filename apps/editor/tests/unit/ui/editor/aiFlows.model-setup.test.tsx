import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { modelSetupService } from '../../../../src/services/model-setup/modelSetupService';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { aiFlowTestFixtures } from './aiFlows.fixtures';

const {
  ConfigurablePromptService,
  ConfigurableTranslatorService,
  LanguageDetectionModelSetupService,
  LanguageDetectionProviderSelectionService,
  PreparingTranslatorService,
  PromptModelSetupService,
  PromptProviderSelectionService,
  TestPromptService,
  TranslationModelSetupService,
  TranslationProviderSelectionService,
  createAppServices,
} = aiFlowTestFixtures;

describe('mocked AI model setup flows', () => {
  it('downloads required models from AI Tools panel', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    expect(screen.queryByRole('button', { name: 'Download Required Models' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download Image Editing Models' }));

    const editingModelsCard = await screen.findByRole('article', { name: 'Image Editing Models' });
    const generationModelsCard = screen.getByRole('article', { name: 'Image Generation Models' });
    expect(screen.getAllByText('Ready').length).toBeGreaterThanOrEqual(1);
    expect(within(editingModelsCard).getByText('Image Editing Models')).toBeInTheDocument();
    expect(within(generationModelsCard).getByText('Image Generation Models')).toBeInTheDocument();
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

  it('keeps the WebGPU language detector selected after removing its cached model', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translatorService = new LanguageDetectionProviderSelectionService();
    services.translatorService = translatorService;
    services.modelSetupService = new LanguageDetectionModelSetupService(() =>
      translatorService.markLanguageDetectionNeedsDownload(),
    );
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('tab', { name: 'AI Tools' }));
    await user.selectOptions(screen.getByLabelText('Language Detection Model'), 'language-detection-webgpu');
    await waitFor(() => {
      expect(translatorService.prepareLanguageDetection).toHaveBeenCalled();
    });
    await user.click(screen.getByRole('button', { name: 'Remove Language Detection Model' }));

    expect(screen.getByLabelText('Language Detection Model')).toHaveValue('language-detection-webgpu');
    expect(screen.getByRole('button', { name: 'Download Language Detection Model' })).toBeInTheDocument();
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
