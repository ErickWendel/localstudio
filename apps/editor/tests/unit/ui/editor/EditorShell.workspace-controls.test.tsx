import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const { createAppServices, openLeftTab, selectImageLayer } = editorShellTestHarness;

describe('EditorShell workspace controls', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/editor/');
    window.localStorage.removeItem('localstudio.editorSpeakerNotesHeight');
    window.localStorage.removeItem('localstudio.editorSpeakerNotesWidth');
    vi.restoreAllMocks();
  });

  it('switches to the layout panel from the left tool rail', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await openLeftTab(user, 'Layout');

    expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens the layout panel when the canvas background is double-clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<EditorShell services={createAppServices()} />);

    await openLeftTab(user, 'Elements');
    expect(screen.getByRole('tab', { name: 'Elements' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.dblClick(container.querySelector('canvas')!);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.getByText('Image grids')).toBeInTheDocument();
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

  it('inserts placeholder image grids from the layout panel', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await openLeftTab(user, 'Layout');
    fireEvent.click(screen.getByRole('button', { name: 'Insert 3 images grid' }));

    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
      'data-selected-elements',
      expect.stringMatching(/image-grid-1.*image-grid-2.*image-grid-3/),
    );
    expect(screen.getAllByRole('button', { name: 'Web AI placeholder image' })).toHaveLength(3);
  });

  it('inserts custom placeholder image grids from the layout panel', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await openLeftTab(user, 'Layout');
    const columnsInput = screen.getByRole('spinbutton', { name: 'Grid columns' });
    const rowsInput = screen.getByRole('spinbutton', { name: 'Grid rows' });
    const insertButton = screen.getByRole('button', { name: 'Insert' });
    await user.clear(columnsInput);
    await user.type(columnsInput, '2');
    await user.clear(rowsInput);
    await user.type(rowsInput, '2');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Text placeholders' }), {
      target: { value: '0' },
    });
    expect(
      screen.getByRole('img', {
        name: 'Custom grid preview 2 columns by 2 rows, 0 text placeholders, cover image fit',
      }),
    ).toBeInTheDocument();
    expect(insertButton).toBeEnabled();
    await user.click(insertButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-selected-elements',
        expect.stringMatching(/image-grid-1.*image-grid-2.*image-grid-3.*image-grid-4/),
      );
    });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Web AI placeholder image' })).toHaveLength(4);
    });
  });

  it('inserts custom image and text placeholder layouts from the layout panel', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await openLeftTab(user, 'Layout');
    const columnsInput = screen.getByRole('spinbutton', { name: 'Grid columns' });
    const rowsInput = screen.getByRole('spinbutton', { name: 'Grid rows' });
    const textInput = screen.getByRole('spinbutton', { name: 'Text placeholders' });
    const imageFitSelect = screen.getByRole('combobox', { name: 'Image fit' });
    expect(screen.getByText('Arrangement')).toBeInTheDocument();
    expect(screen.getByText('Image behavior')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'object-fit: fill' })).toBeInTheDocument();
    expect(columnsInput).toHaveValue(1);
    expect(rowsInput).toHaveValue(1);
    expect(textInput).toHaveValue(1);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Media position' }), 'left');
    await user.selectOptions(imageFitSelect, 'contain');
    await user.click(screen.getByRole('button', { name: 'Insert' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-selected-elements',
        expect.stringMatching(/image-grid-1.*layout-text-1/),
      );
    });
    expect(screen.getAllByRole('button', { name: 'Web AI placeholder image' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Add a heading' })).toBeInTheDocument();
  });

  it('blocks invalid custom placeholder image grid sizes', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await openLeftTab(user, 'Layout');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Grid columns' }), {
      target: { value: '9' },
    });

    expect(screen.getByRole('button', { name: 'Insert' })).toBeDisabled();
    expect(screen.queryByRole('img', { name: /Custom grid preview/ })).not.toBeInTheDocument();
  });

  it('updates the custom image grid preview while typing', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await openLeftTab(user, 'Layout');
    const columnsInput = screen.getByRole('spinbutton', { name: 'Grid columns' });
    const rowsInput = screen.getByRole('spinbutton', { name: 'Grid rows' });
    const textInput = screen.getByRole('spinbutton', { name: 'Text placeholders' });
    await user.clear(columnsInput);
    await user.type(columnsInput, '4');
    await user.clear(rowsInput);
    await user.type(rowsInput, '3');
    await user.clear(textInput);
    await user.type(textInput, '1');

    const preview = screen.getByRole('img', {
      name: 'Custom grid preview 4 columns by 3 rows, 1 text placeholders, cover image fit',
    });
    expect(preview).toBeInTheDocument();
    expect(preview.querySelectorAll('.layout-custom-grid-preview-cell')).toHaveLength(12);
    expect(preview.querySelectorAll('.layout-custom-grid-preview-text')).toHaveLength(1);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Image fit' }), 'contain');
    expect(
      screen.getByRole('img', {
        name: 'Custom grid preview 4 columns by 3 rows, 1 text placeholders, contain image fit',
      }),
    ).toBeInTheDocument();
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

  it('opens Layout to edit a multi-selection as a grid and makes the update undoable', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.keyboard('{Meta>}a{/Meta}');

    expect(screen.getByRole('button', { name: 'Edit as grid' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit as grid' }));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.getByText('Edit selected grid')).toBeInTheDocument();
    expect(screen.getByText('3 selected elements')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Grid columns' })).toHaveValue(2);
    expect(screen.getByRole('spinbutton', { name: 'Grid rows' })).toHaveValue(2);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Image fit' }), 'stretch');
    fireEvent.click(screen.getByRole('button', { name: 'Update selection' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(screen.getByText('3 selected elements')).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: 'Align' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Center left' }));
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

  it('resizes speaker notes with the drag handle', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1000,
    });
    render(<EditorShell services={createAppServices()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle notes panel' }));

    const notesEditor = screen.getByRole('region', { name: 'Speaker notes editor' });
    const widthResizer = screen.getByRole('separator', { name: 'Resize speaker notes width' });
    const heightResizer = screen.getByRole('separator', { name: 'Resize speaker notes height' });
    expect(notesEditor).toHaveStyle({
      '--speaker-notes-height': '760px',
      '--speaker-notes-width': '360px',
    });

    fireEvent.pointerDown(widthResizer, { clientX: 380, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 500 });
    fireEvent.pointerUp(window);

    fireEvent.pointerDown(heightResizer, { clientY: 220, pointerId: 2 });
    fireEvent.pointerMove(window, { clientY: 120 });
    fireEvent.pointerUp(window);

    expect(notesEditor).toHaveStyle({ '--speaker-notes-height': '860px' });
    expect(notesEditor).toHaveStyle({ '--speaker-notes-width': '480px' });
    expect(widthResizer).toHaveAttribute('aria-valuenow', '480');
    expect(heightResizer).toHaveAttribute('aria-valuenow', '860');
    expect(window.localStorage.getItem('localstudio.editorSpeakerNotesHeight')).toBe('860');
    expect(window.localStorage.getItem('localstudio.editorSpeakerNotesWidth')).toBe('480');
  });
});
