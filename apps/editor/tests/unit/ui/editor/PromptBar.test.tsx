import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { imageGenerationModel } from '../../../../src/services/image-generation/imageGenerationModel';
import { imagePromptOptions } from '../../../../src/ui/editor/media/imagePromptOptions';
import type { PromptModelControlOption } from '../../../../src/ui/editor/prompting/PromptModelControl';
import { PromptBar } from '../../../../src/ui/editor/prompting/PromptBar';

describe('PromptBar', () => {
  const promptOptions: PromptModelControlOption[] = [
    {
      compatibility: 'compatible',
      id: 'gemma-webgpu',
      label: 'Gemma WebGPU',
      modelId: 'gemma-4-webgpu-llm',
      readiness: 'needs-download',
      selected: true,
    },
    {
      compatibility: 'compatible',
      id: 'chrome-built-in',
      label: 'Chrome Prompt',
      readiness: 'ready',
      selected: false,
    },
  ];
  const imageGenerationOption: PromptModelControlOption = {
    compatibility: 'compatible',
    id: imageGenerationModel.IMAGE_GENERATION_MODEL_ID,
    label: imageGenerationModel.IMAGE_GENERATION_DISPLAY_NAME,
    modelId: imageGenerationModel.IMAGE_GENERATION_MODEL_ID,
    readiness: 'downloading',
    selected: true,
  };

  it('uses a multiline prompt field so long image prompts can wrap', () => {
    render(<PromptBar createImageOptions={imagePromptOptions.defaultCreateImagePromptOptions} />);

    const promptField = screen.getByLabelText('Create image prompt');

    expect(promptField.tagName).toBe('TEXTAREA');
    expect(promptField).not.toHaveStyle({ height: '0px' });
  });

  it('shows the stop action immediately while create image readiness is still checking', async () => {
    const user = userEvent.setup();
    let resolveReadiness: ((ready: boolean) => void) | undefined;
    const onCreateImagePromptIntent = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveReadiness = resolve;
        }),
    );
    const onCreateImageSubmit = vi.fn();

    render(
      <PromptBar
        createImageOptions={imagePromptOptions.defaultCreateImagePromptOptions}
        onCreateImagePromptIntent={onCreateImagePromptIntent}
        onCreateImageSubmit={onCreateImageSubmit}
      />,
    );

    const input = screen.getByLabelText('Create image prompt');
    await user.type(input, 'Create a local Web AI hero{Enter}');

    expect(input).toHaveValue('Create a local Web AI hero');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop generation' })).toBeInTheDocument();
    });
    expect(input).toBeDisabled();
    expect(screen.getByRole('form', { name: 'Slide structure prompt' })).toHaveClass('prompt-bar-processing');
    expect(onCreateImageSubmit).not.toHaveBeenCalled();

    resolveReadiness?.(true);
    await waitFor(() => {
      expect(onCreateImageSubmit).toHaveBeenCalledWith(
        'Create a local Web AI hero',
        imagePromptOptions.defaultCreateImagePromptOptions,
      );
    });
  });

  it('shows the selected prompt model and download action', async () => {
    const user = userEvent.setup();
    const onPreparePromptApi = vi.fn();
    const onPromptProviderChange = vi.fn();

    render(
      <PromptBar
        createImageOptions={imagePromptOptions.defaultCreateImagePromptOptions}
        slideModelControlState={{
          preparation: { availability: 'downloadable', progress: 0, status: 'idle' },
          options: promptOptions,
        }}
        onPreparePromptApi={onPreparePromptApi}
        onPromptProviderChange={onPromptProviderChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remove Create image mode' }));
    expect(screen.getByRole('combobox', { name: 'Prompt model' })).toHaveValue('gemma-webgpu');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Prompt model' }), 'chrome-built-in');
    expect(onPromptProviderChange).toHaveBeenCalledWith('chrome-built-in');

    await user.click(screen.getByRole('button', { name: 'Download Gemma WebGPU' }));
    expect(onPreparePromptApi).toHaveBeenCalledTimes(1);
  });

  it('shows prompt model download progress and cancel action while preparation runs', async () => {
    const user = userEvent.setup();
    const onCancelPromptModelDownload = vi.fn();

    render(
      <PromptBar
        createImageOptions={imagePromptOptions.defaultCreateImagePromptOptions}
        slideModelControlState={{
          preparation: {
            availability: 'downloading',
            estimatedRemainingMs: 61_000,
            progress: 48,
            status: 'downloading',
          },
          options: promptOptions,
        }}
        onCancelPromptModelDownload={onCancelPromptModelDownload}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remove Create image mode' }));
    expect(screen.getByRole('button', { name: 'Downloading Gemma WebGPU' })).toBeDisabled();
    expect(
      screen.getByRole('progressbar', { name: 'Gemma WebGPU download progress' }),
    ).toHaveAttribute('aria-valuenow', '48');
    expect(screen.getByText('48%')).toBeInTheDocument();
    expect(screen.getByText('About 2 min remaining')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel Gemma WebGPU download' }));
    expect(onCancelPromptModelDownload).toHaveBeenCalledWith('gemma-4-webgpu-llm');
  });

  it('uses the Bonsai image model control while create image mode is active', () => {
    render(
      <PromptBar
        createImageOptions={imagePromptOptions.defaultCreateImagePromptOptions}
        createImageModelControlState={{
          label: 'Image generation model',
          preparation: {
            availability: 'downloading',
            loadedBytes: 900_000_000,
            progress: 27,
            status: 'downloading',
            totalBytes: 3_600_000_000,
          },
          options: [imageGenerationOption],
        }}
        slideModelControlState={{
          preparation: { availability: 'downloadable', progress: 0, status: 'idle' },
          options: promptOptions,
        }}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Image generation model' })).toHaveValue(
      imageGenerationModel.IMAGE_GENERATION_MODEL_ID,
    );
    expect(
      screen.getByRole('progressbar', {
        name: `${imageGenerationModel.IMAGE_GENERATION_DISPLAY_NAME} download progress`,
      }),
    ).toHaveAttribute('aria-valuenow', '27');
    expect(screen.queryByRole('combobox', { name: 'Prompt model' })).not.toBeInTheDocument();
  });
});
