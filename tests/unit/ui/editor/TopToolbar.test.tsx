import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createSampleProject } from '../../../../src/domain/sampleProject';
import { TopToolbar } from '../../../../src/ui/editor/TopToolbar';

describe('TopToolbar', () => {
  it('opens Stitch header menus and wires available actions', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const onSelectLayers = vi.fn();

    render(
      <TopToolbar
        project={createSampleProject()}
        language="PT-BR"
        onExport={onExport}
        onSelectLayers={onSelectLayers}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.getByRole('menuitem', { name: 'New Project' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Save Local' })).toBeDisabled();
    await user.click(screen.getByRole('menuitem', { name: 'Export' }));
    expect(onExport).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'View' }));
    await user.click(screen.getByRole('menuitem', { name: 'Toggle Layers Panel' }));
    expect(onSelectLayers).toHaveBeenCalledTimes(1);
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
