import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { imagePromptOptions } from '../../../../src/ui/editor/media/imagePromptOptions';
import { PromptBar } from '../../../../src/ui/editor/prompting/PromptBar';

describe('PromptBar', () => {
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
});
