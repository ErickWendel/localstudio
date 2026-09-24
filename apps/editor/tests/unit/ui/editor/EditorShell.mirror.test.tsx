import { fireEvent, act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const {
  DeferredLoadingProjectRepository,
  RecordingMirrorService,
  RemoteMirrorImportingProjectRepository,
  SavingProjectRepository,
  createAppServices,
  mirrorConfig,
} = editorShellTestHarness;

describe('EditorShell mirror workflows', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/editor/');
    vi.restoreAllMocks();
  });

  it('prompts the user to save before mirroring an unsaved project from the File menu', () => {
    render(<EditorShell services={createAppServices()} />);

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mirror Now' }));

    expect(screen.getByText('Save the project before mirroring.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Persistence disabled' })).toHaveClass(
      'persistence-attention',
    );
  });

  it('opens mirror settings when mirroring is requested without a saved mirror config', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.projectRepository = new SavingProjectRepository();
    services.mirrorService = new RecordingMirrorService(null);
    render(<EditorShell services={services} />);

    fireEvent.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mirror Now' }));

    expect(screen.getByRole('dialog', { name: 'Mirror settings' })).toBeInTheDocument();
  });

  it('syncs the current project after mirror settings are saved', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    const mirrorService = new RecordingMirrorService(null);
    services.projectRepository = repository;
    services.mirrorService = mirrorService;
    render(<EditorShell services={services} />);

    fireEvent.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mirror settings' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', {
        name: 'Mirror settings',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => {
      expect(mirrorService.syncProject).toHaveBeenCalled();
    });
    const syncCall = mirrorService.syncProject.mock.calls.find(
      ([syncedProject]) => syncedProject.name === 'Untitled AI Deck',
    );
    if (!syncCall) throw new Error('Expected mirror sync for Untitled AI Deck.');
    expect(syncCall[1]).toBe(repository);
    expect(syncCall[2]).toEqual(mirrorConfig);
    expect(typeof syncCall[3]?.onProgress).toBe('function');
  });

  it('mirrors the renamed project name from the header bar', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    const mirrorService = new RecordingMirrorService(null);
    services.projectRepository = repository;
    services.mirrorService = mirrorService;
    render(<EditorShell services={services} />);

    fireEvent.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mirror settings' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', {
        name: 'Mirror settings',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => {
      expect(mirrorService.syncProject).toHaveBeenCalledTimes(1);
    });
    mirrorService.syncProject.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Edit project name Untitled AI Deck' }));
    await user.clear(screen.getByRole('textbox', { name: 'Project name' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Project name' }),
      'Renamed Mirror Deck{Enter}',
    );

    await waitFor(
      () => {
        expect(
          mirrorService.syncProject.mock.calls.some(
            ([syncedProject]) => syncedProject.name === 'Renamed Mirror Deck',
          ),
        ).toBe(true);
      },
      { timeout: 2000 },
    );
    const renameSyncCall = mirrorService.syncProject.mock.calls.find(
      ([syncedProject]) => syncedProject.name === 'Renamed Mirror Deck',
    );
    if (!renameSyncCall) throw new Error('Expected mirror sync for Renamed Mirror Deck.');
    expect(renameSyncCall[1]).toBe(repository);
    expect(renameSyncCall[2]).toEqual(mirrorConfig);
    expect(typeof renameSyncCall[3]?.onProgress).toBe('function');
    await waitFor(() => {
      expect(mirrorService.deleteProject).toHaveBeenCalledWith('Untitled AI Deck', mirrorConfig);
    });
  });

  it('mirrors a duplicated project as new without deleting the source mirror', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    const mirrorService = new RecordingMirrorService(null);
    services.projectRepository = repository;
    services.mirrorService = mirrorService;
    render(<EditorShell services={services} />);

    fireEvent.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mirror settings' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', {
        name: 'Mirror settings',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mirror up to date' })).toBeInTheDocument();
    });
    mirrorService.syncProject.mockClear();
    mirrorService.deleteProject.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    const duplicateDialog = screen.getByRole('dialog', { name: 'Duplicate project' });
    const folderNameInput = within(duplicateDialog).getByLabelText('Project folder name');
    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'Cloud Copy');
    await user.click(within(duplicateDialog).getByRole('button', { name: 'Choose folder' }));

    await waitFor(() => {
      expect(mirrorService.syncProject).toHaveBeenCalledTimes(1);
    });
    const duplicatedProject = mirrorService.syncProject.mock.calls[0]?.[0];
    expect(duplicatedProject).toMatchObject({
      name: 'Cloud Copy',
    });
    expect(duplicatedProject?.id).not.toBe(services.initialProject.id);
    expect(mirrorService.deleteProject).not.toHaveBeenCalled();
  });

  it('toggles mirroring from the mirror status icon when a saved config is available', async () => {
    const services = createAppServices();
    const mirrorService = new RecordingMirrorService();
    const repository = new DeferredLoadingProjectRepository();
    services.projectRepository = repository;
    services.mirrorService = mirrorService;
    render(<EditorShell services={services} />);

    act(() => {
      repository.resolveLoadedProject({
        ...services.initialProject,
        name: 'Mirrored Folder',
      });
    });

    const mirrorButton = await screen.findByRole('button', { name: 'Mirror up to date' });
    fireEvent.click(mirrorButton);

    expect(mirrorService.clearConfig).not.toHaveBeenCalled();
    expect(screen.getByText('Local only')).toBeInTheDocument();

    const disabledMirrorButton = screen.getByRole('button', { name: 'Mirror disabled' });
    expect(disabledMirrorButton).not.toBeDisabled();
    fireEvent.click(disabledMirrorButton);

    await waitFor(() => {
      expect(mirrorService.syncProject).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByRole('button', { name: 'Mirror up to date' })).toBeInTheDocument();
  });

  it('does not restart mirror sync when the same project is queued while syncing', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const mirrorService = new RecordingMirrorService();
    const repository = new DeferredLoadingProjectRepository();
    let resolveSync: (() => void) | undefined;
    services.projectRepository = repository;
    services.mirrorService = mirrorService;
    mirrorService.syncProject.mockImplementation((project, projectRepository, config, options) => {
      void project;
      void projectRepository;
      void config;
      void options;
      return new Promise((resolve) => {
        resolveSync = () => resolve({ enabled: true, status: 'synced' });
      });
    });

    render(<EditorShell services={services} />);

    act(() => {
      repository.resolveLoadedProject({
        ...services.initialProject,
        name: 'Mirrored Folder',
      });
    });

    expect(mirrorService.syncProject).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mirror Now' }));
    expect(mirrorService.syncProject).toHaveBeenCalledTimes(1);

    act(() => {
      resolveSync?.();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mirror up to date' })).toBeInTheDocument();
    });
    expect(mirrorService.syncProject).toHaveBeenCalledTimes(1);
  });

  it('does not move displayed mirror progress backwards during one sync', async () => {
    const services = createAppServices();
    const mirrorService = new RecordingMirrorService();
    const repository = new DeferredLoadingProjectRepository();
    let reportProgress: ((current: number) => void) | undefined;
    let resolveSync: (() => void) | undefined;
    services.projectRepository = repository;
    services.mirrorService = mirrorService;
    mirrorService.syncProject.mockImplementation((project, projectRepository, config, options) => {
      void project;
      void projectRepository;
      void config;
      reportProgress = (current) => {
        options?.onProgress?.({ current, label: `Mirrored file ${current}`, total: 5 });
      };
      reportProgress(3);
      return new Promise((resolve) => {
        resolveSync = () => resolve({ enabled: true, status: 'synced' });
      });
    });

    render(<EditorShell services={services} />);

    act(() => {
      repository.resolveLoadedProject({
        ...services.initialProject,
        name: 'Mirrored Folder',
      });
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mirror Now' }));
    expect(await screen.findByRole('status', { name: 'Mirror syncing 60%' })).toBeInTheDocument();

    act(() => {
      reportProgress?.(2);
    });

    expect(screen.getByRole('status', { name: 'Mirror syncing 60%' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Mirror syncing 40%' })).not.toBeInTheDocument();

    act(() => {
      resolveSync?.();
    });
  });

  it('keeps saved mirror config disabled after refreshing the page', async () => {
    const firstServices = createAppServices();
    const firstRepository = new DeferredLoadingProjectRepository();
    firstServices.projectRepository = firstRepository;
    firstServices.mirrorService = new RecordingMirrorService();
    const firstRender = render(<EditorShell services={firstServices} />);

    act(() => {
      firstRepository.resolveLoadedProject({
        ...firstServices.initialProject,
        name: 'Mirrored Folder',
      });
    });

    expect(await screen.findByRole('button', { name: 'Mirror up to date' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mirror settings' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', {
        name: 'Mirror settings',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Disable mirroring' }));

    expect(window.localStorage.getItem('ew-canvas-ai.mirror-enabled')).toBe('false');
    firstRender.unmount();

    const secondServices = createAppServices();
    const secondRepository = new DeferredLoadingProjectRepository();
    const secondMirrorService = new RecordingMirrorService();
    secondServices.projectRepository = secondRepository;
    secondServices.mirrorService = secondMirrorService;
    render(<EditorShell services={secondServices} />);

    act(() => {
      secondRepository.resolveLoadedProject({
        ...secondServices.initialProject,
        name: 'Mirrored Folder',
      });
    });

    expect(
      await screen.findByRole('button', { name: 'Save deck before mirroring' }),
    ).toBeInTheDocument();
    expect(secondMirrorService.syncProject).not.toHaveBeenCalled();
  });

  it('opens mirror settings from the disabled mirror icon after mirroring is disabled in settings', async () => {
    const services = createAppServices();
    const repository = new DeferredLoadingProjectRepository();
    services.projectRepository = repository;
    services.mirrorService = new RecordingMirrorService();
    render(<EditorShell services={services} />);

    act(() => {
      repository.resolveLoadedProject({
        ...services.initialProject,
        name: 'Mirrored Folder',
      });
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Mirror settings' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', {
        name: 'Mirror settings',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Disable mirroring' }));

    expect(screen.getByRole('button', { name: 'Mirror disabled' })).toHaveClass('mirror-disabled');

    fireEvent.click(screen.getByRole('button', { name: 'Mirror disabled' }));
    expect(screen.getByRole('dialog', { name: 'Mirror settings' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enable mirroring' }));

    expect(await screen.findByRole('button', { name: 'Mirror up to date' })).toHaveClass(
      'mirror-synced',
    );
  });

  it('tests mirror storage without uploading local font test files', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const mirrorService = new RecordingMirrorService();
    const getTestFontFiles = vi
      .spyOn(services.localFontMirrorService, 'getTestFontFiles')
      .mockResolvedValue([new File(['font'], 'local-font.woff2', { type: 'font/woff2' })]);
    const validateTestFontFiles = vi
      .spyOn(services.localFontMirrorService, 'validateTestFontFiles')
      .mockResolvedValue({});
    vi.spyOn(services.localFontMirrorService, 'getSettings').mockReturnValue({
      enabled: true,
      folderLabel: 'Local fonts',
      supported: true,
      systemHint: '~/Library/Fonts or /Library/Fonts',
    });
    vi.spyOn(services.localFontMirrorService, 'listAvailableFonts').mockResolvedValue([]);
    services.mirrorService = mirrorService;
    render(<EditorShell services={services} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mirror settings' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', {
        name: 'Mirror settings',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Test connection' }));

    await waitFor(() => {
      expect(mirrorService.listProjects).toHaveBeenCalledWith(mirrorConfig);
    });
    expect(getTestFontFiles).not.toHaveBeenCalled();
    expect(validateTestFontFiles).not.toHaveBeenCalled();
  });

  it('displays the remote project name after importing a mirrored project', async () => {
    const services = createAppServices();
    const repository = new RemoteMirrorImportingProjectRepository();
    const mirrorService = new RecordingMirrorService(mirrorConfig);
    services.projectRepository = repository;
    services.mirrorService = mirrorService;
    mirrorService.listProjects.mockResolvedValue([
      {
        id: 'Remote Mirror Deck',
        name: 'Remote Mirror Deck',
        syncedAt: '2026-06-30T10:00:00.000Z',
      },
    ]);
    mirrorService.downloadProject.mockResolvedValue([
      {
        path: 'project.json',
        blob: new Blob(
          [
            JSON.stringify({
              ...services.initialProject,
              id: 'remote-project',
              name: 'Remote Mirror Deck',
            }),
          ],
          { type: 'application/json' },
        ),
      },
    ]);
    render(<EditorShell services={services} />);

    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Import' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remote' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Import Remote Mirror Deck' }));

    expect(
      await screen.findByRole('button', { name: 'Edit project name Remote Mirror Deck' }),
    ).toBeInTheDocument();
    expect(repository.prepareImportMirrorFiles).toHaveBeenCalledTimes(1);
    const prepareCallOrder = repository.prepareImportMirrorFiles.mock.invocationCallOrder[0];
    const downloadCallOrder = mirrorService.downloadProject.mock.invocationCallOrder[0];
    if (!prepareCallOrder || !downloadCallOrder) {
      throw new Error('Expected remote import preparation and download calls.');
    }
    expect(prepareCallOrder).toBeLessThan(downloadCallOrder);
    expect(repository.importedFilePaths).toContain('project.json');
    expect(window.location.search).toBe('?project=Remote+Mirror+Deck');
  });

  it('restores mirroring from saved config without uploading during local restore', async () => {
    const repository = new DeferredLoadingProjectRepository();
    const mirrorService = new RecordingMirrorService();
    const services = createAppServices();
    services.projectRepository = repository;
    services.mirrorService = mirrorService;

    render(<EditorShell services={services} />);

    act(() => {
      repository.resolveLoadedProject({
        ...services.initialProject,
        id: 'mirrored-project',
        name: 'Mirrored Folder',
      });
    });

    expect(
      await screen.findByRole('button', { name: 'Edit project name Mirrored Folder' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();

    expect(mirrorService.syncProject).not.toHaveBeenCalled();
  });

  it('syncs the saved paste after an in-flight mirror misses the file-backed snapshot', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('blob unavailable'));
    window.localStorage.clear();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    const mirrorService = new RecordingMirrorService();
    let persistedReady = false;
    repository.readPersistedProject = () => {
      if (!persistedReady) return Promise.resolve(null);
      const saved = repository.savedProjects.at(-1);
      if (!saved) return Promise.resolve(null);
      return Promise.resolve({
        ...saved,
        assets: Object.fromEntries(
          Object.entries(saved.assets).map(([assetId, asset]) => [
            assetId,
            {
              ...asset,
              fileName: asset.fileName ?? `${assetId}.gif`,
              objectUrl: `blob:persisted-${assetId}`,
              storage: 'file' as const,
            },
          ]),
        ),
      });
    };
    services.projectRepository = repository;
    services.mirrorService = mirrorService;
    render(<EditorShell services={services} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Persistence disabled' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose folder' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mirror Now' }));
    await waitFor(() => expect(mirrorService.syncProject).toHaveBeenCalledTimes(1));
    mirrorService.syncProject.mockReset();
    let releaseSync: (state: { enabled: true; status: 'synced'; lastSyncedAt: string }) => void =
      () => undefined;
    mirrorService.syncProject.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSync = resolve;
        }),
    );

    fireEvent.paste(window, {
      clipboardData: {
        files: [],
        items: [],
        types: ['text/plain'],
        getData: (type: string) =>
          type === 'text/plain'
            ? `LocalStudio.dev slide: ${JSON.stringify({
                assets: {
                  'asset-gif': {
                    id: 'asset-gif',
                    type: 'image',
                    name: 'Pasted gif',
                    mimeType: 'image/gif',
                    objectUrl: 'blob:https://localstudio.dev/pasted.gif',
                    storage: 'file',
                    fileName: 'pasted.gif',
                  },
                },
                elements: [
                  {
                    id: 'gif-1',
                    type: 'gif',
                    assetId: 'asset-gif',
                    name: 'Pasted gif',
                    x: 10,
                    y: 10,
                    width: 200,
                    height: 200,
                    rotation: 0,
                    opacity: 1,
                  },
                ],
                page: {
                  id: 'page-pasted',
                  name: 'Pasted slide',
                  width: 1920,
                  height: 1080,
                  background: { type: 'color', color: '#111111' },
                  elementIds: ['gif-1'],
                },
              })}`
            : '',
      },
    });
    await waitFor(() => expect(repository.savedProjects.length).toBeGreaterThan(1));
    fireEvent.click(screen.getByRole('button', { name: 'File' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mirror Now' }));
    await waitFor(() => expect(mirrorService.syncProject).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 900));
    persistedReady = true;
    releaseSync({
      enabled: true,
      status: 'synced',
      lastSyncedAt: new Date().toISOString(),
    });

    await waitFor(() => expect(mirrorService.syncProject).toHaveBeenCalledTimes(2));
    const syncedProject = mirrorService.syncProject.mock.calls.at(-1)?.[0];
    expect(JSON.stringify(syncedProject?.assets)).toContain('blob:persisted-');
    expect(syncedProject?.pages).toHaveLength(2);
  });
});
