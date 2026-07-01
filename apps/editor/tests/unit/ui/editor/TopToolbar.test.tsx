import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { TopToolbar } from '../../../../src/ui/editor/TopToolbar';

describe('TopToolbar', () => {
  it('opens Stitch header menus and wires available actions', async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    const onImportProject = vi.fn();
    const onImportRemoteMirror = vi.fn();
    const onMirrorNow = vi.fn();
    const onNewProject = vi.fn();
    const onSaveLocal = vi.fn();
    const onSelectLayers = vi.fn();
    const onTranslateDeck = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onShare={onShare}
        onImportProject={onImportProject}
        onImportRemoteMirror={onImportRemoteMirror}
        onMirrorNow={onMirrorNow}
        onNewProject={onNewProject}
        onSaveLocal={onSaveLocal}
        onSelectLayers={onSelectLayers}
        onTranslateDeck={onTranslateDeck}
        canTranslateDeck
      />,
    );

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'New Project' }));
    expect(onNewProject).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import Project' }));
    expect(onImportProject).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import Remote' }));
    expect(onImportRemoteMirror).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Share' }));
    expect(onShare).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.getByRole('separator', { name: 'File storage actions' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Save' }));
    expect(onSaveLocal).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mirror Now' }));
    expect(onMirrorNow).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.queryByRole('menuitem', { name: 'Save Local' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Export' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'MinIO Mirror Settings' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'View' }));
    await user.click(screen.getByRole('menuitem', { name: 'Toggle Layers Panel' }));
    expect(onSelectLayers).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('menuitem', { name: 'Translate Deck' }));
    expect(onTranslateDeck).toHaveBeenCalledTimes(1);
  });

  it('toggles persistence from the toolbar status icon', async () => {
    const user = userEvent.setup();
    const onPersistenceToggle = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onPersistenceToggle={onPersistenceToggle}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));

    expect(onPersistenceToggle).toHaveBeenCalledWith(true);
  });

  it('links to the public GitHub repository from the editor toolbar', () => {
    render(<TopToolbar project={sampleProject.createSampleProject()} language="PT-BR" />);

    expect(screen.getByRole('link', { name: 'Star LocalStudio.dev on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/ErickWendel/localstudio',
    );
    expect(screen.getByLabelText('9999 GitHub stars')).toBeInTheDocument();
  });

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
      'Local project persistence is not available in this browser. Use a browser with File System Access support.',
    );
    expect(persistenceButton).toHaveTextContent('×');

    await user.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.queryByRole('menuitem', { name: 'Save Local' })).not.toBeInTheDocument();
    expect(onPersistenceToggle).not.toHaveBeenCalled();
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

    expect(screen.getByRole('button', { name: 'Mirror disabled' })).toBeDisabled();

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
    expect(onMirrorNow).toHaveBeenCalledTimes(1);

    rerender(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        persistenceEnabled
        mirrorState={{ enabled: true, status: 'syncing' }}
        onMirrorNow={onMirrorNow}
        onMirrorToggle={onMirrorToggle}
      />,
    );
    expect(screen.getByRole('button', { name: 'Mirror syncing' })).toHaveClass('mirror-syncing');

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
    expect(onMirrorNow).toHaveBeenCalledTimes(1);
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

  it('disables sharing until MinIO external storage is ready', async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        publicSharingAvailable={false}
        publicSharingUnavailableReason="Public sharing requires active external storage."
        onShare={onShare}
      />,
    );

    const shareButton = screen.getByRole('button', { name: 'Share' });
    expect(shareButton).toBeDisabled();
    expect(shareButton).toHaveAttribute('title', 'Public sharing requires active external storage.');

    await user.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.getByRole('menuitem', { name: 'Share' })).toBeDisabled();
    expect(onShare).not.toHaveBeenCalled();
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

  it('edits the project name inline', async () => {
    const user = userEvent.setup();
    const onProjectNameChange = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onProjectNameChange={onProjectNameChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit project name Untitled AI Deck' }));
    await user.clear(screen.getByRole('textbox', { name: 'Project name' }));
    await user.type(screen.getByRole('textbox', { name: 'Project name' }), 'Demo Deck{Enter}');

    expect(onProjectNameChange).toHaveBeenCalledWith('Demo Deck');
  });

  it('starts presenter mode from the play button near the project name', async () => {
    const user = userEvent.setup();
    const onStartPresenterMode = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onStartPresenterMode={onStartPresenterMode}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Play presentation' }));

    expect(onStartPresenterMode).toHaveBeenCalledTimes(1);
    expect(onStartPresenterMode).toHaveBeenCalledWith();
  });

  it('starts presenter mode from the beginning from the play menu', async () => {
    const user = userEvent.setup();
    const onStartPresenterMode = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onStartPresenterMode={onStartPresenterMode}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Presentation play options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Play from beginning' }));

    expect(onStartPresenterMode).toHaveBeenCalledWith({ fromBeginning: true });
  });

  it('selects the full project name when entering rename mode', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();

    render(<TopToolbar project={project} language="PT-BR" />);

    await user.click(screen.getByRole('button', { name: 'Edit project name Untitled AI Deck' }));

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Project name' });
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(project.name.length);
  });
});
