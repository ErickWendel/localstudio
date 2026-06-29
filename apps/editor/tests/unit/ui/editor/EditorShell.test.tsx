import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createAppServices as createRealAppServices } from '../../../../src/app/composition';
import type { Asset, ProjectDocument } from '../../../../src/domain/model';
import { createSampleProject } from '../../../../src/domain/sampleProject';
import type {
  BackgroundRemovalService,
  ProjectRepository,
  TranslatorService,
} from '../../../../src/services/interfaces';
import type { WebMcpDemoWindow, WebMcpTool } from '../../../../src/services/webMcpToolAdapter';
import { InMemoryModelSetupService } from '../../../../src/services/modelSetupService';
import { EditorShell } from '../../../../src/ui/editor/EditorShell';

function createAppServices(options: Parameters<typeof createRealAppServices>[0] = {}) {
  vi.stubGlobal('showDirectoryPicker', vi.fn());
  return createRealAppServices({
    initialProject: createSampleProject(),
    ...options,
  });
}

class InstantBackgroundRemovalService implements BackgroundRemovalService {
  prepareBackgroundRemoval(
    asset: Asset,
    options?: { onProgress?: (progress: number) => void },
  ): Promise<void> {
    void asset;
    options?.onProgress?.(100);
    return Promise.resolve();
  }

  previewBackgroundMask(): Promise<{ maskUrl: string; score: number }> {
    return Promise.resolve({ maskUrl: 'data:image/png;base64,test', score: 0.9 });
  }

  removeBackground(asset: Asset): Promise<{ asset: Asset }> {
    return Promise.resolve({ asset });
  }
}

class RejectingProjectRepository implements ProjectRepository {
  loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(null);
  }

  saveProject(): Promise<void> {
    return Promise.reject(new Error('Folder permission denied'));
  }
}

class RejectingLoadProjectRepository implements ProjectRepository {
  loadProject(): Promise<ProjectDocument | null> {
    return Promise.reject(new DOMException('Missing asset file', 'NotFoundError'));
  }

  saveProject(): Promise<void> {
    return Promise.resolve();
  }
}

class SavingProjectRepository implements ProjectRepository {
  savedProjects: ProjectDocument[] = [];

  loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(null);
  }

  saveProject(project: ProjectDocument): Promise<void> {
    this.savedProjects.push(project);
    return Promise.resolve();
  }
}

class RecordingTranslatorService implements TranslatorService {
  prepareTranslation = vi.fn(
    (
      sourceLanguage: string,
      targetLanguage: string,
      options?: { onProgress?: (progress: number) => void },
    ) => {
      void sourceLanguage;
      void targetLanguage;
      options?.onProgress?.(100);
      return Promise.resolve();
    },
  );

  translate = vi.fn((text: string, targetLanguage: string) =>
    Promise.resolve(`${targetLanguage}:${text}`),
  );

  detectLanguage = vi.fn(() => {
    return Promise.resolve('en');
  });
}

class ImportingProjectRepository implements ProjectRepository {
  savedProjects: ProjectDocument[] = [];

  constructor(private readonly project: ProjectDocument) {}

  importProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(this.project);
  }

  loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(null);
  }

  saveProject(project: ProjectDocument): Promise<void> {
    this.savedProjects.push(project);
    return Promise.resolve();
  }
}

class DeferredLoadingProjectRepository implements ProjectRepository {
  savedProjects: ProjectDocument[] = [];
  private resolveLoad: ((project: ProjectDocument | null) => void) | undefined;

  loadProject(): Promise<ProjectDocument | null> {
    return new Promise((resolve) => {
      this.resolveLoad = resolve;
    });
  }

  saveProject(project: ProjectDocument): Promise<void> {
    this.savedProjects.push(project);
    return Promise.resolve();
  }

