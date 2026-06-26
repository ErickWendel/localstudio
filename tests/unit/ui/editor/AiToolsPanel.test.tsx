import { render, screen, within } from '@testing-library/react';
import type { AiProviderState } from '../../../../src/services/interfaces';
import { AiToolsPanel } from '../../../../src/ui/editor/AiToolsPanel';

const gemmaProvider: AiProviderState = {
  id: 'gemma-4-webgpu',
  label: 'Gemma 4 WebGPU',
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
  label: 'TranslateGemma WebGPU',
  description: 'Browser-local WebGPU translation model.',
  capability: 'translation',
  runtime: 'webgpu-huggingface',
  compatibility: 'compatible',
  modelId: 'translategemma-webgpu',
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
    expect(within(translationCard).getByText('Pending')).toBeInTheDocument();
    expect(within(translationCard).getByRole('button', { name: 'Download Translation Model' })).toBeInTheDocument();
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
});
