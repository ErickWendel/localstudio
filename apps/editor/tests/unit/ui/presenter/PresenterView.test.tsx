import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { PresenterView } from '../../../../src/ui/presenter/PresenterView';

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
    expect(screen.getByText('Current: Slide 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Builds remaining: 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Speaker notes')).toHaveValue(
      'Open with the Web AI timing story.',
    );
    expect(screen.getByRole('button', { name: 'Slide 2' })).toBeInTheDocument();

    const notes = screen.getByLabelText('Speaker notes');
    const initialSize = notes.style.fontSize;
    fireEvent.click(screen.getByRole('button', { name: 'Increase notes size' }));
    expect(notes.style.fontSize).not.toBe(initialSize);
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
    expect(opener.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'update-notes',
        notes: 'New note',
        pageId: 'page-1',
      }),
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
