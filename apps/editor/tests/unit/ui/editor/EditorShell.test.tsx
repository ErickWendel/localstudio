import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type {
  WebMcpDemoWindow,
  WebMcpTool,
} from '../../../../src/services/webmcp/webMcpToolAdapter';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const {
  InvalidImageStockMediaService,
  ReadyStockMediaService,
  SavingProjectRepository,
  createAppServices,
  createProjectWithVideo,
  mockControllableVideoMetadataLoad,
  mockVideoMetadataLoad,
  openLeftTab,
  selectImageLayer,
  startFullscreenPresentation,
  stockImage,
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
