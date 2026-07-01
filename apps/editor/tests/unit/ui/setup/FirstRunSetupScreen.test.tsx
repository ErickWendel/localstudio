import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { LocalSetupState } from '../../../../src/services/contracts/interfaces';
import { FirstRunSetupScreen } from '../../../../src/ui/setup/FirstRunSetupScreen';

const readyState: LocalSetupState = {
  fileSystem: { label: 'Project Files', status: 'ready', detail: 'Ready' },
  chromeTranslation: { label: 'Local AI Providers', status: 'ready', detail: 'Ready' },
};

describe('FirstRunSetupScreen', () => {
  it('enables continuing only when required capabilities are ready', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();

    render(<FirstRunSetupScreen setupState={readyState} onRefresh={vi.fn()} onContinue={onContinue} />);

    expect(screen.getByText('LocalStudio.dev runs locally in this browser.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue to editor' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('disables continue when a required capability is not ready', () => {
    render(
      <FirstRunSetupScreen
        setupState={{
          ...readyState,
          chromeTranslation: {
            label: 'Local AI Providers',
            status: 'needs-setup',
            detail: 'Choose a compatible local AI provider.',
          },
        }}
        onRefresh={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Continue to editor' })).toBeDisabled();
    expect(screen.getByText('Choose a compatible local AI provider.')).toBeInTheDocument();
  });

  it('checks capabilities again on request', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();

    render(<FirstRunSetupScreen setupState={readyState} onRefresh={onRefresh} onContinue={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Check again' }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
