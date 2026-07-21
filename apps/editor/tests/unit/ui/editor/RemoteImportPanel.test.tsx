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

  it('confirms before deleting a remote project and keeps row import separate', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onImportProject = vi.fn();
    const onDeleteProject = vi.fn();

    render(
      <RemoteImportPanel
        projects={[
          { id: 'project-alpha', name: 'Alpha Deck', syncedAt: '2026-06-30T12:00:00.000Z' },
        ]}
        status="ready"
        onClose={onClose}
        onDeleteProject={onDeleteProject}
        onImportProject={onImportProject}
      />,
    );

    const list = screen.getByRole('list', { name: 'Remote mirrored projects' });
    expect(list).toHaveClass('remote-import-list');

    await user.click(screen.getByRole('button', { name: 'Delete Alpha Deck from remote' }));

    expect(onImportProject).not.toHaveBeenCalled();
    const confirmation = screen.getByRole('alertdialog', { name: 'Delete remote project' });
    expect(confirmation).toBeInTheDocument();
    expect(confirmation.parentElement?.firstElementChild).toBe(confirmation);

    await user.click(screen.getByRole('button', { name: 'Delete remote project' }));

    expect(onDeleteProject).toHaveBeenCalledWith('project-alpha');
    expect(onImportProject).not.toHaveBeenCalled();
  });

  it('shows detailed progress while importing a selected remote project', () => {
    const onClose = vi.fn();
    const onImportProject = vi.fn();

    render(
      <RemoteImportPanel
        progress={{
          detail: 'Downloading the mirrored project manifest and files from remote storage.',
          progress: 36,
          stage: 'downloading',
          title: 'Downloading remote mirror',
        }}
        projects={[
          { id: 'project-alpha', name: 'Alpha Deck', syncedAt: '2026-06-30T12:00:00.000Z' },
        ]}
        status="importing"
        onClose={onClose}
        onImportProject={onImportProject}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Downloading remote mirror');
    expect(screen.getByRole('progressbar', { name: 'Remote import progress' })).toHaveAttribute(
      'aria-valuenow',
      '36',
    );
    expect(screen.getByRole('button', { name: 'Import Alpha Deck' })).toBeDisabled();
  });
});
