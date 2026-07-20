import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { aiModelCatalog } from '../../../../src/services/model-setup/aiModelCatalog';
import type { AiProviderState, ModelState } from '../../../../src/services/contracts/interfaces';
import { AiToolsPanel } from '../../../../src/ui/editor/panels/AiToolsPanel';

const gemmaProvider: AiProviderState = {
  id: 'gemma-4-webgpu',
  label: aiModelCatalog.GEMMA_LLM_DISPLAY_NAME,
  description: 'Browser-local Gemma LLM for prompt-to-slides.',
  capability: 'prompt',
  runtime: 'webgpu-huggingface',
  compatibility: 'compatible',
  modelId: 'gemma-4-webgpu-llm',
  readiness: 'needs-download',
  selected: true,
};

const translateGemmaProvider: AiProviderState = {
  id: 'translategemma-webgpu',
  label: aiModelCatalog.TRANSLATEGEMMA_DISPLAY_NAME,
  description: 'Browser-local WebGPU translation model.',
  capability: 'translation',
  runtime: 'webgpu-huggingface',
  compatibility: 'compatible',
  modelId: 'translategemma-webgpu',
  readiness: 'needs-download',
  selected: true,
};

const languageDetectionProvider: AiProviderState = {
  id: 'language-detection-webgpu',
  label: aiModelCatalog.LANGUAGE_DETECTION_DISPLAY_NAME,
  description: 'Browser-local XLM-RoBERTa language detection fallback.',
  capability: 'language-detection',
  runtime: 'webgpu-huggingface',
  compatibility: 'compatible',
  modelId: 'language-detection-webgpu',
  readiness: 'needs-download',
  selected: true,
};

