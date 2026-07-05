import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { PresenterView } from '../../../../src/ui/presenter/PresenterView';

const remoteStreamPublisherMock = vi.hoisted(() => {
  let onPeerId: ((peerId: string | undefined) => void) | undefined;
  const publisher = {
    start: vi.fn(),
    stop: vi.fn(),
  };
  return {
    create: vi.fn((options: {
      onPeerId: (peerId: string | undefined) => void;
    }) => {
      onPeerId = options.onPeerId;
      return publisher;
    }),
    getOnPeerId: () => onPeerId,
    publisher,
  };
});

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,remote-qr'),
  },
}));

vi.mock('../../../../src/ui/presenter/presenterRemoteStreamPublisher', () => ({
  presenterRemoteStreamPublisher: {
    create: remoteStreamPublisherMock.create,
  },
}));

describe('PresenterView', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/editor/?presenter=1&presenterSession=session-1');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-03T22:47:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows and persists the first-run presenter window message', () => {
    render(<PresenterView sessionId="session-1" />);

    expect(screen.getByRole('heading', { name: 'Presenter Window' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: "Don't show this message again" }));
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));

    expect(window.localStorage.getItem('localstudio.presenterWindowIntroDismissed')).toBe('1');
    expect(screen.queryByRole('heading', { name: 'Presenter Window' })).not.toBeInTheDocument();
  });

  it('renders presenter state with timer, slide previews, and notes zoom controls', () => {
    window.localStorage.setItem('localstudio.presenterWindowIntroDismissed', '1');
    render(<PresenterView sessionId="session-1" />);

    const project = sampleProject.createSampleProject();
    project.pages[0] = {
      ...project.pages[0]!,
      animationBuilds: [
        {
          delayMs: 0,
          durationMs: 300,
          effect: 'fade',
          elementId: 'text-title',
          id: 'build-1',
          trigger: 'on-click',
        },
      ],
      speakerNotes: 'Open with the Web AI timing story.',
    };
    project.pages.push({
      id: 'page-2',
      name: 'Slide 2',
      width: 1920,
      height: 1080,
      background: { type: 'color', color: '#111111' },
      elementIds: [],
      speakerNotes: 'Second slide notes',
    });
    project.pages.push(
      {
        id: 'page-3',
        name: 'Slide 3',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#222222' },
        elementIds: [],
        speakerNotes: 'Third slide notes',
      },
      {
        id: 'page-4',
        name: 'Slide 4',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#333333' },
        elementIds: [],
        speakerNotes: 'Fourth slide notes',
      },
    );
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: {
            payload: {
              activePageId: 'page-1',
              animationPreview: {
                activeBuild: undefined,
                activeBuildElementId: 'text-title',
                animationProgress: 0,
                hiddenElementIds: ['text-title'],
                mode: 'presenter',
                pageId: 'page-1',
                phase: 'waiting',
                playing: true,
                waitingForClick: true,
              },
              project,
            },
            sessionId: 'session-1',
            source: 'localstudio-presenter-main',
            type: 'state',
          },
        }),
      );
    });

    expect(screen.getByLabelText('Presenter view')).toBeInTheDocument();
    expect(screen.getByText(/00:00/)).toBeInTheDocument();
    expect(screen.getByText('Current: Slide 1 of 4')).toBeInTheDocument();
    expect(screen.getByText('Builds remaining: 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Speaker notes')).toHaveValue(
      'Open with the Web AI timing story.',
    );
    expect(screen.getByRole('button', { name: 'Slide 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Slide 3' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Slide 4' })).not.toBeInTheDocument();

    const notes = screen.getByLabelText('Speaker notes');
    const initialSize = notes.style.fontSize;
    fireEvent.click(screen.getByRole('button', { name: 'Increase notes size' }));
    expect(notes.style.fontSize).not.toBe(initialSize);
  });

  it('resizes presenter notes with the divider drag handle', () => {
    window.localStorage.setItem('localstudio.presenterWindowIntroDismissed', '1');
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
    });
    render(<PresenterView sessionId="session-1" />);
    const project = sampleProject.createSampleProject();
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: {
            payload: {
              activePageId: 'page-1',
              animationPreview: undefined,
              project,
            },
            sessionId: 'session-1',
            source: 'localstudio-presenter-main',
            type: 'state',
          },
        }),
      );
    });

    const divider = screen.getByRole('separator', { name: 'Resize presenter notes' });
    const presenterView = screen.getByLabelText('Presenter view');
    expect(presenterView).toHaveStyle({ '--presenter-notes-width': '364px' });

    fireEvent.pointerDown(divider, { clientX: 900, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 780 });
    fireEvent.pointerUp(window);

    expect(presenterView).toHaveStyle({ '--presenter-notes-width': '484px' });
    expect(window.localStorage.getItem('localstudio.presenterNotesWidth')).toBe('484');
  });

  it('resizes presenter notes with keyboard arrows', () => {
    window.localStorage.setItem('localstudio.presenterWindowIntroDismissed', '1');
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
    });
    render(<PresenterView sessionId="session-1" />);
    const project = sampleProject.createSampleProject();
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: {
            payload: {
              activePageId: 'page-1',
              animationPreview: undefined,
              project,
            },
            sessionId: 'session-1',
            source: 'localstudio-presenter-main',
            type: 'state',
          },
        }),
      );
    });

    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize presenter notes' }), {
      key: 'ArrowLeft',
    });

    expect(screen.getByLabelText('Presenter view')).toHaveStyle({
      '--presenter-notes-width': '396px',
    });
  });

  it('posts presenter commands and note updates to the opener', () => {
    const opener = { postMessage: vi.fn() };
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: opener,
    });
    window.localStorage.setItem('localstudio.presenterWindowIntroDismissed', '1');
    render(<PresenterView sessionId="session-1" />);
    const project = sampleProject.createSampleProject();
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: {
            payload: {
              activePageId: 'page-1',
              animationPreview: undefined,
              project,
            },
            sessionId: 'session-1',
            source: 'localstudio-presenter-main',
            type: 'state',
          },
        }),
      );
    });

    expect(screen.getByRole('button', { name: 'Next slide' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    fireEvent.click(screen.getByLabelText('Current slide'));
    fireEvent.change(screen.getByLabelText('Speaker notes'), { target: { value: 'New note' } });

    expect(opener.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'next',
        sessionId: 'session-1',
        source: 'localstudio-presenter-window',
        type: 'command',
      }),
      window.location.origin,
    );
    const postedNextCommandCount = opener.postMessage.mock.calls.filter((call: unknown[]) => {
      const message = call[0];
      if (!message || typeof message !== 'object') return false;
      return (message as { command?: unknown }).command === 'next';
    }).length;
    expect(postedNextCommandCount).toBe(2);
    expect(opener.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'update-notes',
        notes: 'New note',
        pageId: 'page-1',
      }),
      window.location.origin,
    );
  });

  it('accepts timer commands from the editor session and publishes timer state', () => {
    const opener = { postMessage: vi.fn() };
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: opener,
    });
    window.localStorage.setItem('localstudio.presenterWindowIntroDismissed', '1');
    render(<PresenterView sessionId="session-1" />);
    const project = sampleProject.createSampleProject();
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: {
            payload: {
              activePageId: 'page-1',
              animationPreview: undefined,
              project,
            },
            sessionId: 'session-1',
            source: 'localstudio-presenter-main',
            type: 'state',
          },
        }),
      );
    });

    act(() => {
      vi.advanceTimersByTime(79_000);
    });
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: {
            command: 'pause-timer',
            sessionId: 'session-1',
            source: 'localstudio-presenter-main',
            type: 'command',
          },
        }),
      );
    });

    expect(screen.getByText('01:19')).toBeInTheDocument();
    expect(opener.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        command: 'update-timer',
        timer: { elapsedMs: 79_000, paused: true, updatedAtEpochMs: Date.now() },
      }),
      window.location.origin,
    );

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: {
            command: 'reset-timer',
            sessionId: 'session-1',
            source: 'localstudio-presenter-main',
            type: 'command',
          },
        }),
      );
    });

    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(opener.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        command: 'update-timer',
        timer: { elapsedMs: 0, paused: false, updatedAtEpochMs: Date.now() },
      }),
      window.location.origin,
    );
  });

  it('announces the presenter stream peer id to the editor session', () => {
    const opener = { postMessage: vi.fn() };
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: opener,
    });
    window.localStorage.setItem('localstudio.presenterWindowIntroDismissed', '1');
    render(<PresenterView sessionId="session-1" />);
    const project = sampleProject.createSampleProject();
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: {
            payload: {
              activePageId: 'page-1',
              animationPreview: undefined,
              project,
              remoteSession: {
                code: 'ABCD-1234',
                connectedControllerCount: 1,
                controlPeerId: 'ABCD-1234',
                expiresAt: '2026-07-04T12:00:00.000Z',
                presenterLabel: 'MacBook Pro',
                qrUrl: 'https://localstudio.test/joystick',
                sessionId: 'remote-session-1',
                transport: 'peerjs',
              },
            },
            sessionId: 'session-1',
            source: 'localstudio-presenter-main',
            type: 'state',
          },
        }),
      );
    });

    const onPeerId = remoteStreamPublisherMock.getOnPeerId();
    expect(onPeerId).toBeDefined();
    act(() => {
      onPeerId?.('stream-peer-1');
    });

    expect(opener.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        command: 'update-stream-peer',
        peerId: 'stream-peer-1',
        sessionId: 'session-1',
        source: 'localstudio-presenter-window',
        type: 'command',
      }),
      window.location.origin,
    );

    act(() => {
      onPeerId?.(undefined);
    });

    expect(opener.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        command: 'update-stream-peer',
        peerId: undefined,
      }),
      window.location.origin,
    );
  });

  it('formats presenter timer with hours after sixty minutes', () => {
    window.localStorage.setItem('localstudio.presenterWindowIntroDismissed', '1');
    render(<PresenterView sessionId="session-1" />);
    const project = sampleProject.createSampleProject();
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: {
            payload: {
              activePageId: 'page-1',
              animationPreview: undefined,
              project,
            },
            sessionId: 'session-1',
            source: 'localstudio-presenter-main',
            type: 'state',
          },
        }),
      );
    });

    act(() => {
      vi.advanceTimersByTime(3_721_000);
    });

    expect(screen.getByText('01:02:01')).toBeInTheDocument();
  });

  it('opens shortcuts from the presenter toolbar and sends keyboard page jumps', () => {
    const opener = { postMessage: vi.fn() };
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: opener,
    });
    window.localStorage.setItem('localstudio.presenterWindowIntroDismissed', '1');
    render(<PresenterView sessionId="session-1" />);
    const project = sampleProject.createSampleProject();
    project.pages.push({
      background: { type: 'color', color: '#111111' },
      elementIds: [],
      height: 1080,
      id: 'page-2',
      name: 'Slide 2',
      width: 1920,
    });
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: {
            payload: {
              activePageId: 'page-1',
              animationPreview: undefined,
              project,
            },
            sessionId: 'session-1',
            source: 'localstudio-presenter-main',
            type: 'state',
          },
        }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Show keyboard shortcuts' }));
    expect(screen.getByRole('dialog', { name: 'Magic Shortcuts' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Switch the slideshow/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hide presentation/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /black screen/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Go to first slide/ }));
    expect(opener.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'go-to-page',
        pageId: 'page-1',
        sessionId: 'session-1',
        source: 'localstudio-presenter-window',
        type: 'command',
      }),
      window.location.origin,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close keyboard shortcuts' }));

    fireEvent.keyDown(window, { key: 'End' });

    expect(opener.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'go-to-page',
        pageId: 'page-2',
        sessionId: 'session-1',
        source: 'localstudio-presenter-window',
        type: 'command',
      }),
      window.location.origin,
    );
  });

  it('opens the remote control QR panel from the presenter toolbar', async () => {
    window.localStorage.setItem('localstudio.presenterWindowIntroDismissed', '1');
    render(<PresenterView sessionId="session-1" />);
    const project = sampleProject.createSampleProject();
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: {
            payload: {
              activePageId: 'page-1',
              animationPreview: undefined,
              project,
              remoteSession: {
                code: 'LS-1234',
                connectedControllerCount: 0,
                expiresAt: '2026-07-04T14:47:00.000Z',
                id: 'remote-session-1',
                presenterLabel: 'MacBook Pro',
                qrUrl: 'http://localhost:4176/joystick',
              },
            },
            sessionId: 'session-1',
            source: 'localstudio-presenter-main',
            type: 'state',
          },
        }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Show remote control QR code' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('region', { name: 'Remote control this presentation' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Remote control QR code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy remote link/i })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByLabelText('Current slide'));

    expect(screen.queryByRole('region', { name: 'Remote control this presentation' })).not.toBeInTheDocument();
  });

  it('does not run presenter shortcuts while typing in speaker notes', () => {
    const opener = { postMessage: vi.fn() };
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: opener,
    });
    window.localStorage.setItem('localstudio.presenterWindowIntroDismissed', '1');
    render(<PresenterView sessionId="session-1" />);
    const project = sampleProject.createSampleProject();
    project.pages.push({
      background: { type: 'color', color: '#111111' },
      elementIds: [],
      height: 1080,
      id: 'page-2',
      name: 'Slide 2',
      speakerNotes: '',
      width: 1920,
    });
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: window.location.origin,
          data: {
            payload: {
              activePageId: 'page-1',
              animationPreview: undefined,
              project,
            },
            sessionId: 'session-1',
            source: 'localstudio-presenter-main',
            type: 'state',
          },
        }),
      );
    });

    const notes = screen.getByLabelText('Speaker notes');
    notes.focus();
    fireEvent.keyDown(notes, { key: '?' });
    fireEvent.keyDown(notes, { key: 'End' });

    expect(screen.queryByRole('dialog', { name: 'Keyboard Shortcuts' })).not.toBeInTheDocument();
    expect(opener.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ command: 'go-to-page', pageId: 'page-2' }),
      window.location.origin,
    );
  });

  it('does not post close during StrictMode effect remounts', () => {
    const opener = { postMessage: vi.fn() };
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: opener,
    });
    window.localStorage.setItem('localstudio.presenterWindowIntroDismissed', '1');

    render(
      <StrictMode>
        <PresenterView sessionId="session-1" />
      </StrictMode>,
    );

    expect(opener.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'close',
      }),
      window.location.origin,
    );
  });

  it('posts close when the presenter page is hidden or closed', () => {
    const opener = { postMessage: vi.fn() };
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: opener,
    });
    window.localStorage.setItem('localstudio.presenterWindowIntroDismissed', '1');
    render(<PresenterView sessionId="session-1" />);

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(opener.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'close',
        sessionId: 'session-1',
        source: 'localstudio-presenter-window',
        type: 'command',
      }),
      window.location.origin,
    );
  });
});
