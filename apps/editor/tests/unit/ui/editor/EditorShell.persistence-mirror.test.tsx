import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { ProjectDocument } from '../../../../src/domain/documents/model';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type { VersionHistoryEntry } from '../../../../src/services/contracts/interfaces';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const {
  DeferredLoadingProjectRepository,
  ImportingProjectRepository,
  RecordingMirrorService,
  RejectingLoadProjectRepository,
  RejectingProjectRepository,
  RemoteMirrorImportingProjectRepository,
  SavingProjectRepository,
  VersionHistoryProjectRepository,
  createAppServices,
  mirrorConfig,
} = editorShellTestHarness;

describe('EditorShell persistence and mirror workflows', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/editor/');
    vi.restoreAllMocks();
  });

  it('toggles persistence from disabled to enabled', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.projectRepository = new SavingProjectRepository();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    expect(screen.getByRole('dialog', { name: 'Save local project' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Save local project' })).toHaveAttribute(
      'data-anchor',
      'persistence',
    );
    await user.clear(screen.getByRole('textbox', { name: 'Project folder name' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Project folder name' }),
      'Mirror Debug Deck',
    );
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));

    expect(screen.getByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit project name Mirror Debug Deck' }),
    ).toBeInTheDocument();
  });

  it('re-enables persistence without opening the folder setup again', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    expect(screen.getByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Persistence enabled' }));
    expect(screen.getByRole('button', { name: 'Persistence disabled' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));

    expect(screen.queryByRole('dialog', { name: 'Save local project' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();
    expect(repository.savedProjects).toHaveLength(2);
  });

  it('writes the persisted project name into the tab URL', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.projectRepository = new SavingProjectRepository();
    window.history.replaceState({}, '', '/');
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));

    expect(window.location.search).toBe('?project=Untitled+AI+Deck');
  });

  it('autosaves project changes after persistence is enabled', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    expect(repository.savedProjects.at(-1)?.name).toBe('Untitled AI Deck');

    await user.click(screen.getByRole('button', { name: 'Edit project name Untitled AI Deck' }));
    await user.clear(screen.getByRole('textbox', { name: 'Project name' }));
    await user.type(screen.getByRole('textbox', { name: 'Project name' }), 'Autosaved Deck{Enter}');

    expect(repository.savedProjects.at(-1)?.name).toBe('Autosaved Deck');
  });

  it('saves the current project as a new local folder from the File menu', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Save As...' }));

    expect(repository.savedProjectsAs).toHaveLength(1);
    expect(repository.savedProjectsAs[0]).toMatchObject({ name: 'Untitled AI Deck' });
  });

  it('keeps persistence disabled when the project folder cannot be saved', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.projectRepository = new RejectingProjectRepository();
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));

    expect(await screen.findByRole('button', { name: 'Persistence disabled' })).toBeInTheDocument();
  });

  it('prompts the user to save before mirroring an unsaved project from the File menu', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mirror Now' }));

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

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mirror Now' }));

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

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await user.click(screen.getByRole('button', { name: 'Mirror settings' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', {
        name: 'Mirror settings',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

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

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await user.click(screen.getByRole('button', { name: 'Mirror settings' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', {
        name: 'Mirror settings',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => {
      expect(mirrorService.syncProject).toHaveBeenCalledTimes(1);
    });
    mirrorService.syncProject.mockClear();

    await user.click(screen.getByRole('button', { name: 'Edit project name Untitled AI Deck' }));
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
    const user = userEvent.setup();
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
    await user.click(mirrorButton);

    expect(mirrorService.clearConfig).not.toHaveBeenCalled();
    expect(screen.getByText('Local only')).toBeInTheDocument();

    const disabledMirrorButton = screen.getByRole('button', { name: 'Mirror disabled' });
    expect(disabledMirrorButton).not.toBeDisabled();
    await user.click(disabledMirrorButton);

    await waitFor(() => {
      expect(mirrorService.syncProject).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByRole('button', { name: 'Mirror up to date' })).toBeInTheDocument();
  });

  it('keeps saved mirror config disabled after refreshing the page', async () => {
    const user = userEvent.setup();
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
    await user.click(screen.getByRole('button', { name: 'Mirror settings' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', {
        name: 'Mirror settings',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Disable mirroring' }));

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

    expect(await screen.findByRole('button', { name: 'Mirror disabled' })).toBeInTheDocument();
    expect(secondMirrorService.syncProject).not.toHaveBeenCalled();
  });

  it('opens mirror settings from the disabled mirror icon after mirroring is disabled in settings', async () => {
    const user = userEvent.setup();
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

    await user.click(await screen.findByRole('button', { name: 'Mirror settings' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', {
        name: 'Mirror settings',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Disable mirroring' }));

    expect(screen.getByRole('button', { name: 'Mirror disabled' })).toHaveClass('mirror-disabled');

    await user.click(screen.getByRole('button', { name: 'Mirror disabled' }));
    expect(screen.getByRole('dialog', { name: 'Mirror settings' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Enable mirroring' }));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(await screen.findByRole('button', { name: 'Mirror up to date' })).toHaveClass(
      'mirror-synced',
    );
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
    await user.click(screen.getByRole('menuitem', { name: 'Import' }));
    await user.click(screen.getByRole('menuitem', { name: 'Project' }));

    expect(
      await screen.findByRole('button', { name: 'Edit project name Imported LocalStudio Project' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();
    expect(window.location.search).toBe('?project=Imported+LocalStudio+Project');
  });

  it('displays the remote project name after importing a mirrored project', async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import' }));
    await user.click(screen.getByRole('menuitem', { name: 'Remote' }));
    await user.click(await screen.findByRole('button', { name: 'Import Remote Mirror Deck' }));

    expect(
      await screen.findByRole('button', { name: 'Edit project name Remote Mirror Deck' }),
    ).toBeInTheDocument();
    expect(repository.importedFilePaths).toContain('project.json');
    expect(window.location.search).toBe('?project=Remote+Mirror+Deck');
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
    await user.click(screen.getByRole('menuitem', { name: 'Import' }));
    await user.click(screen.getByRole('menuitem', { name: 'Project' }));

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
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    unmount();
    const secondServices = createAppServices();
    secondServices.projectRepository = new SavingProjectRepository();
    render(<EditorShell services={secondServices} />);

    expect(await screen.findByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();
  });

  it('refocuses the changed slide when selecting a history version on the active page', async () => {
    const user = userEvent.setup();
    const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView',
    );
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    const project = sampleProject.createSampleProject();
    const firstPageId = project.pages[0]!.id;
    const titleElement = project.elements['text-title'];
    if (titleElement?.type !== 'text') {
      throw new Error('Expected sample project to include a text-title text element.');
    }
    const versionProject: ProjectDocument = {
      ...project,
      elements: {
        ...project.elements,
        'text-title': {
          ...titleElement,
          text: 'Changed title in history',
        },
      },
    };
    const versionEntry: VersionHistoryEntry = {
      id: 'version-1',
      authorName: 'Local user',
      changeCount: 1,
      createdAt: '2026-07-06T12:00:00.000Z',
      fileName: 'version-1.json',
      firstChangedElementId: 'text-title',
      firstChangedPageId: firstPageId,
      projectName: project.name,
      summary: 'Version with title edit',
    };
    const services = createAppServices({ initialProject: project });
    services.projectRepository = new VersionHistoryProjectRepository(project, versionProject, [
      versionEntry,
    ]);
    window.localStorage.setItem('ew-canvas-ai.persistence-enabled', 'true');

    try {
      render(<EditorShell services={services} />);

      expect(await screen.findByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Version history' }));
      await screen.findByText('Version with title edit');
      scrollIntoView.mockClear();

      await user.click(screen.getByText('Version with title edit').closest('button')!);

      await waitFor(() => {
        expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
          'data-selected-elements',
          'text-title',
        );
      });
      expect(scrollIntoView).toHaveBeenCalled();
    } finally {
      if (scrollIntoViewDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoViewDescriptor);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
      }
    }
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

  it('disables persistence and keeps the initial project when startup restore fails', async () => {
    const services = createAppServices();
    services.projectRepository = new RejectingLoadProjectRepository();
    window.localStorage.setItem('ew-canvas-ai.persistence-enabled', 'true');

    render(<EditorShell services={services} />);

    expect(screen.getByText('Untitled AI Deck')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Persistence disabled' })).toBeInTheDocument();
    expect(window.localStorage.getItem('ew-canvas-ai.persistence-enabled')).toBe('false');
  });
});
