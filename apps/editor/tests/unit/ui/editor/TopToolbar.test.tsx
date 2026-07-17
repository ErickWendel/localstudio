import { localStudioAppRoutes } from '@localstudio/app-routes';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { TopToolbar } from '../../../../src/ui/editor/toolbars/TopToolbar';

describe('TopToolbar', () => {
  it('opens Stitch header menus and wires available actions', () => {
    const onShare = vi.fn();
    const onImportPowerPoint = vi.fn();
    const onImportProject = vi.fn();
    const onImportRemoteMirror = vi.fn();
    const onMirrorNow = vi.fn();
    const onNewProject = vi.fn();
    const onSaveLocalAs = vi.fn();
    const onSaveLocal = vi.fn();
    const onResetZoom = vi.fn();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();

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
        onResetZoom={onResetZoom}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'New Project' }));
    expect(onNewProject).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Import' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Project' }));
    expect(onImportProject).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Import' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'PowerPoint (.pptx)' }));
    expect(onImportPowerPoint).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Import' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remote' }));
    expect(onImportRemoteMirror).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Share' }));
    expect(onShare).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.getByRole('separator', { name: 'File storage actions' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save' }));
    expect(onSaveLocal).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save As...' }));
    expect(onSaveLocalAs).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mirror Now' }));
    expect(onMirrorNow).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.queryByRole('menuitem', { name: 'Save Local' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Export' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'MinIO Mirror Settings' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(screen.queryByRole('menuitem', { name: 'Toggle Layers Panel' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Zoom' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Zoom Out' }));
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Zoom' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '100%' }));
    expect(onResetZoom).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Zoom' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Zoom In' }));
    expect(onZoomIn).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.queryByRole('menuitem', { name: 'Translate Deck' })).not.toBeInTheDocument();
  });

  it('opens the PowerPoint export action from the File menu', () => {
    const onExportPowerPoint = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onExportPowerPoint={onExportPowerPoint}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export to' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Powerpoint (.pptx)' }));

    expect(onExportPowerPoint).toHaveBeenCalledTimes(1);
  });

  it('opens file submenus when users hover their triggers', () => {
    render(<TopToolbar project={sampleProject.createSampleProject()} language="PT-BR" />);

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.pointerEnter(screen.getByRole('menuitem', { name: 'Import' }));

    expect(screen.getByRole('menu', { name: 'Import' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'PowerPoint (.pptx)' })).toBeInTheDocument();

    fireEvent.pointerEnter(screen.getByRole('menuitem', { name: 'Export to' }));

    expect(screen.queryByRole('menu', { name: 'Import' })).not.toBeInTheDocument();
    expect(screen.getByRole('menu', { name: 'Export to' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Images (.zip)' })).toBeInTheDocument();
  });

  it('switches open header menus when users hover another header item', () => {
    render(<TopToolbar project={sampleProject.createSampleProject()} language="PT-BR" />);

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'View' }));
    expect(screen.queryByRole('menu', { name: 'View menu' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.pointerEnter(screen.getByRole('menuitem', { name: 'Import' }));
    expect(screen.getByRole('menu', { name: 'File menu' })).toBeInTheDocument();
    expect(screen.getByRole('menu', { name: 'Import' })).toBeInTheDocument();

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'View' }));

    expect(screen.queryByRole('menu', { name: 'File menu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menu', { name: 'Import' })).not.toBeInTheDocument();
    expect(screen.getByRole('menu', { name: 'View menu' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Zoom' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(screen.getByRole('menu', { name: 'View menu' })).toBeInTheDocument();
  });

  it('opens the image archive export action from the File menu', () => {
    const onExportImages = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onExportImages={onExportImages}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export to' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Images (.zip)' }));

    expect(onExportImages).toHaveBeenCalledTimes(1);
  });

  it('shows operation notices and disables PowerPoint export while exporting', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export to' }));
    expect(screen.getByRole('menuitem', { name: 'Exporting PowerPoint...' })).toBeDisabled();
  });

  it('disables image export while exporting images', () => {
    const onExportImages = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        isExportingImages
        onExportImages={onExportImages}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export to' }));

    expect(screen.getByRole('menuitem', { name: 'Exporting images...' })).toBeDisabled();
  });

  it('toggles persistence from the toolbar status icon', () => {
    const onPersistenceToggle = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onPersistenceToggle={onPersistenceToggle}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Persistence disabled' }));

    expect(onPersistenceToggle).toHaveBeenCalledWith(true);
  });

  it('opens keyboard shortcuts from the Help menu', () => {
    const onOpenKeyboardShortcuts = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onOpenKeyboardShortcuts={onOpenKeyboardShortcuts}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Keyboard Shortcuts' }));

    expect(onOpenKeyboardShortcuts).toHaveBeenCalledTimes(1);
  });

  it('opens docs from the Help menu', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<TopToolbar project={sampleProject.createSampleProject()} language="PT-BR" />);

    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Docs' }));

    expect(openSpy).toHaveBeenCalledWith(
      localStudioAppRoutes.docs.gettingStartedAnchor,
      '_blank',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });

  it('starts the AI setup tour from the Help menu', () => {
    const onStartAiSetupTour = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        onStartAiSetupTour={onStartAiSetupTour}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'AI Setup Tour' }));

    expect(onStartAiSetupTour).toHaveBeenCalledTimes(1);
  });

  it('opens GitHub issues from the Help menu bug report action', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<TopToolbar project={sampleProject.createSampleProject()} language="PT-BR" />);

    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.queryByRole('menuitem', { name: 'Local AI Setup' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Found a bug?' }));

    expect(openSpy).toHaveBeenCalledWith(
      'https://github.com/ErickWendel/localstudio/issues/new/choose',
      '_blank',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });

  it('closes header menus when clicking outside them', async () => {
    const user = userEvent.setup();

    render(
      <div>
        <TopToolbar project={sampleProject.createSampleProject()} language="PT-BR" />
        <button type="button">Outside target</button>
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.getByRole('menu', { name: 'File menu' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Outside target' }));

    expect(screen.queryByRole('menu', { name: 'File menu' })).not.toBeInTheDocument();
  });

  it('translates the deck from the toolbar icon beside persistence', () => {
    const onTranslateDeck = vi.fn();

    render(
      <TopToolbar
        project={sampleProject.createSampleProject()}
        language="PT-BR"
        canTranslateDeck
        onTranslateDeck={onTranslateDeck}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Translate deck' }));

    expect(onTranslateDeck).toHaveBeenCalledTimes(1);
    const editingActionLabels = within(screen.getByLabelText('Editing actions'))
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(editingActionLabels).toEqual([
      'Persistence disabled',
      'Save deck before mirroring',
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

    fireEvent.click(screen.getByRole('button', { name: 'Translation path options' }));
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

    fireEvent.click(screen.getByRole('button', { name: 'Translation path options' }));
    expect(screen.getByRole('group', { name: 'Translation path' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Current slide language/ }));

    expect(screen.queryByRole('group', { name: 'Translation path' })).not.toBeInTheDocument();
  });

  it('closes the deck translation path menu when users share', async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();

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
        onShare={onShare}
        onTranslateDeck={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Translation path options' }));
    expect(screen.getByRole('group', { name: 'Translation path' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Share' }));

    expect(onShare).toHaveBeenCalledTimes(1);
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

    fireEvent.click(screen.getByRole('button', { name: 'Edit project name Untitled AI Deck' }));
    await user.clear(screen.getByRole('textbox', { name: 'Project name' }));
    await user.type(screen.getByRole('textbox', { name: 'Project name' }), 'Demo Deck{Enter}');

    expect(onProjectNameChange).toHaveBeenCalledWith('Demo Deck');
  });

  it('selects the full project name when entering rename mode', () => {
    const project = sampleProject.createSampleProject();

    render(<TopToolbar project={project} language="PT-BR" />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit project name Untitled AI Deck' }));

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Project name' });
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(project.name.length);
  });
});
