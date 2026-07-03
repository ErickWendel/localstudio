import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { SettingsPanel } from '../../../../src/ui/editor/panels/SettingsPanel';

describe('SettingsPanel', () => {
  it('opens mirror settings from the settings list', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOpenMirrorSettings = vi.fn();
    const onOpenMediaSettings = vi.fn();

    render(
      <SettingsPanel
        onClose={onClose}
        onOpenMediaSettings={onOpenMediaSettings}
        onOpenMirrorSettings={onOpenMirrorSettings}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mirror settings' }));

    expect(onOpenMirrorSettings).toHaveBeenCalledTimes(1);
  });

  it('opens media integration settings from the settings list', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOpenMediaSettings = vi.fn();
    const onOpenMirrorSettings = vi.fn();

    render(
      <SettingsPanel
        onClose={onClose}
        onOpenMediaSettings={onOpenMediaSettings}
        onOpenMirrorSettings={onOpenMirrorSettings}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Media integrations' }));

    expect(onOpenMediaSettings).toHaveBeenCalledTimes(1);
  });
});