  resolveLoadedProject(project: ProjectDocument | null) {
    this.resolveLoad?.(project);
  }
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function createClipboardData(options: { editorObject?: boolean; files?: File[] } = {}) {
  const data = new Map<string, string>();
  if (options.editorObject) data.set('application/x-localstudio-editor-elements', '1');

  return {
    files: options.files ?? [],
    items: [],
    types: Array.from(data.keys()),
    getData: vi.fn((type: string) => data.get(type) ?? ''),
    setData: vi.fn((type: string, value: string) => {
      data.set(type, value);
    }),
  };
}

function createReadyPrepareTranslationMock() {
  return vi.fn(
    (
      sourceLanguage: string,
      targetLanguage: string,
      options?: { onProgress?: (progress: number) => void },
    ) => {
      void sourceLanguage;
      void targetLanguage;
      options?.onProgress?.(100);
      return Promise.resolve();
    },
  );
}

async function openLeftTab(user: ReturnType<typeof userEvent.setup>, name: 'AI Tools' | 'Layout') {
  const tab = screen.getByRole('tab', { name });
  if (tab.getAttribute('aria-selected') !== 'true') {
    await user.click(tab);
  }
}

async function selectTitleLayer(user: ReturnType<typeof userEvent.setup>) {
  await openLeftTab(user, 'Layout');
  await user.click(screen.getByRole('button', { name: 'Title' }));
}

async function selectImageLayer(user: ReturnType<typeof userEvent.setup>) {
  await openLeftTab(user, 'Layout');
  await user.click(screen.getByRole('button', { name: 'Selected Image' }));
}

describe('EditorShell', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/editor/');
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: undefined,
    });
    delete (window as WebMcpDemoWindow).localStudioWebMcpTools;
  });

  it('registers WebMCP tools when explicitly enabled', async () => {
    const registerTools = vi.fn<(tools: WebMcpTool[]) => void>();
    window.history.pushState({}, '', '/editor/?webmcp=1');
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: { registerTools },
    });

    render(<EditorShell services={createAppServices()} />);

    await waitFor(() => {
      expect(registerTools).toHaveBeenCalled();
    });
    const tools = registerTools.mock.calls[0]?.[0] ?? [];
    expect(tools.map((tool) => tool.name)).toEqual([
      'create_project',
      'generate_slides',
      'generate_image',
      'translate_text',
      'get_project_snapshot',
    ]);
  });

  it('exposes same-origin demo tools when WebMCP runtime is unavailable', async () => {
    window.history.pushState({}, '', '/editor/?webmcp=1');

    render(<EditorShell services={createAppServices()} />);

    await waitFor(() => {
      expect((window as WebMcpDemoWindow).localStudioWebMcpTools).toHaveLength(5);
    });
    expect((window as WebMcpDemoWindow).localStudioWebMcpTools?.map((tool) => tool.name)).toEqual([
      'create_project',
      'generate_slides',
      'generate_image',
      'translate_text',
      'get_project_snapshot',
    ]);
  });

  it('renders the approved editor shell landmarks', async () => {
    render(<EditorShell services={createAppServices()} />);

    expect(screen.getByText('LocalStudio.dev')).toBeInTheDocument();
    expect(screen.getByText('Untitled AI Deck')).toBeInTheDocument();
    expect(screen.getByText('PT')).toBeInTheDocument();
    expect(await screen.findByText('EN')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prompt actions' })).toBeInTheDocument();
    expect(screen.getByLabelText('Create image prompt')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute('data-selected-elements', '');
  });

  it('does not select any element on startup', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute('data-selected-elements', '');

    await openLeftTab(user, 'Layout');
    expect(screen.getByRole('button', { name: 'Selected Image' })).toHaveAttribute('aria-pressed', 'false');
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
    await selectImageLayer(user);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Selected Image' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();
  });

  it('undoes and redoes editor mutations with keyboard shortcuts', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
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
    expect(screen.getByRole('button', { name: 'Selected Image' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Title' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Subtitle' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('renames the project from the toolbar', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'Edit project name Untitled AI Deck' }));
    await user.clear(screen.getByRole('textbox', { name: 'Project name' }));
    await user.type(screen.getByRole('textbox', { name: 'Project name' }), 'Browser Deck{Enter}');

    expect(screen.getByRole('button', { name: 'Edit project name Browser Deck' })).toBeInTheDocument();
  });

  it('toggles persistence from disabled to enabled', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.projectRepository = new SavingProjectRepository();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));

    expect(screen.getByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();
  });

  it('writes the persisted project name into the tab URL', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.projectRepository = new SavingProjectRepository();
    window.history.replaceState({}, '', '/');
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));

    expect(window.location.search).toBe('?project=Untitled+AI+Deck');
  });

  it('autosaves project changes after persistence is enabled', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    expect(repository.savedProjects.at(-1)?.name).toBe('Untitled AI Deck');

    await user.click(screen.getByRole('button', { name: 'Edit project name Untitled AI Deck' }));
    await user.clear(screen.getByRole('textbox', { name: 'Project name' }));
    await user.type(screen.getByRole('textbox', { name: 'Project name' }), 'Autosaved Deck{Enter}');

    expect(repository.savedProjects.at(-1)?.name).toBe('Autosaved Deck');
  });

  it('keeps persistence disabled when the project folder cannot be saved', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.projectRepository = new RejectingProjectRepository();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));

    expect(await screen.findByRole('button', { name: 'Persistence disabled' })).toBeInTheDocument();
  });

  it('imports an existing project from the File menu', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.projectRepository = new ImportingProjectRepository({
      ...services.initialProject,
      id: 'imported-project',
      name: 'Imported LocalStudio Project',
    });
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import Project' }));

    expect(
      await screen.findByRole('button', { name: 'Edit project name Imported LocalStudio Project' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();
    expect(window.location.search).toBe('?project=Imported+LocalStudio+Project');
  });

  it('preserves hydrated sample hero object URLs during import normalization', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new ImportingProjectRepository({
      ...services.initialProject,
      id: 'imported-project',
      name: 'Imported Hydrated Project',
      assets: {
        ...services.initialProject.assets,
        'asset-hero': {
          ...services.initialProject.assets['asset-hero']!,
          objectUrl: 'blob:hydrated-hero',
          storage: 'file',
          fileName: 'asset-hero.png',
        },
      },
    });
    services.projectRepository = repository;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import Project' }));

    await screen.findByRole('button', { name: 'Edit project name Imported Hydrated Project' });
    expect(repository.savedProjects).toHaveLength(0);
  });

  it('opens a blank project in a new tab from the File menu', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'New Project' }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0]?.[0]).toContain('newProject=1');
    expect(openSpy.mock.calls[0]?.[1]).toBe('_blank');
    expect(openSpy.mock.calls[0]?.[2]).toContain('noopener');
    openSpy.mockRestore();
  });

  it('restores enabled persistence after remounting', async () => {
    const user = userEvent.setup();
    const firstServices = createAppServices();
    firstServices.projectRepository = new SavingProjectRepository();
    const { unmount } = render(<EditorShell services={firstServices} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    unmount();
    const secondServices = createAppServices();
    secondServices.projectRepository = new SavingProjectRepository();
    render(<EditorShell services={secondServices} />);

    expect(await screen.findByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();
  });

  it('loads the last project before autosaving on startup', async () => {
    const repository = new DeferredLoadingProjectRepository();
    const services = createAppServices();
    services.projectRepository = repository;
    window.localStorage.setItem('ew-canvas-ai.persistence-enabled', 'true');
    render(<EditorShell services={services} />);

    expect(repository.savedProjects).toHaveLength(0);

    act(() => {
      repository.resolveLoadedProject({
        ...services.initialProject,
        id: 'last-project',
        name: 'Restored LocalStudio Project',
      });
    });

    expect(
      await screen.findByRole('button', { name: 'Edit project name Restored LocalStudio Project' }),
    ).toBeInTheDocument();
    expect(repository.savedProjects).toHaveLength(0);
  });

  it('disables persistence and keeps the initial project when startup restore fails', async () => {
    const services = createAppServices();
    services.projectRepository = new RejectingLoadProjectRepository();
    window.localStorage.setItem('ew-canvas-ai.persistence-enabled', 'true');

    render(<EditorShell services={services} />);

    expect(screen.getByText('Untitled AI Deck')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Persistence disabled' })).toBeInTheDocument();
    expect(window.localStorage.getItem('ew-canvas-ai.persistence-enabled')).toBe('false');
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
    expect(screen.queryByRole('button', { name: 'stale-system-image.png' })).not.toBeInTheDocument();
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

  it('inserts text and images from the floating toolbar', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    render(<EditorShell services={services} />);
    await openLeftTab(user, 'Layout');
    await selectImageLayer(user);

    await user.click(screen.getByRole('button', { name: 'Insert Text' }));
    await waitFor(() => {
      expect(
        screen
          .getAllByRole('button', { name: /text-/ })
          .find((element) => element.getAttribute('aria-pressed') === 'true'),
      ).toBeTruthy();
    });
    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await waitFor(() => {
      const insertedText = Object.values(repository.savedProjects.at(-1)?.elements ?? {}).find(
        (element) =>
          element.type === 'text' &&
          element.id !== 'text-title' &&
          element.id !== 'text-subtitle',
      );
      expect(insertedText).toMatchObject({
        type: 'text',
        text: 'Add a heading',
        width: 600,
        height: 240,
        fontFamily: 'Orbitron',
        fontSize: 96,
        fontWeight: 800,
        fill: '#37FD76',
        align: 'center',
      });
    });

    const image = new File(['image-bytes'], 'toolbar-image.png', { type: 'image/png' });
    await selectImageLayer(user);
    await user.click(screen.getByRole('button', { name: 'Insert Image' }));
    await user.upload(screen.getByLabelText('Insert image file'), image);

    expect(await screen.findByRole('button', { name: 'toolbar-image.png' })).toHaveAttribute(
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

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await user.click(screen.getByRole('button', { name: 'Selected Image' }));

    await user.keyboard('{Backspace}');
    expect(screen.queryByRole('button', { name: 'Selected Image' })).not.toBeInTheDocument();
  });

  it('duplicates, centers, and changes z-order from the floating toolbar', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);

    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(screen.getByRole('button', { name: 'Selected Image copy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Align Center' }));
    await user.click(screen.getByRole('button', { name: 'Send Backward' }));
    await user.click(screen.getByRole('button', { name: 'Bring Forward' }));

    expect(screen.getByRole('button', { name: 'Selected Image copy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('translates selected text from the floating toolbar', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    await selectTitleLayer(user);
    await user.click(screen.getByRole('button', { name: 'Translate Selected Text' }));

    await waitFor(() => {
      expect(translator.translate).toHaveBeenCalledWith('AI Design Revolution', 'pt', {
        sourceLanguage: 'en',
      });
    });
  });

  it('updates the header language chip after translating the current slide', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.translatorService = new RecordingTranslatorService();
    render(<EditorShell services={services} />);

    expect(await screen.findByRole('button', { name: 'Current slide language English' })).toBeInTheDocument();
    expect((services.translatorService as RecordingTranslatorService).detectLanguage).toHaveBeenCalledWith(
      expect.any(String),
      { allowModelPreparation: false },
    );

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    expect(await screen.findByText('Pair: en → pt')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Translate Slide 1' })[0]!);

    expect(await screen.findByRole('button', { name: 'Current slide language Portuguese' })).toBeInTheDocument();
    expect(screen.getByText('Pair: pt → pt')).toBeInTheDocument();
  });

  it('ignores repeated translate clicks while a translation is running', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translation = createDeferred<string>();
    const translate = vi.fn().mockReturnValue(translation.promise);
    services.translatorService = {
      detectLanguage: vi.fn().mockResolvedValue('en'),
      prepareTranslation: createReadyPrepareTranslationMock(),
      translate,
    };
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'es');
    await selectTitleLayer(user);
    await user.dblClick(screen.getByRole('button', { name: 'Translate Selected Text' }));

    expect(translate).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Translating text...')).toBeInTheDocument();

    translation.resolve('Texto traducido');
  });

  it('shows translation errors instead of leaving an unhandled promise', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.translatorService = {
      detectLanguage: vi.fn().mockResolvedValue('en'),
      prepareTranslation: createReadyPrepareTranslationMock(),
      translate: vi.fn().mockRejectedValue(new Error('Chrome Built-in AI translation is not ready.')),
    };
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'es');
    await selectTitleLayer(user);
    await user.click(screen.getByRole('button', { name: 'Translate Selected Text' }));

    expect(await screen.findByText('Chrome Built-in AI translation is not ready.')).toBeInTheDocument();
  });

  it('fits translated selected text back into the original text frame', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    const translate = vi.fn().mockResolvedValue('Revolucion\n de diseno impulsada por inteligencia artificial');
    services.projectRepository = repository;
    services.translatorService = {
      detectLanguage: vi.fn().mockResolvedValue('en'),
      prepareTranslation: createReadyPrepareTranslationMock(),
      translate,
    };
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'es');
    await selectTitleLayer(user);
    await user.click(screen.getByRole('button', { name: 'Translate Selected Text' }));

    await waitFor(() => {
      expect(translate).toHaveBeenCalledWith('AI Design Revolution', 'es', {
        sourceLanguage: 'en',
      });
    });
    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));

    await waitFor(() => {
      const title = repository.savedProjects.at(-1)?.elements['text-title'];
      expect(title).toMatchObject({
        fontSize: 96,
        text: 'Revolucion de diseno impulsada por inteligencia artificial',
      });
      expect(title?.width).toBeGreaterThan(600);
    });
  });

  it('redirects the first translation attempt to AI Tools until a target language is selected', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await selectTitleLayer(user);
    await user.click(screen.getByRole('button', { name: 'Translate Selected Text' }));

    expect(screen.getByRole('tab', { name: 'AI Tools' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Translate to')).toHaveValue('');
    expect(translator.translate).not.toHaveBeenCalled();
  });

  it('translates every visible unlocked text element on the current slide', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    await user.click(screen.getAllByRole('button', { name: 'Translate Slide 1' })[0]!);

    await waitFor(() => {
      expect(translator.translate).toHaveBeenCalledWith('AI Design Revolution', 'pt', {
        sourceLanguage: 'en',
      });
      expect(translator.translate).toHaveBeenCalledWith('Browser-native creative automation', 'pt', {
        sourceLanguage: 'en',
      });
    });
  });

  it('uses the prepared source language when translating back to another language', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translate = vi.fn().mockResolvedValue('AI Design Revolution');
    services.translatorService = {
      detectLanguage: vi
        .fn()
        .mockResolvedValueOnce('es')
        .mockResolvedValue('gl'),
      prepareTranslation: createReadyPrepareTranslationMock(),
      translate,
    };
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'en');
    await selectTitleLayer(user);
    await user.click(screen.getByRole('button', { name: 'Translate Selected Text' }));

    await waitFor(() => {
      expect(translate).toHaveBeenCalledWith('AI Design Revolution', 'en', {
        sourceLanguage: 'es',
      });
    });
  });

  it('translates the full deck from the Edit menu', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const translator = new RecordingTranslatorService();
    services.translatorService = translator;
    render(<EditorShell services={services} />);

    await openLeftTab(user, 'AI Tools');
    await user.selectOptions(screen.getByLabelText('Translate to'), 'pt');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('menuitem', { name: 'Translate Deck' }));

    await waitFor(() => {
      expect(translator.translate).toHaveBeenCalledWith('AI Design Revolution', 'pt', {
        sourceLanguage: 'en',
      });
      expect(translator.translate).toHaveBeenCalledWith('Browser-native creative automation', 'pt', {
        sourceLanguage: 'en',
      });
    });
  });

  it('blocks background subject selection until image editing models are downloaded', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);

    await user.click(screen.getByRole('button', { name: 'BG Remover' }));

    expect(screen.getByText('You must download the image editing tools first.')).toBeInTheDocument();
    expect(
      screen.queryByText('Right click adds areas to keep. Left click applies the background removal.'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BG Remover' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'AI Tools' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Download Image Editing Models' })).toHaveClass(
      'icon-button-attention',
    );

    await user.keyboard('{Escape}');

    expect(screen.queryByText('You must download the image editing tools first.')).not.toBeInTheDocument();
  });

  it('enters and cancels background subject selection after image editing models are ready', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.modelSetupService = new InMemoryModelSetupService();
    services.backgroundRemovalService = new InstantBackgroundRemovalService();
    await services.modelSetupService.downloadModel('image-editing-models');

    render(<EditorShell services={services} />);
    await selectImageLayer(user);

    await user.click(screen.getByRole('button', { name: 'BG Remover' }));

    expect(
      await screen.findByText('Right click adds areas to keep. Left click applies the background removal.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel BG Remover' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(
      screen.queryByText('Right click adds areas to keep. Left click applies the background removal.'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BG Remover' })).toBeInTheDocument();
  });

  it('exports the current slide as a PNG file', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const downloadDataUrl = vi.fn();
    services.exportService = {
      getPageImageFileName: () => 'slide.png',
      getPdfFileName: () => 'deck.pdf',
      downloadDataUrl,
    };

    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Export' }));

    expect(downloadDataUrl).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/png/), 'slide.png');
  });

  it('does not show the page size overlay on the canvas', () => {
    render(<EditorShell services={createAppServices()} />);

    expect(screen.queryByText('1920 x 1080')).not.toBeInTheDocument();
  });
});
