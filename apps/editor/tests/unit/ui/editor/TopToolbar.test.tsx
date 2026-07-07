import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { TopToolbar } from '../../../../src/ui/editor/toolbars/TopToolbar';

describe('TopToolbar', () => {
  it('opens Stitch header menus and wires available actions', async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    const onImportPowerPoint = vi.fn();
    const onImportProject = vi.fn();
    const onImportRemoteMirror = vi.fn();
    const onMirrorNow = vi.fn();
    const onNewProject = vi.fn();
    const onSaveLocalAs = vi.fn();
    const onSaveLocal = vi.fn();
    const onSelectLayers = vi.fn();
    const onTranslateDeck = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onShare={onShare}
        onImportPowerPoint={onImportPowerPoint}
        onImportProject={onImportProject}
        onImportRemoteMirror={onImportRemoteMirror}
        onMirrorNow={onMirrorNow}
        onNewProject={onNewProject}
        onSaveLocal={onSaveLocal}
        onSaveLocalAs={onSaveLocalAs}
        onSelectLayers={onSelectLayers}
        onTranslateDeck={onTranslateDeck}
        canTranslateDeck
      />,
    );

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'New Project' }));
    expect(onNewProject).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import' }));
    await user.click(screen.getByRole('menuitem', { name: 'Project' }));
    expect(onImportProject).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import' }));
    await user.click(screen.getByRole('menuitem', { name: 'PowerPoint (.pptx)' }));
    expect(onImportPowerPoint).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import' }));
    await user.click(screen.getByRole('menuitem', { name: 'Remote' }));
    expect(onImportRemoteMirror).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Share' }));
    expect(onShare).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.getByRole('separator', { name: 'File storage actions' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Save' }));
    expect(onSaveLocal).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Save As...' }));
    expect(onSaveLocalAs).toHaveBeenCalledTimes(1);
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

  it('opens the PowerPoint export action from the File menu', async () => {
    const user = userEvent.setup();
    const onExportPowerPoint = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onExportPowerPoint={onExportPowerPoint}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export to' }));
    await user.click(screen.getByRole('menuitem', { name: 'Powerpoint (.pptx)' }));

    expect(onExportPowerPoint).toHaveBeenCalledTimes(1);
  });

  it('opens the image archive export action from the File menu', async () => {
    const user = userEvent.setup();
    const onExportImages = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onExportImages={onExportImages}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export to' }));
    await user.click(screen.getByRole('menuitem', { name: 'Images (.zip)' }));

    expect(onExportImages).toHaveBeenCalledTimes(1);
  });

  it('shows operation notices and disables PowerPoint export while exporting', async () => {
    const user = userEvent.setup();
    const onExportPowerPoint = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        isExportingPowerPoint
        operationNotice={{
          detail: 'Slide 1',
          message: 'Exporting PowerPoint...',
          progress: { current: 1, total: 4 },
          tone: 'info',
        }}
        onExportPowerPoint={onExportPowerPoint}
      />,
    );

    expect(screen.getByRole('status')).toHaveClass('operation-notice-info');
    expect(screen.getByRole('status')).toHaveTextContent('Exporting PowerPoint...');
    expect(screen.getByRole('status')).toHaveTextContent('Slide 1');
    expect(screen.getByLabelText('1 of 4')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export to' }));
    expect(screen.getByRole('menuitem', { name: 'Exporting PowerPoint...' })).toBeDisabled();
  });

  it('disables image export while exporting images', async () => {
    const user = userEvent.setup();
    const onExportImages = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        isExportingImages
        onExportImages={onExportImages}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export to' }));

    expect(screen.getByRole('menuitem', { name: 'Exporting images...' })).toBeDisabled();
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

  it('opens keyboard shortcuts from the Help menu', async () => {
    const user = userEvent.setup();
    const onOpenKeyboardShortcuts = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onOpenKeyboardShortcuts={onOpenKeyboardShortcuts}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Help' }));
    await user.click(screen.getByRole('menuitem', { name: 'Keyboard Shortcuts' }));

    expect(onOpenKeyboardShortcuts).toHaveBeenCalledTimes(1);
  });

  it('closes header menus when clicking outside them', async () => {
    const user = userEvent.setup();

    render(
      <div>
        <TopToolbar project={sampleProject.createSampleProject()} language="PT-BR" />
        <button type="button">Outside target</button>
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.getByRole('menu', { name: 'File menu' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Outside target' }));

    expect(screen.queryByRole('menu', { name: 'File menu' })).not.toBeInTheDocument();
  });

  it('translates the deck from the toolbar icon beside persistence', async () => {
    const user = userEvent.setup();
    const onTranslateDeck = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        canTranslateDeck
        onTranslateDeck={onTranslateDeck}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Translate deck' }));

    expect(onTranslateDeck).toHaveBeenCalledTimes(1);
    const editingActionLabels = within(screen.getByLabelText('Editing actions'))
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(editingActionLabels).toEqual([
      'Persistence disabled',
      'Mirror disabled',
      'Version history',
      'Undo',
      'Redo',
      'Translate deck',
      'Translation path options',
    ]);
  });

  it('lets users choose the deck translation path from the toolbar', async () => {
    const user = userEvent.setup();
    const onTranslationSourceLanguageChange = vi.fn();
    const onTranslationTargetLanguageChange = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="EN"
        canTranslateDeck
        translationLanguageOptions={[
          { code: 'en', flag: '🇺🇸', label: 'English' },
          { code: 'pt', flag: '🇧🇷', label: 'Portuguese' },
          { code: 'es', flag: '🇪🇸', label: 'Spanish' },
        ]}
        translationSourceLanguage="en"
        translationTargetLanguage="pt"
        onTranslationSourceLanguageChange={onTranslationSourceLanguageChange}
        onTranslationTargetLanguageChange={onTranslationTargetLanguageChange}
        onTranslateDeck={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Translation path options' }));
    expect(screen.getAllByRole('option', { name: 'Spanish (es) 🇪🇸' }).length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByLabelText('Translate from'), 'es');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'en');

    expect(onTranslationSourceLanguageChange).toHaveBeenCalledWith('es');
    expect(onTranslationTargetLanguageChange).toHaveBeenCalledWith('en');
  });

  it('closes the deck translation path menu when users click outside', async () => {
    const user = userEvent.setup();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="EN"
        canTranslateDeck
        translationLanguageOptions={[
          { code: 'en', flag: '🇺🇸', label: 'English' },
          { code: 'pt', flag: '🇧🇷', label: 'Portuguese' },
        ]}
        translationSourceLanguage="en"
        translationTargetLanguage="pt"
        onTranslateDeck={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Translation path options' }));
    expect(screen.getByRole('group', { name: 'Translation path' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Current slide language/ }));

    expect(screen.queryByRole('group', { name: 'Translation path' })).not.toBeInTheDocument();
  });

  it('disables the toolbar deck translation icon when no deck text can be translated', () => {
    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        canTranslateDeck={false}
        onTranslateDeck={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Translate deck' })).toBeDisabled();
  });

  it('pulses the deck translation icon and shows the active slide status', () => {
    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        canTranslateDeck={false}
        deckTranslationStatus="Translating Slide 3 · 2/8"
        isTranslatingDeck
        onTranslateDeck={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Translate deck' })).toHaveClass(
      'deck-translate-button-active',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Translating Slide 3 · 2/8');
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

  it('opens presenter view from the play button near the project name by default', async () => {
    const user = userEvent.setup();
    const onOpenPresenterView = vi.fn();
    const onStartPresenterMode = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onOpenPresenterView={onOpenPresenterView}
        onStartPresenterMode={onStartPresenterMode}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Play presentation' }));

    expect(onOpenPresenterView).toHaveBeenCalledTimes(1);
    expect(onStartPresenterMode).not.toHaveBeenCalled();
  });

  it('starts presenter mode from the play button when presenter view is unavailable', async () => {
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

  it('opens presenter view from the play menu', async () => {
    const user = userEvent.setup();
    const onOpenPresenterView = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onOpenPresenterView={onOpenPresenterView}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Presentation play options' }));

    expect(screen.getByRole('menuitem', { name: 'Present in fullscreen' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Presenter view' }));

    expect(onOpenPresenterView).toHaveBeenCalledTimes(1);
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
