import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const {
  createAppServices,
  openLeftTab,
  selectImageLayer,
} = editorShellTestHarness;

describe('EditorShell workspace controls', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/editor/');
    vi.restoreAllMocks();
  });

  it('switches to the layout panel from the left tool rail', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await openLeftTab(user, 'Layout');

    expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps pages and tool panels mutually exclusive', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle pages panel' }));
    expect(screen.getByLabelText('Pages')).toBeInTheDocument();

    await openLeftTab(user, 'Layout');

    expect(screen.getByText('4 layers on current page')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pages')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle pages panel' }));

    expect(screen.getByLabelText('Pages')).toBeInTheDocument();
    expect(screen.queryByText('4 layers on current page')).not.toBeInTheDocument();
  });

  it('marks the workspace as zoomed out when the user scales below 100%', () => {
    render(<EditorShell services={createAppServices()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Zoom Out' }));

    expect(screen.getByLabelText('Canvas workspace')).toHaveClass('workspace-column-zoomed-out');
  });

  it('undoes and redoes editor mutations from the toolbar', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Selected Image' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();
  });

  it('undoes and redoes editor mutations with keyboard shortcuts', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();

    await user.keyboard('{Meta>}z{/Meta}');
    expect(screen.getByRole('button', { name: 'Selected Image' })).toBeInTheDocument();

    await user.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}');
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();
  });

  it('selects all elements on the active slide with the select-all shortcut', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.keyboard('{Meta>}a{/Meta}');
    await openLeftTab(user, 'Layout');

    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
      'data-selected-elements',
      'image-hero,text-subtitle,text-title',
    );
    expect(screen.getByRole('button', { name: 'Selected Image' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Title' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Subtitle' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('renames the project from the toolbar', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit project name Untitled AI Deck' }));
    await user.clear(screen.getByRole('textbox', { name: 'Project name' }));
    await user.type(screen.getByRole('textbox', { name: 'Project name' }), 'Browser Deck{Enter}');

    expect(
      screen.getByRole('button', { name: 'Edit project name Browser Deck' }),
    ).toBeInTheDocument();
  });

  it('zooms the canvas from the toolbar', () => {
    render(<EditorShell services={createAppServices()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Zoom In' }));
    expect(screen.getByText('110%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom Out' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('keeps insert quick actions visible after adding a second slide', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Add page' })[0]!);

    expect(screen.getByRole('button', { name: 'Rename Slide 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert Text' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert Media' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Insert Text' }));
    await openLeftTab(user, 'Layout');
    expect(screen.getByRole('button', { name: 'Add a heading' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('deletes the selected layer with Delete and Backspace keystrokes', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);

    await user.keyboard('{Delete}');
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Selected Image' }));

    await user.keyboard('{Backspace}');
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();
  });

  it('duplicates, centers, and changes z-order from the floating toolbar', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(screen.getByRole('button', { name: 'Selected Image copy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Align Center' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send Backward' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bring Forward' }));

    expect(screen.getByRole('button', { name: 'Selected Image copy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows speaker notes as a Canva-style side panel with controls', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    const notesToggle = screen.getByRole('button', { name: 'Toggle notes panel' });
    expect(notesToggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('heading', { name: 'Page 1 - Slide 1' })).not.toBeInTheDocument();

    fireEvent.click(notesToggle);

    expect(notesToggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Page 1 - Slide 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Timer' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change notes text size' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close notes panel' })).toBeInTheDocument();
    expect(screen.getByText('0/5000')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Speaker notes'), 'Opening note');

    expect(screen.getByText('12/5000')).toBeInTheDocument();

    fireEvent.click(notesToggle);
    expect(screen.queryByRole('heading', { name: 'Page 1 - Slide 1' })).not.toBeInTheDocument();
  });
});
