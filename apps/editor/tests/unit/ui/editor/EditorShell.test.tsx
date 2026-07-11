import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { unzipSync } from 'fflate';
import { vi } from 'vitest';
import type { ProjectDocument } from '../../../../src/domain/documents/model';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type {
  PresentationExportProgress,
  PresentationExportResult,
  PresentationExportService,
  VersionHistoryEntry,
} from '../../../../src/services/contracts/interfaces';
import type {
  WebMcpDemoWindow,
  WebMcpTool,
} from '../../../../src/services/webmcp/webMcpToolAdapter';
import { modelSetupService } from '../../../../src/services/model-setup/modelSetupService';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const {
  DeferredLoadingProjectRepository,
  ImportingProjectRepository,
  InstantBackgroundRemovalService,
  InvalidImageStockMediaService,
  ReadyStockMediaService,
  RecordingMirrorService,
  RejectingLoadProjectRepository,
  RejectingProjectRepository,
  RemoteMirrorImportingProjectRepository,
  SavingProjectRepository,
  VersionHistoryProjectRepository,
  createAppServices,
  createProjectWithVideo,
  enableSyncedSharing,
  mirrorConfig,
  mockControllableVideoMetadataLoad,
  mockVideoMetadataLoad,
  openLeftTab,
  selectImageLayer,
  startFullscreenPresentation,
  stockImage,
  waitForShareButtonReady,
} = editorShellTestHarness;

