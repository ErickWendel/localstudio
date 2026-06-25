import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAppServices } from '../../../../src/app/composition';
import { EditorShell } from '../../../../src/ui/editor/EditorShell';

describe('EditorShell', () => {
  it('renders the approved editor shell landmarks', () => {
    render(<EditorShell services={createAppServices()} />);

    expect(screen.getByText('EW Canvas AI')).toBeInTheDocument();
    expect(screen.getByText('Untitled AI Deck')).toBeInTheDocument();
    expect(screen.getByText('PT-BR')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Describe slide structure or organize current content...'),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to the layout panel from the header view menu', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'View' }));
    await user.click(screen.getByRole('menuitem', { name: 'Toggle Layers Panel' }));

    expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
  });

  it('undoes and redoes editor mutations from the toolbar', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'Delete Selected Image' }));
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Selected Image' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();
  });

  it('zooms the canvas from the toolbar', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'Zoom In' }));
    expect(screen.getByText('110%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zoom Out' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('pastes an image from the clipboard as a new selected layer', async () => {
    render(<EditorShell services={createAppServices()} />);
    const image = new File(['image-bytes'], 'clipboard.png', { type: 'image/png' });

    fireEvent.paste(screen.getByLabelText('Canvas workspace'), {
      clipboardData: {
        files: [image],
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }],
      },
    });

    expect(await screen.findByRole('button', { name: 'clipboard.png' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
