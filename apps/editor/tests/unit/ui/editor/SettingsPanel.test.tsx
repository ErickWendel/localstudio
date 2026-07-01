import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { SettingsPanel } from '../../../../src/ui/editor/panels/SettingsPanel';

describe('SettingsPanel', () => {
  it('opens mirror settings from the settings list', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOpenMirrorSettings = vi.fn();

    render(<SettingsPanel onClose={onClose} onOpenMirrorSettings={onOpenMirrorSettings} />);

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mirror settings' }));

    expect(onOpenMirrorSettings).toHaveBeenCalledTimes(1);
  });
});