describe('EditorShell', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/editor/');
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: undefined,
    });
    delete (window as WebMcpDemoWindow).localStudioWebMcpTools;
    vi.restoreAllMocks();
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
    expect(screen.getByRole('button', { name: 'Selected Image' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('clears element selection when selecting a page from the pages panel', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    project.pages = [
      project.pages[0]!,
      {
        ...project.pages[0]!,
        id: 'page-2',
        name: 'Slide 2',
      },
    ];
    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await selectImageLayer(user);
    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
      'data-selected-elements',
      'image-hero',
    );

    await user.click(screen.getByRole('button', { name: 'Toggle pages panel' }));
    await user.click(screen.getByRole('button', { name: 'Select Slide 2' }));

    await waitFor(() => {
      expect(screen.getByText('2 / 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute('data-selected-elements', '');
    });
  });

  it('inserts and selects a shape from the Elements panel', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await openLeftTab(user, 'Elements');
    await user.click(screen.getByRole('button', { name: 'Add triangle' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-selected-elements',
        expect.stringMatching(/^shape-/),
      );
    });
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.getByLabelText('Selected shape fill mode')).toBeInTheDocument();

    await openLeftTab(user, 'Layout');
    expect(screen.getByRole('button', { name: 'Background Shape' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('inserts and selects an Unsplash image from the Elements panel', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const stockMediaService = new ReadyStockMediaService();
    services.stockMediaService = stockMediaService;

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Elements');
    await user.click(await screen.findByRole('button', { name: 'Insert image by Ada Photo' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-selected-elements',
        expect.stringMatching(/^image-/),
      );
    });
    expect(stockMediaService.trackedItems).toEqual([stockImage]);
  });

  it('inserts and selects a GIPHY GIF movie from the Elements panel', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    mockVideoMetadataLoad();
    services.stockMediaService = new ReadyStockMediaService();

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Elements');
    await user.click(await screen.findByRole('button', { name: 'Insert GIF Launch GIF' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-selected-elements',
        expect.stringMatching(/^video-/),
      );
    });
    expect(screen.getByLabelText('Launch GIF').tagName.toLowerCase()).toBe('video');
    expect(screen.getByLabelText('Launch GIF')).toHaveAttribute(
      'src',
      'https://media.giphy.com/media/gif-1/giphy.mp4',
    );
  });

  it('shows a generic API key error when stock image search is rejected', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.stockMediaService = new InvalidImageStockMediaService();

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Elements');

    expect(await screen.findByText('API Key is invalid')).toBeInTheDocument();
    expect(
      screen.queryByText('Unsplash image search failed with 401 Unauthorized.'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Configure media integrations' }));

    expect(screen.getByRole('dialog', { name: 'Media integrations' })).toBeInTheDocument();
  });

  it('keeps the Animations panel open after media integration settings are saved', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.stockMediaService = new ReadyStockMediaService();

    render(<EditorShell services={services} />);

    await openLeftTab(user, 'Animate');
    expect(screen.getByRole('tab', { name: 'Animate' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: 'Mirror settings' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', {
        name: 'Media integrations',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Save media integrations' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Media integrations' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('tab', { name: 'Animate' })).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to the layout panel from the header view menu', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'View' }));
    await user.click(screen.getByRole('menuitem', { name: 'Toggle Layers Panel' }));

    expect(screen.getByRole('tab', { name: 'Layout' })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps pages and tool panels mutually exclusive', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'Toggle pages panel' }));
    expect(screen.getByLabelText('Pages')).toBeInTheDocument();

    await openLeftTab(user, 'Layout');

    expect(screen.getByText('4 layers on current page')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pages')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Toggle pages panel' }));

    expect(screen.getByLabelText('Pages')).toBeInTheDocument();
    expect(screen.queryByText('4 layers on current page')).not.toBeInTheDocument();
  });

  it('marks the workspace as zoomed out when the user scales below 100%', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'Zoom Out' }));

    expect(screen.getByLabelText('Canvas workspace')).toHaveClass('workspace-column-zoomed-out');
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

    await user.click(screen.getByRole('button', { name: 'Edit project name Untitled AI Deck' }));
    await user.clear(screen.getByRole('textbox', { name: 'Project name' }));
    await user.type(screen.getByRole('textbox', { name: 'Project name' }), 'Browser Deck{Enter}');

    expect(
      screen.getByRole('button', { name: 'Edit project name Browser Deck' }),
    ).toBeInTheDocument();
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

  it('zooms the canvas from the toolbar', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'Zoom In' }));
    expect(screen.getByText('110%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zoom Out' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('keeps insert quick actions visible after adding a second slide', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getAllByRole('button', { name: 'Add page' })[0]!);

    expect(screen.getByRole('button', { name: 'Rename Slide 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert Text' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert Media' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Insert Text' }));
    await openLeftTab(user, 'Layout');
    expect(screen.getByRole('button', { name: 'Add a heading' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('duplicates the active slide with copied elements and remapped animations', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    project.pages[0] = {
      ...project.pages[0]!,
      animationBuilds: [
        {
          id: 'build-image-hero',
          elementId: 'image-hero',
          effect: 'reveal',
          trigger: 'on-click',
          delayMs: 0,
        },
      ],
    };

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await user.click(screen.getByRole('button', { name: 'Duplicate Slide 1' }));

    expect(screen.getByRole('button', { name: 'Rename Slide 1 copy' })).toBeInTheDocument();
    expect(screen.getByLabelText('Animation build 1 for Image')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert Text' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert Media' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Insert Text' }));
    await openLeftTab(user, 'Layout');
    expect(screen.getByRole('button', { name: 'Add a heading' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await openLeftTab(user, 'Animate');
    expect(screen.getByRole('listitem', { name: 'Build 1: Image' })).toBeInTheDocument();
  });

  it('starts animation preview when playing the presentation from the toolbar', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    project.pages[0] = {
      ...project.pages[0]!,
      transition: { effect: 'reveal', delayMs: 0 },
      animationBuilds: [
        {
          id: 'build-image-hero',
          elementId: 'image-hero',
          effect: 'reveal',
          trigger: 'on-click',
          delayMs: 0,
        },
      ],
    };

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await startFullscreenPresentation(user);

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview',
        'playing',
      );
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-mode',
        'presenter',
      );
    });
    expect(screen.queryByLabelText('Animation build 1 for Image')).not.toBeInTheDocument();
  });

  it('opens keyboard shortcuts with question mark while presenting fullscreen', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await startFullscreenPresentation(user);
    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-mode',
        'presenter',
      );
    });

    fireEvent.keyDown(window, { key: '?' });

    expect(screen.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeInTheDocument();
  });

  it('starts animation preview from the Animate panel play button', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    project.pages[0] = {
      ...project.pages[0]!,
      animationBuilds: [
        {
          id: 'build-image-hero',
          elementId: 'image-hero',
          effect: 'reveal',
          trigger: 'on-click',
          delayMs: 0,
        },
      ],
    };

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await openLeftTab(user, 'Animate');
    await user.click(screen.getByRole('button', { name: 'Play animation preview' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview',
        'playing',
      );
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-mode',
        'editor',
      );
      expect(screen.getByText('Click the slide to play the next animation.')).toBeInTheDocument();
    });
  });

  it('advances click-triggered animation preview with the right arrow key', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    project.pages[0] = {
      ...project.pages[0]!,
      transition: { effect: 'reveal', delayMs: 0 },
      animationBuilds: [
        {
          id: 'build-image-hero',
          elementId: 'image-hero',
          effect: 'reveal',
          trigger: 'on-click',
          delayMs: 0,
        },
      ],
    };

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await startFullscreenPresentation(user);

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-waiting',
        'true',
      );
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-mode',
        'presenter',
      );
    });

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(
        screen.queryByText('Click the slide to play the next animation.'),
      ).not.toBeInTheDocument();
    });
  });

  it.each(['ArrowRight', ']'])(
    'starts pending movie-start builds from the %s presentation shortcut',
    async (key) => {
      const user = userEvent.setup();
      const playSpy = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockImplementation(() => Promise.resolve());
      const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
      const project = createProjectWithVideo();
      project.pages[0] = {
        ...project.pages[0]!,
        transition: { effect: 'reveal', delayMs: 0 },
        animationBuilds: [
          {
            id: 'build-video-demo',
            elementId: 'video-demo',
            effect: 'reveal',
            trigger: 'on-click',
            delayMs: 0,
            durationMs: 0,
            mediaAction: 'play',
          },
        ],
      };

      render(<EditorShell services={createAppServices({ initialProject: project })} />);

      await startFullscreenPresentation(user);
      await waitFor(() => {
        expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
          'data-animation-preview-waiting',
          'true',
        );
      });

      fireEvent.keyDown(window, { key });

      expect(playSpy).toHaveBeenCalledTimes(1);
      playSpy.mockRestore();
      pauseSpy.mockRestore();
    },
  );

  it('uses arrow keys to move between slides after the current preview step completes', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    project.pages = [
      {
        ...project.pages[0]!,
        transition: { effect: 'reveal', delayMs: 0 },
        animationBuilds: [
          {
            id: 'build-image-hero',
            elementId: 'image-hero',
            effect: 'reveal',
            trigger: 'on-click',
            delayMs: 0,
          },
        ],
      },
      {
        id: 'page-2',
        name: 'Slide 2',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
        elementIds: [],
        animationBuilds: [],
      },
    ];

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    await startFullscreenPresentation(user);

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-waiting',
        'true',
      );
    });

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(
        screen.queryByText('Click the slide to play the next animation.'),
      ).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-phase',
        'complete',
      );
    });

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getByText('2 / 2')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'ArrowLeft' });

    await waitFor(() => {
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
    });
  });

  it('uses slide clicks to move between slides in presenter mode after the current preview step completes', async () => {
    const user = userEvent.setup();
    let fullscreenElement: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: vi.fn(() => {
        fullscreenElement = document.querySelector('[aria-label="Canvas workspace"]');
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      }),
    });
    const project = sampleProject.createSampleProject();
    project.pages = [
      {
        ...project.pages[0]!,
        transition: { effect: 'reveal', delayMs: 0 },
        animationBuilds: [
          {
            id: 'build-image-hero',
            elementId: 'image-hero',
            effect: 'reveal',
            trigger: 'on-click',
            delayMs: 0,
          },
        ],
      },
      {
        id: 'page-2',
        name: 'Slide 2',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
        elementIds: [],
        animationBuilds: [],
      },
    ];
    const { container } = render(
      <EditorShell services={createAppServices({ initialProject: project })} />,
    );

    await startFullscreenPresentation(user);

    await waitFor(() => {
      expect(document.fullscreenElement).toBe(screen.getByLabelText('Canvas workspace'));
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-waiting',
        'true',
      );
    });

    fireEvent.mouseDown(container.querySelector('canvas')!);

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-phase',
        'complete',
      );
    });

    fireEvent.mouseDown(container.querySelector('canvas')!);

    await waitFor(() => {
      expect(screen.getByText('2 / 2')).toBeInTheDocument();
    });
  });

  it('plays the current slide by default and can play from the beginning from the toolbar menu', async () => {
    const user = userEvent.setup();
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    const project = sampleProject.createSampleProject();
    project.pages = [
      project.pages[0]!,
      {
        id: 'page-2',
        name: 'Slide 2',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
        elementIds: [],
        animationBuilds: [],
      },
      {
        id: 'page-3',
        name: 'Slide 3',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
        elementIds: [],
        animationBuilds: [],
      },
    ];

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await user.click(screen.getByRole('button', { name: 'Activate Slide 3' }));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

    await startFullscreenPresentation(user);

    await waitFor(() => {
      expect(screen.getByText('3 / 3')).toBeInTheDocument();
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-mode',
        'presenter',
      );
    });

    await user.click(screen.getByRole('button', { name: 'Presentation play options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Play from beginning' }));

    await waitFor(() => {
      expect(screen.getByText('1 / 3')).toBeInTheDocument();
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-mode',
        'presenter',
      );
    });
  });

  it('keeps the remote control panel closed on editor load', async () => {
    render(<EditorShell services={createAppServices()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.queryByRole('region', { name: 'Remote control this presentation' }),
    ).not.toBeInTheDocument();
  });

  it('opens presenter view with an audience fullscreen prompt and keeps the remote session on fullscreen exit', async () => {
    const user = userEvent.setup();
    let fullscreenElement: Element | null = null;
    const popupClose = vi.fn();
    const popupPostMessage = vi.fn();
    const popup = {
      close: popupClose,
      closed: false,
      location: { href: '' },
      postMessage: popupPostMessage,
    } as unknown as Window;
    const openWindow = vi.fn(() => popup);
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: openWindow,
    });
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    const requestFullscreen = vi.fn(() => {
      fullscreenElement = document.querySelector('[aria-label="Canvas workspace"]');
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });

    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'Presentation play options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Presenter view' }));

    expect(openWindow).toHaveBeenCalledTimes(1);
    expect(popup.location.href).toContain('presenter=1');
    expect(screen.getByRole('dialog', { name: 'Audience Window' })).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Remote control this presentation' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Remote control QR code' })).toHaveAttribute(
      'src',
      expect.stringContaining('data:image/png'),
    );
    expect(screen.getByRole('button', { name: 'Copy remote link' })).toBeInTheDocument();
    expect(requestFullscreen).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText('Canvas workspace'));

    expect(
      screen.queryByRole('region', { name: 'Remote control this presentation' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Enter full screen mode' }));

    await waitFor(() => {
      expect(requestFullscreen).toHaveBeenCalledTimes(1);
      expect(document.fullscreenElement).toBe(screen.getByLabelText('Canvas workspace'));
      expect(screen.queryByRole('dialog', { name: 'Audience Window' })).not.toBeInTheDocument();
    });

    fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));

    expect(popupClose).not.toHaveBeenCalled();
  });

  it('hides page insert controls in fullscreen presenter mode and restores a clean editor state on exit', async () => {
    const user = userEvent.setup();
    let fullscreenElement: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: vi.fn(() => {
        fullscreenElement = document.querySelector('[aria-label="Canvas workspace"]');
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      }),
    });
    const project = sampleProject.createSampleProject();
    project.pages = [
      {
        ...project.pages[0]!,
        animationBuilds: [
          {
            id: 'build-image-hero',
            elementId: 'image-hero',
            effect: 'reveal',
            trigger: 'on-click',
            delayMs: 0,
          },
        ],
      },
      {
        id: 'page-2',
        name: 'Slide 2',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
        elementIds: [],
        animationBuilds: [],
      },
    ];

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await selectImageLayer(user);
    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
      'data-selected-elements',
      'image-hero',
    );
    expect(screen.getByRole('button', { name: 'Add page after Slide 1' })).toBeInTheDocument();

    await startFullscreenPresentation(user);

    await waitFor(() => {
      expect(document.fullscreenElement).toBe(screen.getByLabelText('Canvas workspace'));
      expect(
        screen.queryByRole('button', { name: 'Add page after Slide 1' }),
      ).not.toBeInTheDocument();
    });

    fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add page after Slide 1' })).toBeInTheDocument();
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview',
        'idle',
      );
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute('data-selected-elements', '');
    });
  });

  it('keeps the stopped presentation slide active after exiting fullscreen', async () => {
    const user = userEvent.setup();
    let fullscreenElement: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: vi.fn(() => {
        fullscreenElement = document.querySelector('[aria-label="Canvas workspace"]');
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      }),
    });
    const project = sampleProject.createSampleProject();
    project.pages = [
      {
        ...project.pages[0]!,
        transition: { effect: 'reveal', delayMs: 0 },
        animationBuilds: [],
      },
      {
        id: 'page-2',
        name: 'Slide 2',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
        elementIds: [],
        animationBuilds: [],
      },
    ];

    render(<EditorShell services={createAppServices({ initialProject: project })} />);

    await startFullscreenPresentation(user);

    await waitFor(() => {
      expect(document.fullscreenElement).toBe(screen.getByLabelText('Canvas workspace'));
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getByText('2 / 2')).toBeInTheDocument();
    });

    fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));

    await waitFor(() => {
      expect(screen.getByText('2 / 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview',
        'idle',
      );
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute('data-selected-elements', '');
    });
  });

  it('inserts text and media from the floating toolbar', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    render(<EditorShell services={services} />);
    await openLeftTab(user, 'Layout');
    await selectImageLayer(user);

    await user.click(screen.getByRole('button', { name: 'Insert Text' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add a heading' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    await waitFor(() => {
      const insertedText = Object.values(repository.savedProjects.at(-1)?.elements ?? {}).find(
        (element) =>
          element.type === 'text' && element.id !== 'text-title' && element.id !== 'text-subtitle',
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
    await user.click(screen.getByRole('button', { name: 'Insert Media' }));
    await user.upload(screen.getByLabelText('Insert media file'), image);

    expect(await screen.findByRole('button', { name: 'toolbar-image.png' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    mockVideoMetadataLoad();
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:toolbar-video');
    const video = new File(['video-bytes'], 'toolbar-video.mp4', { type: 'video/mp4' });
    await user.click(screen.getByRole('button', { name: 'Insert Media' }));
    await user.upload(screen.getByLabelText('Insert media file'), video);

    await waitFor(() => {
      const savedProject = repository.savedProjects.at(-1);
      const importedVideo = Object.values(savedProject?.elements ?? {}).find(
        (element) => element.type === 'video',
      );
      expect(importedVideo).toMatchObject({
        autoplayInPreview: true,
        playing: true,
        type: 'video',
      });
      expect(savedProject?.assets[importedVideo?.assetId ?? '']?.name).toBe('toolbar-video.mp4');
      expect(savedProject?.assets[importedVideo?.assetId ?? '']?.objectUrl).toBe(
        'blob:toolbar-video',
      );
    });
    expect(createObjectUrl).toHaveBeenCalledWith(video);
    expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Movie' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Selected video trim end')).toHaveValue('8.5');
  });

  it('shows loading feedback while local video metadata is imported', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.projectRepository = new SavingProjectRepository();
    const metadata = mockControllableVideoMetadataLoad();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pending-video');
    render(<EditorShell services={services} />);

    const video = new File(['video-bytes'], 'pending-video.mp4', { type: 'video/mp4' });
    await user.click(screen.getByRole('button', { name: 'Insert Media' }));
    await user.upload(screen.getByLabelText('Insert media file'), video);

    expect(await screen.findByText('Loading media')).toBeInTheDocument();
    expect(
      screen.getByText('Loading video metadata without copying the full file into memory.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(metadata.hasMetadataTarget()).toBe(true);
    });

    act(() => {
      metadata.loadMetadata();
    });

    await waitFor(() => {
      expect(screen.queryByText('Loading media')).not.toBeInTheDocument();
    });
    metadata.createElementSpy.mockRestore();
  });

  it('blocks MOV uploads with a clear unsupported-format message', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL');
    render(<EditorShell services={services} />);

    const video = new File(['video-bytes'], 'phone-video.mov', { type: 'video/quicktime' });
    await user.click(screen.getByRole('button', { name: 'Insert Media' }));
    const input = screen.getByLabelText('Insert media file');
    expect(input).toHaveAttribute('accept', 'image/*,video/*');
    await user.upload(input, video);

    expect(await screen.findByText('Unsupported video format')).toBeInTheDocument();
    expect(screen.getByText('Supported formats')).toBeInTheDocument();
    expect(screen.getByText('info')).toHaveClass('media-import-info-icon');
    expect(screen.getByText(/Video import supports MP4 and WebM files/)).toBeInTheDocument();
    expect(
      screen.queryByRole('progressbar', { name: 'Media import progress' }),
    ).not.toBeInTheDocument();
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(
      Object.values(repository.savedProjects.at(-1)?.assets ?? {}).some(
        (asset) => asset.name === 'phone-video.mov',
      ),
    ).toBe(false);

    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByText('Unsupported video format')).not.toBeInTheDocument();
  });

  it('opens the media settings panel when a video layer is selected', async () => {
    const user = userEvent.setup();
    render(
      <EditorShell services={createAppServices({ initialProject: createProjectWithVideo() })} />,
    );

    await openLeftTab(user, 'Layout');
    await user.click(screen.getByRole('button', { name: 'Demo clip' }));

    expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Movie' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Selected video repeat mode')).toBeInTheDocument();
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

  it('blocks background subject selection until image editing models are downloaded', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);
    await selectImageLayer(user);

    await user.click(screen.getByRole('button', { name: 'BG Remover' }));

    expect(
      screen.getByText('You must download the image editing tools first.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Right click adds areas to keep. Left click applies the background removal.',
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BG Remover' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'AI Tools' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Download Image Editing Models' })).toHaveClass(
      'icon-button-attention',
    );

    await user.keyboard('{Escape}');

    expect(
      screen.queryByText('You must download the image editing tools first.'),
    ).not.toBeInTheDocument();
  });

  it('enters and cancels background subject selection after image editing models are ready', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.modelSetupService = new modelSetupService.InMemoryModelSetupService();
    services.backgroundRemovalService = new InstantBackgroundRemovalService();
    await services.modelSetupService.downloadModel('image-editing-models');

    render(<EditorShell services={services} />);
    await selectImageLayer(user);

    await user.click(screen.getByRole('button', { name: 'BG Remover' }));

    expect(
      await screen.findByText(
        'Right click adds areas to keep. Left click applies the background removal.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel BG Remover' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(
      screen.queryByText(
        'Right click adds areas to keep. Left click applies the background removal.',
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BG Remover' })).toBeInTheDocument();
  });

  it('opens Share before MinIO is synced and disables only public link creation', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    await user.click(screen.getByRole('button', { name: 'Share' }));

    expect(screen.getByRole('heading', { name: 'Share design' })).toBeInTheDocument();
    expect(
      screen.getByText('Public links cannot be created without remote storage.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Present' })).not.toBeDisabled();
  });

  it('exports the current slide as a PNG file', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    enableSyncedSharing(services);
    const downloadDataUrl = vi.fn();
    services.exportService = {
      getImagesArchiveFileName: () => 'deck-images.zip',
      getPageImageFileName: () => 'slide.png',
      getPdfFileName: () => 'deck.pdf',
      getPowerPointFileName: () => 'deck.pptx',
      downloadBlob: vi.fn(),
      downloadDataUrl,
    };

    render(<EditorShell services={services} />);

    await waitForShareButtonReady();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(downloadDataUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^data:image\/png/),
      'slide.png',
    );
  });

  it('exports all slides as PNG files in one ZIP archive from the File menu', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    const firstPage = project.pages[0];
    if (!firstPage) throw new Error('Sample project must contain a page.');
    const multiSlideProject: ProjectDocument = {
      ...project,
      pages: [
        firstPage,
        {
          ...firstPage,
          id: 'page-2',
          name: 'Hidden Summary',
          visible: false,
        },
      ],
    };
    const services = createAppServices({ initialProject: multiSlideProject });
    const downloadBlob = vi.fn();
    services.exportService = {
      getImagesArchiveFileName: () => 'deck-images.zip',
      getPageImageFileName: (_project, pageId) =>
        pageId === 'page-1' ? 'deck-slide-1.png' : 'deck-hidden-summary.png',
      getPdfFileName: () => 'deck.pdf',
      getPowerPointFileName: () => 'deck.pptx',
      downloadBlob,
      downloadDataUrl: vi.fn(),
    };

    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export to' }));
    await user.click(screen.getByRole('menuitem', { name: 'Images (.zip)' }));

    expect(screen.getByRole('dialog', { name: 'Export images' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Create an image for each animation' }),
    ).not.toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Image format' })).toHaveValue('png');
    await user.click(screen.getByRole('button', { name: 'Export images' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Exporting slide images...');
    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'deck-images.zip');
    });
    const [archiveBlob] = downloadBlob.mock.calls[0] as [Blob, string];
    const archiveFiles = unzipSync(new Uint8Array(await archiveBlob.arrayBuffer()));

    expect(Object.keys(archiveFiles).sort()).toEqual([
      'deck-hidden-summary.png',
      'deck-slide-1.png',
    ]);
  });

  it('exports a single readable final-state image when animation images are disabled', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    const firstPage = project.pages[0];
    if (!firstPage) throw new Error('Sample project must contain a page.');
    const configuredProject: ProjectDocument = {
      ...project,
      pages: [
        {
          ...firstPage,
          animationBuilds: [
            {
              id: 'build-title',
              delayMs: 0,
              effect: 'fade',
              elementId: 'text-title',
              trigger: 'on-click',
            },
            {
              id: 'build-subtitle-out',
              delayMs: 0,
              effect: 'fade',
              elementId: 'text-subtitle',
              kind: 'build-out',
              trigger: 'on-click',
            },
          ],
        },
      ],
    };
    const services = createAppServices({ initialProject: configuredProject });
    const downloadBlob = vi.fn();
    services.exportService = {
      getImagesArchiveFileName: () => 'deck-images.zip',
      getPageImageFileName: (_project, _pageId, extension) => `deck-slide-1.${extension}`,
      getPdfFileName: () => 'deck.pdf',
      getPowerPointFileName: () => 'deck.pptx',
      downloadBlob,
      downloadDataUrl: vi.fn(),
    };

    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export to' }));
    await user.click(screen.getByRole('menuitem', { name: 'Images (.zip)' }));
    await user.click(screen.getByRole('button', { name: 'Export images' }));

    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'deck-images.zip');
    });
    const [archiveBlob] = downloadBlob.mock.calls[0] as [Blob, string];
    const archiveFiles = unzipSync(new Uint8Array(await archiveBlob.arrayBuffer()));

    expect(Object.keys(archiveFiles)).toEqual(['deck-slide-1.png']);
  });

  it('applies image export range, format, and animation options', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    const firstPage = project.pages[0];
    if (!firstPage) throw new Error('Sample project must contain a page.');
    const configuredProject: ProjectDocument = {
      ...project,
      pages: [
        {
          ...firstPage,
          animationBuilds: [
            {
              id: 'build-title',
              delayMs: 0,
              effect: 'fade',
              elementId: 'text-title',
              trigger: 'on-click',
            },
          ],
        },
        {
          ...firstPage,
          id: 'page-2',
          name: 'Appendix',
        },
      ],
    };
    const services = createAppServices({ initialProject: configuredProject });
    const downloadBlob = vi.fn();
    services.exportService = {
      getImagesArchiveFileName: () => 'deck-images.zip',
      getPageImageFileName: (_project, pageId, extension) =>
        pageId === 'page-1' ? `deck-slide-1.${extension}` : `deck-appendix.${extension}`,
      getPdfFileName: () => 'deck.pdf',
      getPowerPointFileName: () => 'deck.pptx',
      downloadBlob,
      downloadDataUrl: vi.fn(),
    };

    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export to' }));
    await user.click(screen.getByRole('menuitem', { name: 'Images (.zip)' }));
    await user.click(screen.getByRole('radio', { name: /From:/ }));
    await user.clear(screen.getByRole('spinbutton', { name: 'From slide' }));
    await user.type(screen.getByRole('spinbutton', { name: 'From slide' }), '1');
    await user.clear(screen.getByRole('spinbutton', { name: 'To slide' }));
    await user.type(screen.getByRole('spinbutton', { name: 'To slide' }), '1');
    await user.click(screen.getByRole('checkbox', { name: 'Create an image for each animation' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Image format' }), 'jpeg');
    await user.click(screen.getByRole('button', { name: 'Export images' }));

    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'deck-images.zip');
    });
    const [archiveBlob] = downloadBlob.mock.calls[0] as [Blob, string];
    const archiveFiles = unzipSync(new Uint8Array(await archiveBlob.arrayBuffer()));

    expect(Object.keys(archiveFiles)).toEqual(['deck-slide-1-animation-01.jpeg']);
  });

  it('exports PowerPoint with stats and clears the operation notice', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const downloadBlob = vi.fn();
    services.exportService = {
      getImagesArchiveFileName: () => 'deck-images.zip',
      getPageImageFileName: () => 'slide.png',
      getPdfFileName: () => 'deck.pdf',
      getPowerPointFileName: () => 'deck.pptx',
      downloadBlob,
      downloadDataUrl: vi.fn(),
    };
    let resolvePowerPointExport: ((value: PresentationExportResult) => void) | undefined;
    let reportPowerPointProgress: ((progress: PresentationExportProgress) => void) | undefined;
    services.presentationExportService = {
      exportPowerPoint: vi.fn<PresentationExportService['exportPowerPoint']>((_project, options) => {
        reportPowerPointProgress = options?.onProgress;
        options?.onProgress?.({
          current: 2,
          detail: 'Hero slide',
          label: 'Building slide 2 of 4',
          stage: 'building-slides',
          total: 4,
        });
        return new Promise<PresentationExportResult>((resolve) => {
          resolvePowerPointExport = resolve;
        });
      }),
    } satisfies PresentationExportService;

    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export to' }));
    await user.click(screen.getByRole('menuitem', { name: 'Powerpoint (.pptx)' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Exporting PowerPoint...');
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Building slide 2 of 4');
      expect(screen.getByRole('status')).toHaveTextContent('Hero slide');
      expect(screen.getByLabelText('2 of 4')).toBeInTheDocument();
    });
    reportPowerPointProgress?.({
      detail: 'Checking media targets, content types, and timing targets.',
      label: 'Validating PowerPoint package',
      stage: 'validating-package',
    });
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Validating PowerPoint package');
      expect(screen.getByRole('status')).toHaveTextContent(
        'Checking media targets, content types, and timing targets.',
      );
    });
    resolvePowerPointExport?.({
      blob: new Blob(['pptx']),
      stats: {
        animationBuildCount: 2,
        mediaElementCount: 3,
        slideCount: 4,
      },
      warnings: [
        {
          code: 'pptx-animation-effect-downgraded',
          message: 'Animation was downgraded.',
        },
        {
          code: 'pptx-video-playback-downgraded',
          message: 'Video playback was downgraded.',
        },
      ],
    });
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'PowerPoint exported: 4 slides, 3 media items, 2 animation builds; 1 animation fallback, 1 media fallback.',
      );
    });
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'deck.pptx');

    await waitFor(
      () => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      },
      { timeout: 4000 },
    );
  });

  it('creates and shows a public link from the share panel', async () => {
    const user = userEvent.setup();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000301');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    });
    const services = createAppServices();
    enableSyncedSharing(services);

    render(<EditorShell services={services} />);

    await waitForShareButtonReady();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    const expectedPublicUrl = `${
      window.location.origin
    }/editor/s/00000000-0000-4000-8000-000000000301?src=${encodeURIComponent(
      'http://localhost:9000/localstudio/mirrors/public-shares/00000000-0000-4000-8000-000000000301/share.json',
    )}`;
    expect(await screen.findByDisplayValue(expectedPublicUrl)).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expectedPublicUrl);
  });

  it('enters fullscreen presentation mode from the share panel', async () => {
    const user = userEvent.setup();
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    const services = createAppServices();
    enableSyncedSharing(services);

    render(<EditorShell services={services} />);

    await waitForShareButtonReady();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    await user.click(screen.getByRole('button', { name: 'Present' }));

    expect(requestFullscreen).toHaveBeenCalled();
    expect(requestFullscreen.mock.instances[0]).toBe(screen.getByLabelText('Canvas workspace'));
  });

  it('shows speaker notes as a Canva-style side panel with controls', async () => {
    const user = userEvent.setup();
    render(<EditorShell services={createAppServices()} />);

    const notesToggle = screen.getByRole('button', { name: 'Toggle notes panel' });
    expect(notesToggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('heading', { name: 'Page 1 - Slide 1' })).not.toBeInTheDocument();

    await user.click(notesToggle);

    expect(notesToggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Page 1 - Slide 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Timer' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change notes text size' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close notes panel' })).toBeInTheDocument();
    expect(screen.getByText('0/5000')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Speaker notes'), 'Opening note');

    expect(screen.getByText('12/5000')).toBeInTheDocument();

    await user.click(notesToggle);
    expect(screen.queryByRole('heading', { name: 'Page 1 - Slide 1' })).not.toBeInTheDocument();
  });

  it('does not show the page size overlay on the canvas', () => {
    render(<EditorShell services={createAppServices()} />);

    expect(screen.queryByText('1920 x 1080')).not.toBeInTheDocument();
  });
});
