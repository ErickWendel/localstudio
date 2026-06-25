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

  it('shows persistence as disabled by default near editing actions', () => {
    render(<TopToolbar project={createSampleProject()} language="PT-BR" />);

    expect(screen.getByRole('button', { name: 'Persistence disabled' })).toBeDisabled();
  });
});
