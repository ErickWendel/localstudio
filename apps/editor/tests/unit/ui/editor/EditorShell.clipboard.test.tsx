import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { assetFileUtils } from '../../../../src/services/storage/assetFileUtils';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const {
  SavingProjectRepository,
  RecordingMirrorService,
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

    expect(
      await screen.findByRole('button', { name: 'clipboard.png' }, { timeout: 5_000 }),
    ).toHaveAttribute('aria-pressed', 'true');
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

    expect(
      await screen.findByRole('button', { name: 'Pasted image' }, { timeout: 5_000 }),
    ).toHaveAttribute('aria-pressed', 'true');
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

    fireEvent.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose folder' }));

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

  it('pastes an object copied from another editor tab', async () => {
    const user = userEvent.setup();
    const clipboardData = createClipboardData();

    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);
    fireEvent.copy(window, { clipboardData });
    fireEvent.paste(window, { clipboardData });

    expect(await screen.findByRole('button', { name: 'Selected Image copy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('asks for a project name before copying a slide that is not stored locally', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    render(<EditorShell services={services} />);

    const copyButton = screen.getByRole('button', { name: 'Copy Slide 1 to clipboard' });
    const hint =
      'Store this project locally before copying slides. Unsaved assets can paste empty in another tab.';
    expect(copyButton).toBeDisabled();
    expect(copyButton).toHaveAttribute('title', hint);

    await user.click(screen.getByRole('button', { name: 'Save now' }));
    const nameInput = screen.getByRole('textbox', { name: 'Project folder name' });
    await user.clear(nameInput);
    await user.type(nameInput, 'Stored Deck');
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy Slide 1 to clipboard' })).toBeEnabled();
    });
    expect(screen.queryByRole('button', { name: 'Save now' })).not.toBeInTheDocument();
    expect(repository.savedProjects.at(-1)?.name).toBe('Stored Deck');
  });

  it('persists and mirrors a whole slide pasted from the system clipboard', async () => {
    const user = userEvent.setup();
    const initialProject = sampleProject.createSampleProject();
    initialProject.assets['asset-hero'] = {
      ...initialProject.assets['asset-hero']!,
      fileName: 'hero.png',
      objectUrl: 'blob:https://localstudio.dev/hero',
      storage: 'file',
    };
    const backgroundAsset = {
      ...initialProject.assets['asset-hero'],
      fileName: 'background.png',
      id: 'asset-background',
      name: 'Slide background',
    };
    initialProject.assets[backgroundAsset.id] = backgroundAsset;
    initialProject.pages[0] = {
      ...initialProject.pages[0]!,
      animationBuilds: [
        {
          id: 'build-image-hero',
          elementId: 'image-hero',
          effect: 'reveal',
          trigger: 'on-click',
          delayMs: 0,
        },
      ],
      background: {
        type: 'asset',
        assetId: backgroundAsset.id,
        colorFallback: '#050D10',
      },
    };
    const services = createAppServices({ initialProject, skipStoredProjectLoad: true });
    const repository = new SavingProjectRepository();
    const mirrorService = new RecordingMirrorService();
    services.projectRepository = repository;
    services.mirrorService = mirrorService;
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['hero-bytes'], { type: 'image/png' })),
    } as Response);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<EditorShell services={services} />);

    fireEvent.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mirror Now' }));
    await waitFor(() => expect(mirrorService.syncProject).toHaveBeenCalledTimes(1));
    mirrorService.syncProject.mockClear();

    await user.click(screen.getByRole('button', { name: 'Copy Slide 1 to clipboard' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copiedText = writeText.mock.calls[0]?.[0];
    expect(copiedText).toContain('asset-background');
    expect(copiedText).toContain('data:image/png;base64,aGVyby1ieXRlcw==');
    expect(
      screen.queryByText('Slide copied without media: file too large for the clipboard'),
    ).not.toBeInTheDocument();

    fireEvent.paste(window, {
      clipboardData: {
        getData: (type: string) => (type === 'text/plain' ? copiedText : ''),
      },
    });

    await waitFor(() => {
      const savedProject = repository.savedProjects.at(-1);
      const pastedPage = savedProject?.pages[1];
      expect(savedProject?.updatedAt).not.toBe(initialProject.updatedAt);
      expect(pastedPage?.background).toMatchObject({ type: 'asset' });
      if (pastedPage?.background.type !== 'asset') throw new Error('Expected an asset background.');
      expect(pastedPage.background.assetId).not.toBe('asset-background');
      expect(savedProject?.assets[pastedPage.background.assetId]).toMatchObject({
        objectUrl: 'data:image/png;base64,aGVyby1ieXRlcw==',
      });
      expect(savedProject?.assets[pastedPage.background.assetId]).not.toHaveProperty('fileName');
      expect(savedProject?.assets[pastedPage.background.assetId]).not.toHaveProperty('storage');
      expect(pastedPage.animationBuilds?.[0]?.elementId).toBe(pastedPage.elementIds[0]);
      expect(pastedPage.animationBuilds?.[0]?.id).not.toBe('build-image-hero');
    });
    await waitFor(() => {
      expect(mirrorService.syncProject).toHaveBeenCalledTimes(1);
    });
    const syncedProject = mirrorService.syncProject.mock.calls[0]?.[0];
    expect(syncedProject?.pages).toHaveLength(2);
  });

  it('copies a video over 200MB by reference and pastes a playable object URL', async () => {
    const user = userEvent.setup();
    const initialProject = sampleProject.createSampleProject();
    initialProject.assets['asset-hero'] = {
      ...initialProject.assets['asset-hero']!,
      fileName: 'hero.mp4',
      mimeType: 'video/mp4',
      name: 'Hero video',
      objectUrl: 'blob:https://localstudio.dev/hero',
      storage: 'file',
      type: 'video',
    };
    const services = createAppServices({ initialProject, skipStoredProjectLoad: true });
    const repository = new SavingProjectRepository();
    const materializeLocalAsset = vi.fn((fileName: string, blob: Blob) => {
      expect(blob.size).toBe(200 * 1024 * 1024);
      return Promise.resolve({
        fileName: `local-${fileName}`,
        objectUrl: 'blob:https://localstudio.dev/local-hero.mp4',
      });
    });
    services.projectRepository = Object.assign(repository, { materializeLocalAsset });
    const video = new Blob(['video-bytes'], { type: 'video/mp4' });
    Object.defineProperty(video, 'size', { value: 200 * 1024 * 1024 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      blob: () => Promise.resolve(video),
    } as Response);
    const blobToDataUrl = vi.spyOn(assetFileUtils, 'blobToDataUrl');
    let copiedText = '';
    document.execCommand = () => true;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        write: async (items: ClipboardItem[]) => {
          copiedText = (await (await items[0]?.getType('text/plain'))?.text()) ?? '';
        },
        writeText: (text: string) => {
          copiedText = text;
          return Promise.resolve();
        },
      },
    });

    render(<EditorShell services={services} />);
    await user.click(screen.getByRole('button', { name: 'Save now' }));
    const nameInput = screen.getByRole('textbox', { name: 'Project folder name' });
    await user.clear(nameInput);
    await user.type(nameInput, 'Stored Deck');
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy Slide 1 to clipboard' })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: 'Copy Slide 1 to clipboard' }));

    await waitFor(() => expect(copiedText).toContain('localstudio-clipboard:'));
    expect(
      screen.queryByText('Slide copied without media: file too large for the clipboard'),
    ).not.toBeInTheDocument();
    expect(blobToDataUrl).not.toHaveBeenCalled();
    expect(copiedText).not.toContain('data:');

    fireEvent.paste(window, {
      clipboardData: {
        getData: (type: string) => (type === 'text/plain' ? copiedText : ''),
      },
    });

    await waitFor(() => {
      const pastedAsset = Object.values(repository.savedProjects.at(-1)?.assets ?? {}).find(
        (asset) => asset.id !== 'asset-hero' && asset.name === 'Hero video',
      );
      expect(materializeLocalAsset).toHaveBeenCalled();
      expect(pastedAsset).toMatchObject({
        objectUrl: 'blob:https://localstudio.dev/local-hero.mp4',
        storage: 'file',
      });
      expect(pastedAsset?.fileName).toMatch(/^local-/);
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

    expect(
      await screen.findByRole('button', { name: 'new-system-image.png' }, { timeout: 5_000 }),
    ).toHaveAttribute('aria-pressed', 'true');
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

  it('replaces a screenshot with a copied slide before asset conversion finishes', async () => {
    const user = userEvent.setup();
    const initialProject = sampleProject.createSampleProject();
    initialProject.assets['asset-hero'] = {
      ...initialProject.assets['asset-hero']!,
      objectUrl: 'blob:https://localstudio.dev/hero',
    };
    const screenshot = new File(['screenshot'], 'Screenshot.png', { type: 'image/png' });
    const clipboardStore = {
      files: [screenshot] as File[],
      text: '',
      types: ['image/png', 'Files'],
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => undefined));
    document.execCommand = () => false;
    vi.spyOn(document, 'execCommand').mockImplementation((command) => {
      if (command !== 'copy') return false;
      const clipboardData = createClipboardData();
      fireEvent.copy(window, { clipboardData });
      const text = clipboardData.getData('text/plain');
      if (text.startsWith('LocalStudio.dev slide:')) {
        clipboardStore.files = [];
        clipboardStore.text = text;
        clipboardStore.types = ['text/plain'];
      }
      return true;
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        read: () =>
          Promise.resolve([
            {
              types: clipboardStore.types,
              getType: (type: string) =>
                Promise.resolve(
                  new Blob([type === 'text/plain' ? clipboardStore.text : 'image'], { type }),
                ),
            },
          ]),
        write: vi.fn(() => new Promise(() => undefined)),
      },
    });

    const services = createAppServices({ initialProject, skipStoredProjectLoad: true });
    services.projectRepository = new SavingProjectRepository();
    render(<EditorShell services={services} />);
    await user.click(screen.getByRole('button', { name: 'Save now' }));
    const nameInput = screen.getByRole('textbox', { name: 'Project folder name' });
    await user.clear(nameInput);
    await user.type(nameInput, 'Stored Deck');
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy Slide 1 to clipboard' })).toBeEnabled();
    });
    await selectTitleLayer(user);
    await user.click(screen.getByRole('button', { name: 'Copy Slide 1 to clipboard' }));

    expect(clipboardStore.types).toEqual(['text/plain']);
    expect(clipboardStore.text).toContain('"name":"Slide 1"');
    expect(clipboardStore.text).not.toContain('LocalStudio.dev editor elements');

    fireEvent.paste(window, {
      clipboardData: {
        files: [screenshot],
        getData: () => '',
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => screenshot }],
        types: ['image/png', 'Files'],
      },
    });

    expect(await screen.findByText('2 / 2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Screenshot.png' })).not.toBeInTheDocument();
  });

  it('imports a newer screenshot when its image type precedes stale slide text', async () => {
    const user = userEvent.setup();
    const screenshot = new File(['screenshot'], 'Newer Screenshot.png', { type: 'image/png' });
    document.execCommand = () => true;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        read: () =>
          Promise.resolve([
            {
              types: ['image/png', 'text/plain'],
              getType: (type: string) =>
                Promise.resolve(
                  new Blob(
                    [
                      type === 'text/plain'
                        ? 'LocalStudio.dev slide: {"page":{"id":"old"}}'
                        : 'image',
                    ],
                    { type },
                  ),
                ),
            },
          ]),
        write: () => Promise.resolve(),
        writeText: () => Promise.resolve(),
      },
    });

    render(<EditorShell services={createAppServices()} />);
    await user.click(screen.getByRole('button', { name: 'Copy Slide 1 to clipboard' }));
    await openLeftTab(user, 'Layout');
    fireEvent.paste(window, {
      clipboardData: {
        files: [screenshot],
        getData: () => '',
        items: [{ kind: 'file', type: 'image/png', getAsFile: () => screenshot }],
        types: ['image/png', 'Files'],
      },
    });

    expect(
      await screen.findByRole('button', { name: 'Newer Screenshot.png' }, { timeout: 5_000 }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });
});
