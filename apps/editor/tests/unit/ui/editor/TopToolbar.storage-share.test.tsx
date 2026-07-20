import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { TopToolbar } from '../../../../src/ui/editor/toolbars/TopToolbar';

describe('TopToolbar storage and sharing actions', () => {
  it('marks persistence as unavailable when the browser cannot save local folders', async () => {
    const user = userEvent.setup();
    const onPersistenceToggle = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        persistenceAvailable={false}
        onPersistenceToggle={onPersistenceToggle}
      />,
    );

    const persistenceButton = screen.getByRole('button', { name: 'Persistence unavailable' });
    expect(persistenceButton).toBeDisabled();
    expect(persistenceButton).toHaveAttribute(
      'title',
      'Local project persistence is not available in this browser.',
    );
    expect(persistenceButton).toHaveTextContent('×');

    await user.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.queryByRole('menuitem', { name: 'Save Local' })).not.toBeInTheDocument();
    expect(onPersistenceToggle).not.toHaveBeenCalled();
  });

  it('labels OPFS persistence as browser storage', async () => {
    const user = userEvent.setup();
    const onPersistenceToggle = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        persistenceMode="opfs"
        onPersistenceToggle={onPersistenceToggle}
      />,
    );

    const persistenceButton = screen.getByRole('button', { name: 'Browser storage disabled' });
    expect(persistenceButton).toHaveAttribute(
      'title',
      'Save this deck in browser-private storage. Files are scoped to this browser profile and are not visible in Finder.',
    );

    await user.click(persistenceButton);

    expect(onPersistenceToggle).toHaveBeenCalledWith(true);
  });

  it('shows mirror status beside persistence and syncs when clicked', async () => {
    const user = userEvent.setup();
    const onMirrorNow = vi.fn();
    const onMirrorToggle = vi.fn();
    const { rerender } = render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        persistenceEnabled={false}
        mirrorState={{ enabled: true, status: 'synced' }}
        onMirrorNow={onMirrorNow}
      />,
    );

    const unsavedMirrorButton = screen.getByRole('button', { name: 'Save deck before mirroring' });
    expect(unsavedMirrorButton).not.toBeDisabled();
    await user.click(unsavedMirrorButton);
    expect(onMirrorNow).toHaveBeenCalledTimes(1);

    rerender(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        persistenceEnabled
        mirrorState={{ enabled: false, status: 'disabled' }}
        onMirrorNow={onMirrorNow}
        onMirrorToggle={onMirrorToggle}
      />,
    );
    const disabledMirrorButton = screen.getByRole('button', { name: 'Mirror disabled' });
    expect(disabledMirrorButton).not.toBeDisabled();
    await user.click(disabledMirrorButton);
    expect(onMirrorNow).toHaveBeenCalledTimes(2);

    rerender(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        persistenceEnabled
        mirrorState={{ enabled: true, status: 'syncing' }}
        mirrorSyncProgress={{ current: 2, label: 'Mirroring assets/logo.png', total: 5 }}
        onMirrorNow={onMirrorNow}
        onMirrorToggle={onMirrorToggle}
      />,
    );
    expect(screen.getByRole('button', { name: 'Mirror syncing' })).toHaveClass('mirror-syncing');
    expect(screen.getByRole('progressbar', { name: 'Mirror sync progress' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
    expect(screen.getByRole('status', { name: 'Mirror syncing 40%' })).toHaveTextContent('40%');
    expect(screen.queryByText('Mirroring assets/logo.png')).not.toBeInTheDocument();

    rerender(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        persistenceEnabled
        mirrorState={{ enabled: true, status: 'synced' }}
        onMirrorNow={onMirrorNow}
        onMirrorToggle={onMirrorToggle}
      />,
    );
    const mirrorButton = screen.getByRole('button', { name: 'Mirror up to date' });
    expect(mirrorButton).toHaveClass('mirror-synced');
    await user.click(mirrorButton);
    expect(onMirrorToggle).toHaveBeenCalledWith(false);
    expect(onMirrorNow).toHaveBeenCalledTimes(2);
  });

  it('opens mirror settings from the status icon when mirroring was disabled in settings', async () => {
    const user = userEvent.setup();
    const onMirrorNow = vi.fn();
    const onOpenMirrorSettings = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        persistenceEnabled
        mirrorDisabledBySettings
        mirrorState={{ enabled: false, status: 'disabled' }}
        onMirrorNow={onMirrorNow}
        onOpenMirrorSettings={onOpenMirrorSettings}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Mirror disabled' }));

    expect(onOpenMirrorSettings).toHaveBeenCalledTimes(1);
    expect(onMirrorNow).not.toHaveBeenCalled();
  });

  it('labels deck storage state by persistence and mirror activation', () => {
    const { rerender } = render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        persistenceEnabled={false}
        mirrorState={{ enabled: false, status: 'disabled' }}
      />,
    );

    expect(screen.getByText('Unsaved deck')).toBeInTheDocument();

    rerender(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        persistenceEnabled
        mirrorState={{ enabled: false, status: 'disabled' }}
      />,
    );
    expect(screen.getByText('Local only')).toBeInTheDocument();

    rerender(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        persistenceEnabled
        mirrorState={{ enabled: true, status: 'syncing' }}
      />,
    );
    expect(screen.getByText('Mirroring')).toBeInTheDocument();
  });

  it('opens sharing even when MinIO external storage is not ready', async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onShare={onShare}
      />,
    );

    const shareButton = screen.getByRole('button', { name: 'Share' });
    expect(shareButton).not.toBeDisabled();
    expect(shareButton).toHaveAttribute('title', 'Share');
    await user.click(shareButton);
    expect(onShare).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Share' }));
    expect(onShare).toHaveBeenCalledTimes(2);
  });

  it('does not show stale share fallback UI when no share handler is provided', async () => {
    const user = userEvent.setup();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    render(<TopToolbar project={sampleProject.createSampleProject()} language="PT-BR" />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Share' }));
    await user.click(screen.getByRole('button', { name: 'Share' }));

    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('opens version history from the toolbar when persistence is enabled', async () => {
    const user = userEvent.setup();
    const onOpenVersionHistory = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        persistenceEnabled
        lastEditedAt="2026-06-26T15:04:00.000Z"
        onOpenVersionHistory={onOpenVersionHistory}
      />,
    );

    const historyButton = screen.getByRole('button', { name: 'Version history' });
    expect(historyButton).toHaveAttribute('title', expect.stringContaining('Last edited'));
    await user.click(historyButton);

    expect(onOpenVersionHistory).toHaveBeenCalledTimes(1);
  });
});
