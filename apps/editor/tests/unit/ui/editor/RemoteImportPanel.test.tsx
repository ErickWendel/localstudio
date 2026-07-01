import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { RemoteImportPanel } from '../../../../src/ui/editor/panels/RemoteImportPanel';

describe('RemoteImportPanel', () => {
  it('shows mirrored projects as selectable rows and imports the chosen project', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onImportProject = vi.fn();

    render(
      <RemoteImportPanel
        projects={[
          { id: 'project-alpha', name: 'Alpha Deck', syncedAt: '2026-06-30T12:00:00.000Z' },
          { id: 'project-beta', name: 'Beta Deck', syncedAt: '2026-06-30T13:00:00.000Z' },
        ]}
        status="ready"
        onClose={onClose}
        onImportProject={onImportProject}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Import remote project' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Import Beta Deck/ }));

    expect(onImportProject).toHaveBeenCalledWith('project-beta');
  });
});
