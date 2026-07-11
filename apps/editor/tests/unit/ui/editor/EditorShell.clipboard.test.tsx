import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const {
  SavingProjectRepository,
  createAppServices,
  createClipboardData,
  openLeftTab,
  selectImageLayer,
  selectTitleLayer,
} = editorShellTestHarness;

describe('EditorShell clipboard workflows', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/editor/');
    vi.restoreAllMocks();
  });

  it('pastes an image from the clipboard as a new selected layer', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await openLeftTab(user, 'Layout');
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

  it('pastes an item-only clipboard image from the window with a fallback name', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await openLeftTab(user, 'Layout');
    const image = new File(['image-bytes'], '', { type: 'image/png' });

    fireEvent.paste(window, {
      clipboardData: {
        files: [],
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }],
      },
    });

    expect(await screen.findByRole('button', { name: 'Pasted image' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('copies and pastes selected objects near the original selection', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    render(<EditorShell services={services} />);
    await selectImageLayer(user);

    fireEvent.copy(window, {
      clipboardData: createClipboardData(),
    });
    fireEvent.paste(window, {
      clipboardData: createClipboardData({ editorObject: true }),
    });

    expect(screen.getByRole('button', { name: 'Selected Image copy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));

    await waitFor(() => {
      const savedProject = repository.savedProjects.at(-1);
      const original = savedProject?.elements['image-hero'];
      const pasted = Object.values(savedProject?.elements ?? {}).find(
        (element) => element.type === 'image' && element.id !== 'image-hero',
      );
      expect(pasted).toMatchObject({
        assetId: original?.type === 'image' ? original.assetId : undefined,
        x: (original?.x ?? 0) + 32,
        y: (original?.y ?? 0) + 32,
      });
    });
  });

  it('does not overwrite copied text when an editable field is active with a selected object', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);
    const clipboardData = createClipboardData();
    const textArea = document.createElement('textarea');
    textArea.value = 'Copied text from editor';
    document.body.append(textArea);
    textArea.focus();
    textArea.select();

    fireEvent.copy(window, {
      clipboardData,
    });

    expect(clipboardData.setData).not.toHaveBeenCalledWith(
      'text/plain',
      'LocalStudio.dev editor elements',
    );
    expect(clipboardData.setData).not.toHaveBeenCalledWith(
      'application/x-localstudio-editor-elements',
      '1',
    );
    textArea.remove();
  });

  it('prefers the latest editor object copy over stale image clipboard data', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await openLeftTab(user, 'Layout');

    fireEvent.copy(window, {
      clipboardData: createClipboardData(),
    });
    await selectTitleLayer(user);
    fireEvent.copy(window, {
      clipboardData: createClipboardData(),
    });

    const staleImage = new File(['stale-image'], 'stale-system-image.png', { type: 'image/png' });
    fireEvent.paste(window, {
      clipboardData: createClipboardData({ editorObject: true, files: [staleImage] }),
    });

    expect(await screen.findByRole('button', { name: 'Title copy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.queryByRole('button', { name: 'stale-system-image.png' }),
    ).not.toBeInTheDocument();
  });

  it('imports a newer system image paste instead of an older editor object copy', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await openLeftTab(user, 'Layout');

    fireEvent.copy(window, {
      clipboardData: createClipboardData(),
    });

    const image = new File(['new-image'], 'new-system-image.png', { type: 'image/png' });
    fireEvent.paste(window, {
      clipboardData: createClipboardData({ files: [image] }),
    });

    expect(await screen.findByRole('button', { name: 'new-system-image.png' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Selected Image copy' })).not.toBeInTheDocument();
  });

  it('cuts selected objects into the editor clipboard', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);

    fireEvent.cut(window, {
      clipboardData: createClipboardData(),
    });
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();

    fireEvent.paste(window, {
      clipboardData: createClipboardData({ editorObject: true }),
    });

    expect(await screen.findByRole('button', { name: 'Selected Image copy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });


});
