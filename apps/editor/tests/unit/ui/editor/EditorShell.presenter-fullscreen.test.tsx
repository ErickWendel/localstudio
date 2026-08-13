import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { BrowserPresenterSessionService } from '../../../../src/services/presenter/presenterSessionService';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const {
  LoadingProjectRepository,
  RecordingMirrorService,
  RecordingShareService,
  SavingProjectRepository,
  createAppServices,
  selectImageLayer,
  startFullscreenPresentation,
  waitForShareButtonReady,
} = editorShellTestHarness;

describe('EditorShell presenter fullscreen workflows', () => {
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

  it('keeps the remote control panel closed on editor load', async () => {
    const openRemoteControlSession = vi
      .spyOn(BrowserPresenterSessionService.prototype, 'openRemoteControlSession')
      .mockResolvedValue({
        code: 'peer-1',
        connectedControllerCount: 0,
        expiresAt: '2026-07-15T12:00:00.000Z',
        presenterDeviceId: 'presenter-device-1',
        presenterLabel: 'MacBook Pro',
        qrUrl: 'http://localhost:4176/joystick/?peer=peer-1',
        sessionId: 'remote-session-1',
        transport: 'peerjs',
      });

    render(<EditorShell services={createAppServices()} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(openRemoteControlSession).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('region', { name: 'Remote control this presentation' }),
    ).not.toBeInTheDocument();
  });

  it('opens presenter view with an audience fullscreen prompt and keeps the desktop remote panel closed', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Presentation play options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Presenter view' }));

    expect(openWindow).toHaveBeenCalledTimes(1);
    expect(popup.location.href).toContain('presenter=1');
    expect(screen.getByRole('dialog', { name: 'Audience Window' })).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Remote control this presentation' }),
    ).not.toBeInTheDocument();
    expect(requestFullscreen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Canvas workspace'));

    expect(
      screen.queryByRole('region', { name: 'Remote control this presentation' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enter full screen mode' }));

    await waitFor(() => {
      expect(requestFullscreen).toHaveBeenCalledTimes(1);
      expect(document.fullscreenElement).toBe(screen.getByLabelText('Canvas workspace'));
      expect(screen.queryByRole('dialog', { name: 'Audience Window' })).not.toBeInTheDocument();
    });

    fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));

    expect(popupClose).not.toHaveBeenCalled();
  });

  it('stops presenter click navigation when the presenter window closes before audience fullscreen', async () => {
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
    const popupClose = vi.fn();
    const popup = {
      close: popupClose,
      closed: false,
      location: { href: '' },
      postMessage: vi.fn(),
    } as unknown as Window;
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: vi.fn(() => popup),
    });
    const { container } = render(
      <EditorShell services={createAppServices({ initialProject: project })} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Presentation play options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Presenter view' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-mode',
        'presenter',
      );
    });

    const presenterSessionId = new URL(popup.location.href).searchParams.get('presenterSession');
    expect(presenterSessionId).toBeTruthy();
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          command: 'close',
          sessionId: presenterSessionId,
          source: 'localstudio-presenter-window',
          type: 'command',
        },
        origin: window.location.origin,
      }),
    );

    await waitFor(() => {
      expect(popupClose).toHaveBeenCalledTimes(1);
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview',
        'idle',
      );
      expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
        'data-animation-preview-mode',
        'idle',
      );
      expect(screen.queryByRole('dialog', { name: 'Audience Window' })).not.toBeInTheDocument();
    });

    fireEvent.mouseDown(container.querySelector('canvas')!);

    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('saves presenter recordings sent after a partial slide recording', async () => {
    const popup = {
      close: vi.fn(),
      closed: false,
      location: { href: '' },
      postMessage: vi.fn(),
    } as unknown as Window;
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: vi.fn(() => popup),
    });
    vi.spyOn(BrowserPresenterSessionService.prototype, 'openRemoteControlSession').mockResolvedValue({
      code: 'peer-recording',
      connectedControllerCount: 0,
      expiresAt: '2026-07-20T21:00:00.000Z',
      presenterDeviceId: 'presenter-device-recording',
      presenterLabel: 'MacBook Pro',
      qrUrl: 'http://localhost:4176/joystick/?peer=peer-recording',
      sessionId: 'remote-session-recording',
      transport: 'peerjs',
    });
    const repository = new SavingProjectRepository();
    const services = createAppServices();
    services.projectRepository = repository;
    render(<EditorShell services={services} />);

    fireEvent.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose folder' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Persistence enabled' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Presentation play options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Presenter view' }));
    const presenterSessionId = new URL(popup.location.href).searchParams.get('presenterSession');
    expect(presenterSessionId).toBeTruthy();
    const audioBlob = new Blob(['partial audio'], { type: 'audio/webm;codecs=opus' });

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          audioBlob,
          command: 'save-recording',
          recording: {
            id: 'partial-recording',
            name: 'Presenter recording',
            createdAt: '2026-07-20T20:00:00.000Z',
            updatedAt: '2026-07-20T20:00:00.000Z',
            durationMs: 1800,
            modelPresetId: 'web-speech-api',
            audio: {
              mimeType: 'audio/webm;codecs=opus',
              storage: 'inline',
            },
            segments: [
              {
                id: 'segment-1',
                text: '[Slide 1] Partial recording.',
                startMs: 0,
                endMs: 1800,
                final: true,
                pageId: 'page-1',
                pageIndex: 0,
                pageName: 'Slide 1',
              },
            ],
          },
          sessionId: presenterSessionId,
          source: 'localstudio-presenter-window',
          type: 'command',
        },
        origin: window.location.origin,
      }),
    );

    await waitFor(() => {
      expect(repository.savedProjects.at(-1)?.recordings?.['partial-recording']).toMatchObject({
        durationMs: 1800,
        segments: [
          expect.objectContaining({
            text: '[Slide 1] Partial recording.',
          }),
        ],
      });
    });
  });

  it('finalizes a checkpointed recording when the presenter closes and updates the existing public link', async () => {
    const popup = {
      close: vi.fn(),
      closed: false,
      location: { href: '' },
      postMessage: vi.fn(),
    } as unknown as Window;
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: vi.fn(() => popup),
    });
    vi.spyOn(BrowserPresenterSessionService.prototype, 'openRemoteControlSession').mockResolvedValue({
      code: 'peer-published-recording',
      connectedControllerCount: 0,
      expiresAt: '2026-08-14T12:00:00.000Z',
      presenterDeviceId: 'presenter-device-published-recording',
      presenterLabel: 'MacBook Pro',
      qrUrl: 'http://localhost:4176/joystick/?peer=peer-published-recording',
      sessionId: 'remote-session-published-recording',
      transport: 'peerjs',
    });
    const project = sampleProject.createSampleProject();
    project.recordings = {
      'recording-old': {
        id: 'recording-old',
        name: 'Older presenter recording',
        createdAt: '2026-08-12T12:00:00.000Z',
        updatedAt: '2026-08-12T12:00:00.000Z',
        durationMs: 1200,
        modelPresetId: 'web-speech-api',
        audio: {
          mimeType: 'audio/webm;codecs=opus',
          objectUrl: 'blob:recording-old',
          storage: 'inline',
        },
        segments: [
          {
            id: 'segment-old',
            text: 'The older public recording.',
            startMs: 0,
            endMs: 1200,
            final: true,
            pageId: 'page-1',
            pageIndex: 0,
            pageName: 'Slide 1',
          },
        ],
      },
    };
    const mirrorService = new RecordingMirrorService();
    const shareService = new RecordingShareService();
    const repository = new LoadingProjectRepository(project);
    const services = createAppServices();
    services.mirrorService = mirrorService;
    services.shareService = shareService;
    services.projectRepository = repository;
    services.persistenceAvailable = true;
    services.skipStoredProjectLoad = false;
    render(<EditorShell services={services} />);

    await waitForShareButtonReady();
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => {
      expect(shareService.updateShare).toHaveBeenCalledWith(
        'project-project-1',
        expect.any(Object),
        expect.any(Object),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close share panel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Presentation play options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Presenter view' }));
    const presenterSessionId = new URL(popup.location.href).searchParams.get('presenterSession');
    const audioBlob = new Blob(['latest audio'], { type: 'audio/webm;codecs=opus' });

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          audioChunk: audioBlob,
          command: 'recording-checkpoint',
          recording: {
            id: 'recording-latest',
            name: 'Latest presenter recording',
            createdAt: '2026-08-13T12:00:00.000Z',
            updatedAt: '2026-08-13T12:00:00.000Z',
            durationMs: 1800,
            modelPresetId: 'web-speech-api',
            audio: {
              mimeType: 'audio/webm;codecs=opus',
              storage: 'inline',
            },
            segments: [
              {
                id: 'segment-latest',
                text: 'The newest public recording.',
                startMs: 0,
                endMs: 1800,
                final: true,
                pageId: 'page-1',
                pageIndex: 0,
                pageName: 'Slide 1',
              },
            ],
          },
          sessionId: presenterSessionId,
          source: 'localstudio-presenter-window',
          type: 'command',
        },
        origin: window.location.origin,
      }),
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          command: 'close',
          sessionId: presenterSessionId,
          source: 'localstudio-presenter-window',
          type: 'command',
        },
        origin: window.location.origin,
      }),
    );

    await waitFor(
      () => {
        expect(
          shareService.updateShare.mock.calls.some(
            ([shareId, sharedProject]) =>
              shareId === 'project-project-1' &&
              Object.keys(sharedProject.recordings ?? {}).join(',') === 'recording-latest',
          ),
        ).toBe(true);
      },
      { timeout: 3_000 },
    );
    expect(repository.savedProjects.at(-1)?.recordings?.['recording-latest']).toBeDefined();
    expect(new Set(shareService.updateShare.mock.calls.map(([shareId]) => shareId))).toEqual(
      new Set(['project-project-1']),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByLabelText('Recording for public share')).toHaveValue('recording-latest');
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