describe('AiToolsPanel', () => {
  it('starts visible model row progress when the setup action downloads all features', async () => {
    const user = userEvent.setup();
    let resolveDownload: (() => void) | undefined;
    const imageGenerationState: ModelState = {
      id: 'image-generation-models',
      label: 'Image Generation Models',
      description: 'Text-to-image model for generated slide assets.',
      progress: 0,
      provider: 'transformers',
      required: false,
      status: 'needs-download',
    };

    function PanelHarness() {
      const [modelState, setModelState] = useState(imageGenerationState);

      return (
        <AiToolsPanel
          modelStates={[modelState]}
          onDownloadModel={() =>
            new Promise<void>((resolve) => {
              setModelState({ ...imageGenerationState, progress: 42, status: 'downloading' });
              resolveDownload = () => {
                setModelState({ ...imageGenerationState, progress: 100, status: 'ready' });
                resolve();
              };
            })
          }
        />
      );
    }

    render(<PanelHarness />);

    await user.click(screen.getByRole('button', { name: 'Download all' }));

    const imageGenerationCard = screen.getByRole('article', { name: 'Image Generation Models' });
    const progressBar = within(imageGenerationCard).getByLabelText('Image Generation Models progress');
    expect(progressBar.querySelector('span')).toHaveStyle({ width: '42%' });
    expect(within(imageGenerationCard).getByText('42%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Downloading...' })).toBeDisabled();
    expect(screen.getByLabelText('Image Generation Models download progress')).toHaveAttribute(
      'aria-valuenow',
      '42',
    );

    resolveDownload?.();

    await waitFor(() => {
      expect(within(imageGenerationCard).getByText('Ready')).toBeInTheDocument();
    });
  });

  it('downloads all pending AI features from one setup action', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const onPreparePromptApi = vi.fn().mockImplementation(() => {
      calls.push('prompt');
      return Promise.resolve();
    });
    const onPrepareLanguageDetectionProvider = vi.fn().mockImplementation(() => {
      calls.push('language-detection');
      return Promise.resolve();
    });
    const onPrepareTranslationProvider = vi.fn().mockImplementation(() => {
      calls.push('translation');
      return Promise.resolve();
    });
    const onDownloadModel = vi.fn().mockImplementation((modelId: string) => {
      calls.push(modelId);
      return Promise.resolve();
    });
    const imageGenerationState: ModelState = {
      id: 'image-generation-models',
      label: 'Image Generation Models',
      description: 'Text-to-image model for generated slide assets.',
      progress: 0,
      provider: 'transformers',
      required: false,
      status: 'needs-download',
    };
    render(
      <AiToolsPanel
        languageDetectionProviderStates={[languageDetectionProvider]}
        modelStates={[imageGenerationState]}
        promptProviderStates={[gemmaProvider]}
        translationProviderStates={[translateGemmaProvider]}
        onDownloadModel={onDownloadModel}
        onPrepareLanguageDetectionProvider={onPrepareLanguageDetectionProvider}
        onPreparePromptApi={onPreparePromptApi}
        onPrepareTranslationProvider={onPrepareTranslationProvider}
      />,
    );

    expect(screen.getByLabelText('AI feature setup')).toHaveTextContent(
      '4 features need setup before the AI workflows feel instant.',
    );

    await user.click(screen.getByRole('button', { name: 'Download all' }));

    expect(calls).toEqual([
      'prompt',
      'language-detection',
      'translation',
      'image-generation-models',
    ]);
    expect(onDownloadModel).toHaveBeenCalledWith('image-generation-models');
  });

  it('shows setup progress for each downloading AI feature', () => {
    const imageGenerationState: ModelState = {
      id: 'image-generation-models',
      label: 'Image Generation Models',
      description: 'Text-to-image model for generated slide assets.',
      progress: 72,
      provider: 'transformers',
      required: false,
      status: 'downloading',
    };

    render(
      <AiToolsPanel
        languageDetectionPreparation={{ progress: 41, status: 'downloading' }}
        languageDetectionProviderStates={[languageDetectionProvider]}
        modelStates={[imageGenerationState]}
        onDownloadModel={() => Promise.resolve()}
        onPrepareLanguageDetectionProvider={() => Promise.resolve()}
        onPreparePromptApi={() => Promise.resolve()}
        onPrepareTranslationProvider={() => Promise.resolve()}
        promptPreparation={{ availability: 'downloading', progress: 28, status: 'downloading' }}
        promptProviderStates={[gemmaProvider]}
        translationPreparation={{ progress: 64, status: 'downloading' }}
        translationProviderStates={[translateGemmaProvider]}
      />,
    );

    const setup = screen.getByLabelText('AI feature setup');

    expect(setup).toHaveTextContent('Downloading required AI features...');
    expect(within(setup).getByLabelText('Gemma 4 E2B download progress')).toHaveAttribute(
      'aria-valuenow',
      '28',
    );
    expect(
      within(setup).getByLabelText('XLM-RoBERTa Base 270M download progress'),
    ).toHaveAttribute('aria-valuenow', '41');
    expect(within(setup).getByLabelText('TranslateGemma 4B download progress')).toHaveAttribute(
      'aria-valuenow',
      '64',
    );
    expect(
      within(setup).getByLabelText('Image Generation Models download progress'),
    ).toHaveAttribute('aria-valuenow', '72');
    expect(within(setup).getByText('Downloading 28%')).toBeInTheDocument();
    expect(within(setup).getByText('Downloading 41%')).toBeInTheDocument();
    expect(within(setup).getByText('Downloading 64%')).toBeInTheDocument();
    expect(within(setup).getByText('Downloading 72%')).toBeInTheDocument();
  });

  it('hides the setup action when all downloadable AI features are ready', () => {
    render(
      <AiToolsPanel
        languageDetectionProviderStates={[{ ...languageDetectionProvider, readiness: 'ready' }]}
        modelStates={[
          {
            id: aiModelCatalog.GEMMA_LLM_MODEL_ID,
            label: aiModelCatalog.GEMMA_LLM_DISPLAY_NAME,
            progress: 100,
            provider: 'transformers',
            required: false,
            status: 'ready',
          },
          {
            id: aiModelCatalog.TRANSLATEGEMMA_MODEL_ID,
            label: aiModelCatalog.TRANSLATEGEMMA_DISPLAY_NAME,
            progress: 100,
            provider: 'transformers',
            required: false,
            status: 'ready',
          },
        ]}
        promptProviderStates={[{ ...gemmaProvider, readiness: 'ready' }]}
        translationProviderStates={[{ ...translateGemmaProvider, readiness: 'ready' }]}
      />,
    );

    expect(screen.queryByLabelText('AI feature setup')).not.toBeInTheDocument();
  });

  it('does not show ready for an uncached selected LLM model even if previous preparation was ready', () => {
    render(
      <AiToolsPanel
        modelStates={[]}
        promptProviderStates={[gemmaProvider]}
        promptPreparation={{ availability: 'ready', progress: 100, status: 'ready' }}
      />,
    );

    const llmCard = screen.getByRole('article', { name: 'LLM Model' });

    expect(within(llmCard).queryByText('Ready')).not.toBeInTheDocument();
    expect(within(llmCard).getByText('Pending')).toBeInTheDocument();
    expect(within(llmCard).getByRole('button', { name: 'Download LLM Model' })).toBeInTheDocument();
  });

  it('does not show ready for an uncached selected translation model even if previous preparation was ready', () => {
    render(
      <AiToolsPanel
        modelStates={[]}
        translationProviderStates={[translateGemmaProvider]}
        translationLanguageOptions={[{ code: 'pt', flag: '🇧🇷', label: 'Portuguese' }]}
        translationPreparation={{ progress: 100, status: 'ready' }}
        translationTargetLanguage="pt"
      />,
    );

    const translationCard = screen.getByRole('article', { name: 'Translate Design' });

    expect(within(translationCard).queryByText('Ready')).not.toBeInTheDocument();
    expect(within(translationCard).getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
    expect(within(translationCard).queryByText('100%')).not.toBeInTheDocument();
    expect(
      within(translationCard).getByRole('button', { name: 'Download Translation Model' }),
    ).toBeInTheDocument();
  });

  it('shows translation model download progress even before a target language is selected', () => {
    render(
      <AiToolsPanel
        modelStates={[]}
        translationProviderStates={[translateGemmaProvider]}
        translationLanguageOptions={[{ code: 'pt', flag: '🇧🇷', label: 'Portuguese' }]}
        translationPreparation={{ progress: 64, status: 'downloading' }}
      />,
    );

    const translationCard = screen.getByRole('article', { name: 'Translate Design' });

    expect(within(translationCard).getByLabelText('Translation Model')).toBeDisabled();
    expect(
      within(translationCard).getByLabelText('Translation model preparation'),
    ).toHaveTextContent('Downloading');
    expect(within(translationCard).getByText('64%')).toBeInTheDocument();
  });

  it('shows byte progress and remaining time for downloading provider models', () => {
    render(
      <AiToolsPanel
        modelStates={[]}
        translationProviderStates={[translateGemmaProvider]}
        translationLanguageOptions={[{ code: 'pt', flag: '🇧🇷', label: 'Portuguese' }]}
        translationPreparation={{
          estimatedRemainingMs: 180_000,
          loadedBytes: 1_200_000_000,
          progress: 64,
          status: 'downloading',
          totalBytes: 3_800_000_000,
        }}
      />,
    );

    const translationCard = screen.getByRole('article', { name: 'Translate Design' });

    expect(within(translationCard).getByText('1.2 GB / 3.8 GB (64%)')).toBeInTheDocument();
    expect(within(translationCard).getByText('About 3 min remaining')).toBeInTheDocument();
    expect(within(translationCard).queryByText(/elapsed/i)).not.toBeInTheDocument();
  });

  it('does not duplicate translation model download progress under the target language', () => {
    render(
      <AiToolsPanel
        activeSlideLanguage={{ code: 'pt', displayCode: 'PT', flag: '🇧🇷', label: 'Portuguese' }}
        modelStates={[]}
        translationProviderStates={[translateGemmaProvider]}
        translationLanguageOptions={[{ code: 'pt', flag: '🇧🇷', label: 'Portuguese' }]}
        translationPreparation={{
          estimatedRemainingMs: 180_000,
          loadedBytes: 1_200_000_000,
          progress: 64,
          status: 'downloading',
          totalBytes: 3_800_000_000,
        }}
        translationTargetLanguage="pt"
      />,
    );

    const translationCard = screen.getByRole('article', { name: 'Translate Design' });

    expect(within(translationCard).getAllByText('1.2 GB / 3.8 GB (64%)')).toHaveLength(1);
    expect(within(translationCard).getAllByText('About 3 min remaining')).toHaveLength(1);
    expect(within(translationCard).getByText('Pair: pt → pt')).toBeInTheDocument();
  });

  it('renders model-specific byte totals for each AI tools item', () => {
    const imageGenerationState: ModelState = {
      id: 'image-generation-models',
      label: 'Image Generation Models',
      description: 'Text-to-image model for generated slide assets.',
      estimatedRemainingMs: 75_000,
      loadedBytes: 1_200_000_000,
      progress: 64,
      provider: 'transformers',
      required: false,
      status: 'downloading',
      totalBytes: 3_800_000_000,
    };

    render(
      <AiToolsPanel
        languageDetectionProviderStates={[languageDetectionProvider]}
        languageDetectionPreparation={{
          estimatedRemainingMs: 20_000,
          loadedBytes: 40_000_000,
          progress: 40,
          status: 'downloading',
          totalBytes: 100_000_000,
        }}
        modelStates={[imageGenerationState]}
        promptProviderStates={[gemmaProvider]}
        promptPreparation={{
          availability: 'downloading',
          estimatedRemainingMs: 90_000,
          loadedBytes: 600_000_000,
          progress: 30,
          status: 'downloading',
          totalBytes: 2_000_000_000,
        }}
        translationProviderStates={[translateGemmaProvider]}
        translationLanguageOptions={[{ code: 'pt', flag: '🇧🇷', label: 'Portuguese' }]}
        translationPreparation={{
          estimatedRemainingMs: 180_000,
          loadedBytes: 1_200_000_000,
          progress: 64,
          status: 'downloading',
          totalBytes: 3_100_000_000,
        }}
      />,
    );

    expect(screen.getByText('0.6 GB / 2.0 GB (30%)')).toBeInTheDocument();
    expect(screen.getByText('0.0 GB / 0.1 GB (40%)')).toBeInTheDocument();
    expect(screen.getByText('1.2 GB / 3.1 GB (64%)')).toBeInTheDocument();
    expect(screen.getByText('1.2 GB / 3.8 GB (64%)')).toBeInTheDocument();
  });

  it('shows remove actions for cached external providers', () => {
    render(
      <AiToolsPanel
        modelStates={[]}
        promptProviderStates={[{ ...gemmaProvider, readiness: 'ready' }]}
        translationProviderStates={[{ ...translateGemmaProvider, readiness: 'ready' }]}
        translationLanguageOptions={[{ code: 'pt', flag: '🇧🇷', label: 'Portuguese' }]}
        translationPreparation={{ progress: 100, status: 'ready' }}
        translationTargetLanguage="pt"
      />,
    );

    expect(screen.getByRole('button', { name: 'Remove LLM Model' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Translation Model' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download LLM Model' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Download Translation Model' }),
    ).not.toBeInTheDocument();
  });

  it('shows finalizing copy instead of a stuck high percentage during model preparation', () => {
    render(
      <AiToolsPanel
        modelStates={[]}
        promptProviderStates={[gemmaProvider]}
        promptPreparation={{
          estimatedRemainingMs: 2_000,
          loadedBytes: 1_180_000_000,
          availability: 'downloading',
          progress: 99,
          status: 'downloading',
          totalBytes: 1_200_000_000,
        }}
      />,
    );

    const llmCard = screen.getByRole('article', { name: 'LLM Model' });

    expect(within(llmCard).getByText('Finalizing...')).toBeInTheDocument();
    expect(within(llmCard).getByText('1.2 GB / 1.2 GB (99%)')).toBeInTheDocument();
    expect(within(llmCard).queryByText(/remaining/i)).not.toBeInTheDocument();
  });

  it('shows byte progress and remaining time for fixed model rows', () => {
    const imageGenerationState: ModelState = {
      id: 'image-generation-models',
      label: 'Image Generation Models',
      description: 'Text-to-image model for generated slide assets.',
      estimatedRemainingMs: 75_000,
      loadedBytes: 1_200_000_000,
      progress: 64,
      provider: 'transformers',
      required: false,
      status: 'downloading',
      totalBytes: 3_800_000_000,
    };
    const imageEditingState: ModelState = {
      id: 'image-editing-models',
      label: 'Image Editing Models',
      description: 'Segmentation model for image editing.',
      estimatedRemainingMs: 40_000,
      loadedBytes: 120_000_000,
      progress: 64,
      provider: 'transformers',
      required: true,
      status: 'downloading',
      totalBytes: 190_000_000,
    };

    render(<AiToolsPanel modelStates={[imageGenerationState, imageEditingState]} />);

    const generationCard = screen.getByRole('article', { name: 'Image Generation Models' });
    const editingCard = screen.getByRole('article', { name: 'Image Editing Models' });

    expect(within(generationCard).getByText('1.2 GB / 3.8 GB (64%)')).toBeInTheDocument();
    expect(within(generationCard).getByText('About 2 min remaining')).toBeInTheDocument();
    expect(within(generationCard).queryByText(/elapsed/i)).not.toBeInTheDocument();
    expect(within(editingCard).getByText('0.1 GB / 0.2 GB (64%)')).toBeInTheDocument();
    expect(within(editingCard).getByText('Less than 1 min remaining')).toBeInTheDocument();
    expect(within(editingCard).queryByText(/elapsed/i)).not.toBeInTheDocument();
  });

  it('shows the same configurable model controls for language detection', () => {
    render(
      <AiToolsPanel
        modelStates={[]}
        languageDetectionProviderStates={[languageDetectionProvider]}
        languageDetectionPreparation={{ progress: 0, status: 'idle' }}
      />,
    );

    const detectionCard = screen.getByRole('article', { name: 'Language Detection' });

    expect(within(detectionCard).getByLabelText('Language Detection Model')).toHaveValue(
      'language-detection-webgpu',
    );
    expect(within(detectionCard).getByText('Pending')).toBeInTheDocument();
    expect(
      within(detectionCard).getByRole('button', { name: 'Download Language Detection Model' }),
    ).toBeInTheDocument();
  });
});
