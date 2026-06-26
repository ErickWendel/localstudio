import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createSampleProject } from '../../../../src/domain/sampleProject';
import { TopToolbar } from '../../../../src/ui/editor/TopToolbar';

describe('TopToolbar', () => {
  it('opens Stitch header menus and wires available actions', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const onImportProject = vi.fn();
    const onNewProject = vi.fn();
    const onPersistenceToggle = vi.fn();
    const onSelectLayers = vi.fn();
    const onTranslateDeck = vi.fn();

    render(
      <TopToolbar
        project={createSampleProject()}
        language="PT-BR"
        onExport={onExport}
        onImportProject={onImportProject}
        onNewProject={onNewProject}
        onPersistenceToggle={onPersistenceToggle}
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
    await user.click(screen.getByRole('menuitem', { name: 'Save Local' }));
    expect(onPersistenceToggle).toHaveBeenCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export' }));
    expect(onExport).toHaveBeenCalledTimes(1);

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
        project={createSampleProject()}
        language="PT-BR"
        onPersistenceToggle={onPersistenceToggle}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));

    expect(onPersistenceToggle).toHaveBeenCalledWith(true);
  });

  it('marks persistence as unavailable when the browser cannot save local folders', async () => {
    const user = userEvent.setup();
    const onPersistenceToggle = vi.fn();

    render(
      <TopToolbar
        project={createSampleProject()}
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
    expect(screen.getByRole('menuitem', { name: 'Save Local' })).toBeDisabled();
    expect(onPersistenceToggle).not.toHaveBeenCalled();
  });

  it('opens version history from the toolbar when persistence is enabled', async () => {
    const user = userEvent.setup();
    const onOpenVersionHistory = vi.fn();

    render(
      <TopToolbar
        project={createSampleProject()}
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
        project={createSampleProject()}
        language="PT-BR"
        onProjectNameChange={onProjectNameChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit project name Untitled AI Deck' }));
    await user.clear(screen.getByRole('textbox', { name: 'Project name' }));
    await user.type(screen.getByRole('textbox', { name: 'Project name' }), 'Demo Deck{Enter}');

    expect(onProjectNameChange).toHaveBeenCalledWith('Demo Deck');
  });

  it('selects the full project name when entering rename mode', async () => {
    const user = userEvent.setup();
    const project = createSampleProject();

    render(<TopToolbar project={project} language="PT-BR" />);

    await user.click(screen.getByRole('button', { name: 'Edit project name Untitled AI Deck' }));

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Project name' });
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(project.name.length);
  });
});
