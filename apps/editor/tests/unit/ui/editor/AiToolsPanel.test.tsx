import { render, screen, within } from '@testing-library/react';
import { aiModelCatalog } from '../../../../src/services/model-setup/aiModelCatalog';
import type { AiProviderState } from '../../../../src/services/interfaces';
import { AiToolsPanel } from '../../../../src/ui/editor/AiToolsPanel';

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
    expect(within(translationCard).getByRole('button', { name: 'Download Translation Model' })).toBeInTheDocument();
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
    expect(within(translationCard).getByLabelText('Translation model preparation')).toHaveTextContent('Downloading');
    expect(within(translationCard).getByText('64%')).toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: 'Download Translation Model' })).not.toBeInTheDocument();
  });

  it('shows finalizing copy instead of a stuck high percentage during model preparation', () => {
    render(
      <AiToolsPanel
        modelStates={[]}
        promptProviderStates={[gemmaProvider]}
        promptPreparation={{ availability: 'downloading', progress: 99, status: 'downloading' }}
      />,
    );

    const llmCard = screen.getByRole('article', { name: 'LLM Model' });

    expect(within(llmCard).getByText('Finalizing...')).toBeInTheDocument();
    expect(within(llmCard).queryByText('99%')).not.toBeInTheDocument();
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
    expect(within(detectionCard).getByRole('button', { name: 'Download Language Detection Model' })).toBeInTheDocument();
  });
});
