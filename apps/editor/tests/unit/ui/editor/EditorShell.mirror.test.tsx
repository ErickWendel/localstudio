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
      expect(mirrorService.syncProject).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Untitled AI Deck' }),
        repository,
        mirrorConfig,
      );
    });
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
        expect(mirrorService.syncProject).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Renamed Mirror Deck' }),
          repository,
          mirrorConfig,
        );
      },
      { timeout: 2000 },
    );
    await waitFor(() => {
      expect(mirrorService.deleteProject).toHaveBeenCalledWith('Untitled AI Deck', mirrorConfig);
    });
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
      expect(mirrorService.syncProject).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByRole('button', { name: 'Mirror up to date' })).toBeInTheDocument();
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

    expect(await screen.findByRole('button', { name: 'Save deck before mirroring' })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(await screen.findByRole('button', { name: 'Mirror up to date' })).toHaveClass(
      'mirror-synced',
    );
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
    expect(repository.importedFilePaths).toContain('project.json');
    expect(window.location.search).toBe('?project=Remote+Mirror+Deck');
  });

  it('restores mirroring from saved config and syncs the loaded local project', async () => {
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

    await waitFor(() => {
      expect(mirrorService.syncProject).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'mirrored-project', name: 'Mirrored Folder' }),
        repository,
        mirrorConfig,
      );
    });
  });
});
