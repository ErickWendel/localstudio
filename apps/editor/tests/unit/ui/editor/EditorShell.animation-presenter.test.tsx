import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const {
  createAppServices,
  createProjectWithVideo,
  openLeftTab,
  selectImageLayer,
  startFullscreenPresentation,
} = editorShellTestHarness;

describe('EditorShell animation and presenter workflows', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/editor/');
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: undefined,
    });
    vi.restoreAllMocks();
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
});
