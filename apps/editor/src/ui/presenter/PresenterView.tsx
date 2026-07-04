import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { DesignElement, Page, ProjectDocument, SelectionState } from '../../domain/documents/model';
import type {
  PresenterCommandMessage,
  PresenterStateMessage,
  PresenterStatePayload,
  PresenterWindowCommand,
} from '../../services/presenter/presenterSessionTypes';
import {
  KeyboardShortcutsDialog,
  type KeyboardShortcutAction,
} from '../components/KeyboardShortcutsDialog';
import { CanvasWorkspace } from '../editor/canvas/CanvasWorkspace';
import {
  presentationMovieControls,
  type MovieHoldState,
} from '../editor/media/presentationMovieControls';
import { PresenterRemotePanel } from './PresenterRemotePanel';
import { presenterRemoteTimerFormat } from '@localstudio/presenter-remote/timer-format';

interface PresenterViewProps {
  sessionId?: string;
}

const introStorageKey = 'localstudio.presenterWindowIntroDismissed';
const notesWidthStorageKey = 'localstudio.presenterNotesWidth';
const notesZoomStepPx = 2;
const notesResizeStepPx = 32;
const notesDefaultWidthPx = 364;
const notesMinWidthPx = 280;
const notesMaxWidthPx = 760;
const presenterMainMinWidthPx = 520;
const presenterShortcutActions = [
  'next-build',
  'previous-build',
  'next-slide',
  'previous-slide',
  'first-slide',
  'last-slide',
  'shortcut-toggle',
  'open-slide-navigator',
  'next-navigator-slide',
  'previous-navigator-slide',
  'select-navigator-slide',
  'close-slide-navigator',
  'reset-timer',
  'scroll-notes-up',
  'scroll-notes-down',
  'increase-notes',
  'decrease-notes',
  'play-pause-movie',
  'rewind-movie',
  'fast-forward-movie',
  'jump-movie-start',
  'jump-movie-end',
] satisfies KeyboardShortcutAction[];

function isPresenterStateMessage(value: unknown): value is PresenterStateMessage {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    record.source === 'localstudio-presenter-main' &&
    record.type === 'state' &&
    typeof record.sessionId === 'string' &&
    Boolean(record.payload)
  );
}

function isPresenterMainCommandMessage(value: unknown): value is PresenterCommandMessage {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    record.source === 'localstudio-presenter-main' &&
    record.type === 'command' &&
    typeof record.sessionId === 'string' &&
    typeof record.command === 'string'
  );
}

function getRouteSessionId() {
  return new URL(window.location.href).searchParams.get('presenterSession') ?? undefined;
}

function getInitialIntroDismissed() {
  return window.localStorage.getItem(introStorageKey) === '1';
}

function clampPresenterNotesWidth(width: number) {
  const viewportMaxWidth = Math.max(notesMinWidthPx, window.innerWidth - presenterMainMinWidthPx);
  const maxWidth = Math.min(notesMaxWidthPx, viewportMaxWidth);
  return Math.round(Math.min(maxWidth, Math.max(notesMinWidthPx, width)));
}

function getInitialNotesWidth() {
  const storedValue = window.localStorage.getItem(notesWidthStorageKey);
  if (storedValue === null) return notesDefaultWidthPx;
  const storedWidth = Number(storedValue);
  if (!Number.isFinite(storedWidth)) return notesDefaultWidthPx;
  return clampPresenterNotesWidth(storedWidth);
}

function getPresenterOpener() {
  const candidate = window.opener as unknown;
  if (!candidate || typeof candidate !== 'object') return null;
  if (!('postMessage' in candidate)) return null;
  return candidate as Window;
}

function isEditablePresenterTarget(target: EventTarget | null) {
  const isEditableElement = (value: Element | EventTarget | null) =>
    value instanceof HTMLInputElement ||
    value instanceof HTMLTextAreaElement ||
    value instanceof HTMLSelectElement ||
    (value instanceof HTMLElement && value.isContentEditable);
  return isEditableElement(target) || isEditableElement(document.activeElement);
}

function getActivePage(project: ProjectDocument, activePageId: string) {
  return project.pages.find((page) => page.id === activePageId) ?? project.pages[0];
}

function getPageIndex(project: ProjectDocument, activePageId: string) {
  return Math.max(
    0,
    project.pages.findIndex((page) => page.id === activePageId),
  );
}

function getBuildsRemaining(payload: PresenterStatePayload, page: Page) {
  const validBuilds = (page.animationBuilds ?? []).filter((build) =>
    page.elementIds.includes(build.elementId),
  );
  if (validBuilds.length === 0) return 0;
  if (payload.animationPreview?.pageId !== page.id) return validBuilds.length;
  if (payload.animationPreview.phase === 'complete') return 0;
  const hiddenElementIds = new Set(payload.animationPreview.hiddenElementIds);
  return validBuilds.filter((build) => hiddenElementIds.has(build.elementId)).length;
}

function getElementStyle(element: DesignElement, page: Page): CSSProperties {
  return {
    height: `${(element.height / page.height) * 100}%`,
    left: `${(element.x / page.width) * 100}%`,
    opacity: element.opacity,
    top: `${(element.y / page.height) * 100}%`,
    transform: `rotate(${element.rotation}deg)`,
    width: `${(element.width / page.width) * 100}%`,
  };
}

export function PresenterView({ sessionId = getRouteSessionId() }: PresenterViewProps) {
  const [snapshot, setSnapshot] = useState<PresenterStatePayload | undefined>();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [timerStartedAt, setTimerStartedAt] = useState(() => Date.now());
  const [timerBaseMs, setTimerBaseMs] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  const [notesFontSize, setNotesFontSize] = useState(34);
  const [notesPanelWidth, setNotesPanelWidth] = useState(getInitialNotesWidth);
  const [keyboardShortcutsMode, setKeyboardShortcutsMode] = useState<'dialog' | 'popover' | undefined>();
  const [remotePanelOpen, setRemotePanelOpen] = useState(false);
  const [slideNavigatorOpen, setSlideNavigatorOpen] = useState(false);
  const [slideNavigatorIndex, setSlideNavigatorIndex] = useState(0);
  const [introDismissed, setIntroDismissed] = useState(getInitialIntroDismissed);
  const [dismissIntroForever, setDismissIntroForever] = useState(false);
  const emptySelection = useMemo<SelectionState>(() => ({ elementIds: [], pageId: '' }), []);
  const openerRef = useRef<Window | null>(getPresenterOpener());
  const movieHoldStateRef = useRef<MovieHoldState | undefined>(undefined);
  const presenterStageRef = useRef<HTMLElement>(null);
  const presenterRemotePanelRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const elapsedMsRef = useRef(0);
  const timerBaseMsRef = useRef(0);
  const resolvedSessionId = sessionId ?? 'presenter';
  const presenterViewStyle = useMemo(
    () => ({ '--presenter-notes-width': `${notesPanelWidth}px` }) as CSSProperties,
    [notesPanelWidth],
  );

  const postCommand = useCallback((command: PresenterWindowCommand) => {
    const message: PresenterCommandMessage = {
      ...command,
      sessionId: resolvedSessionId,
      source: 'localstudio-presenter-window',
      type: 'command',
    };
    openerRef.current?.postMessage(message, window.location.origin);
  }, [resolvedSessionId]);

  const publishTimerState = useCallback((timer: { elapsedMs: number; paused: boolean }) => {
    postCommand({ command: 'update-timer', timer });
  }, [postCommand]);
  const elapsedMs = timerPaused ? timerBaseMs : timerBaseMs + (timerNow - timerStartedAt);

  const updateNotesPanelWidth = useCallback((nextWidth: number | ((currentWidth: number) => number)) => {
    setNotesPanelWidth((currentWidth) => {
      const rawWidth = typeof nextWidth === 'function' ? nextWidth(currentWidth) : nextWidth;
      const clampedWidth = clampPresenterNotesWidth(rawWidth);
      window.localStorage.setItem(notesWidthStorageKey, String(clampedWidth));
      return clampedWidth;
    });
  }, []);

  const startNotesResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const startX = event.clientX;
    const startWidth = notesPanelWidth;

    function handlePointerMove(pointerEvent: PointerEvent) {
      updateNotesPanelWidth(startWidth + startX - pointerEvent.clientX);
    }

    function stopResize() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
  }, [notesPanelWidth, updateNotesPanelWidth]);

  const resizeNotesWithKeyboard = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'ArrowLeft') {
      updateNotesPanelWidth((currentWidth) => currentWidth + notesResizeStepPx);
      return;
    }
    if (event.key === 'ArrowRight') {
      updateNotesPanelWidth((currentWidth) => currentWidth - notesResizeStepPx);
      return;
    }
    updateNotesPanelWidth(event.key === 'Home' ? notesMinWidthPx : notesMaxWidthPx);
  }, [updateNotesPanelWidth]);

  useEffect(() => {
    elapsedMsRef.current = elapsedMs;
    timerBaseMsRef.current = timerBaseMs;
  }, [elapsedMs, timerBaseMs]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
      setTimerNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (isPresenterStateMessage(event.data)) {
        if (event.data.sessionId !== resolvedSessionId) return;
        setSnapshot(event.data.payload);
        return;
      }
      if (!isPresenterMainCommandMessage(event.data)) return;
      if (event.data.sessionId !== resolvedSessionId) return;
      if (event.data.command === 'pause-timer') {
        const currentElapsedMs = elapsedMsRef.current;
        setTimerBaseMs(currentElapsedMs);
        setTimerPaused(true);
        publishTimerState({ elapsedMs: currentElapsedMs, paused: true });
        return;
      }
      if (event.data.command === 'resume-timer') {
        const now = Date.now();
        setTimerNow(now);
        setTimerStartedAt(now);
        setTimerPaused(false);
        publishTimerState({ elapsedMs: timerBaseMsRef.current, paused: false });
        return;
      }
      if (event.data.command === 'reset-timer') {
        const now = Date.now();
        setTimerBaseMs(0);
        setTimerNow(now);
        setTimerStartedAt(now);
        setTimerPaused(false);
        publishTimerState({ elapsedMs: 0, paused: false });
      }
    }

    window.addEventListener('message', handleMessage);
    postCommand({ command: 'request-state' });
    postCommand({ command: 'resume-timer' });
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [postCommand, publishTimerState, resolvedSessionId]);

  useEffect(() => {
    function handlePageHide() {
      postCommand({ command: 'close' });
    }

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [postCommand]);

  useEffect(() => {
    if (!remotePanelOpen) return;

    function handleOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (presenterRemotePanelRef.current?.contains(target)) return;

      setRemotePanelOpen(false);
    }

    document.addEventListener('pointerdown', handleOutsidePointer);

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
    };
  }, [remotePanelOpen]);

  const activePage = snapshot ? getActivePage(snapshot.project, snapshot.activePageId) : undefined;
  const activePageIndex = snapshot ? getPageIndex(snapshot.project, snapshot.activePageId) : 0;
  const upcomingPages = snapshot ? snapshot.project.pages.slice(activePageIndex + 1, activePageIndex + 3) : [];
  const buildsRemaining = snapshot && activePage ? getBuildsRemaining(snapshot, activePage) : 0;
  const speakerNotes = activePage?.speakerNotes ?? '';
  const currentTimeLabel = currentTime.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  function toggleTimer() {
    if (timerPaused) {
      const now = Date.now();
      setTimerNow(now);
      setTimerStartedAt(now);
      setTimerPaused(false);
      postCommand({ command: 'resume-timer' });
      publishTimerState({ elapsedMs: timerBaseMs, paused: false });
      return;
    }
    setTimerBaseMs(elapsedMs);
    setTimerPaused(true);
    postCommand({ command: 'pause-timer' });
    publishTimerState({ elapsedMs, paused: true });
  }

  const resetTimer = useCallback(() => {
    const now = Date.now();
    setTimerBaseMs(0);
    setTimerNow(now);
    setTimerStartedAt(now);
    setTimerPaused(false);
    postCommand({ command: 'reset-timer' });
    publishTimerState({ elapsedMs: 0, paused: false });
  }, [postCommand, publishTimerState]);

  function getPresenterVideos() {
    return Array.from(presenterStageRef.current?.querySelectorAll('video') ?? []);
  }

  const controlPresenterMovies = useCallback((action: 'end' | 'play-toggle' | 'start') => {
    const videos = getPresenterVideos();
    return presentationMovieControls.control(videos, action);
  }, []);

  const pulsePresenterMovieHold = useCallback((action: 'fast-forward' | 'rewind') => {
    movieHoldStateRef.current = presentationMovieControls.pulse(
      getPresenterVideos(),
      action,
      movieHoldStateRef.current,
    );
  }, []);

  const startPresenterMovieHold = useCallback((action: 'fast-forward' | 'rewind') => {
    movieHoldStateRef.current = presentationMovieControls.startHold(
      getPresenterVideos(),
      action,
      movieHoldStateRef.current,
    );
  }, []);

  const stopPresenterMovieHold = useCallback(() => {
    movieHoldStateRef.current = presentationMovieControls.stopHold(movieHoldStateRef.current);
  }, []);

  const goToPage = useCallback((index: number) => {
    const page = snapshot?.project.pages[index];
    if (!page) return false;
    setSlideNavigatorIndex(index);
    postCommand({ command: 'go-to-page', pageId: page.id });
    return true;
  }, [postCommand, snapshot]);

  const executePresenterShortcut = useCallback((action: KeyboardShortcutAction) => {
    if (action === 'shortcut-toggle') {
      setKeyboardShortcutsMode((current) => (current === 'dialog' ? undefined : 'dialog'));
      return;
    }
    if (action === 'open-slide-navigator') {
      setSlideNavigatorIndex(activePageIndex);
      setSlideNavigatorOpen(true);
      return;
    }
    if (action === 'close-slide-navigator') {
      setSlideNavigatorOpen(false);
      return;
    }
    if (action === 'next-navigator-slide') {
      setSlideNavigatorIndex((current) =>
        Math.min((snapshot?.project.pages.length ?? 1) - 1, current + 1),
      );
      return;
    }
    if (action === 'previous-navigator-slide') {
      setSlideNavigatorIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (action === 'select-navigator-slide') {
      goToPage(slideNavigatorIndex);
      setSlideNavigatorOpen(false);
      return;
    }
    if (action === 'first-slide') {
      goToPage(0);
      return;
    }
    if (action === 'last-slide') {
      goToPage((snapshot?.project.pages.length ?? 1) - 1);
      return;
    }
    if (action === 'next-slide') {
      goToPage(activePageIndex + 1);
      return;
    }
    if (action === 'previous-slide') {
      goToPage(activePageIndex - 1);
      return;
    }
    if (action === 'previous-build') {
      postCommand({ command: 'previous' });
      return;
    }
    if (action === 'next-build') {
      postCommand({ command: 'next' });
      return;
    }
    if (action === 'reset-timer') {
      resetTimer();
      return;
    }
    if (action === 'scroll-notes-up' || action === 'scroll-notes-down') {
      notesRef.current?.scrollBy({ top: action === 'scroll-notes-up' ? -96 : 96, behavior: 'smooth' });
      return;
    }
    if (action === 'increase-notes') {
      setNotesFontSize((current) => Math.min(56, current + notesZoomStepPx));
      return;
    }
    if (action === 'decrease-notes') {
      setNotesFontSize((current) => Math.max(18, current - notesZoomStepPx));
      return;
    }
    if (action === 'play-pause-movie') controlPresenterMovies('play-toggle');
    if (action === 'rewind-movie') pulsePresenterMovieHold('rewind');
    if (action === 'fast-forward-movie') pulsePresenterMovieHold('fast-forward');
    if (action === 'jump-movie-start') controlPresenterMovies('start');
    if (action === 'jump-movie-end') controlPresenterMovies('end');
    if (action === 'quit-presentation') window.close();
  }, [
    activePageIndex,
    controlPresenterMovies,
    goToPage,
    pulsePresenterMovieHold,
    postCommand,
    resetTimer,
    slideNavigatorIndex,
    snapshot,
  ]);

  function dismissIntro() {
    if (dismissIntroForever) window.localStorage.setItem(introStorageKey, '1');
    setIntroDismissed(true);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditablePresenterTarget(event.target)) return;

      if (keyboardShortcutsMode && event.key === 'Escape') {
        event.preventDefault();
        setKeyboardShortcutsMode(undefined);
        return;
      }
      if (slideNavigatorOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setSlideNavigatorOpen(false);
          return;
        }
        if (event.key === '+' || event.key === '=') {
          event.preventDefault();
          setSlideNavigatorIndex((current) =>
            Math.min((snapshot?.project.pages.length ?? 1) - 1, current + 1),
          );
          return;
        }
        if (event.key === '-') {
          event.preventDefault();
          setSlideNavigatorIndex((current) => Math.max(0, current - 1));
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          goToPage(slideNavigatorIndex);
          setSlideNavigatorOpen(false);
          return;
        }
      }

      const lowerKey = event.key.toLowerCase();
      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault();
        executePresenterShortcut('shortcut-toggle');
        return;
      }
      if (!snapshot) return;
      if (event.key === '#') {
        event.preventDefault();
        executePresenterShortcut('open-slide-navigator');
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        executePresenterShortcut('first-slide');
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        executePresenterShortcut('last-slide');
        return;
      }
      if (event.key === 'ArrowDown' && event.shiftKey) {
        event.preventDefault();
        executePresenterShortcut('next-slide');
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ' || event.key === 'Enter' || event.key === ']') {
        event.preventDefault();
        executePresenterShortcut('next-build');
        return;
      }
      if (event.key === '[') {
        event.preventDefault();
        executePresenterShortcut('previous-build');
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        executePresenterShortcut('previous-slide');
        return;
      }
      if (lowerKey === 'r') {
        event.preventDefault();
        executePresenterShortcut('reset-timer');
        return;
      }
      if (lowerKey === 'u' || lowerKey === 'd') {
        event.preventDefault();
        executePresenterShortcut(lowerKey === 'u' ? 'scroll-notes-up' : 'scroll-notes-down');
        return;
      }
      if ((event.metaKey || event.ctrlKey) && (event.key === '+' || event.key === '=')) {
        event.preventDefault();
        executePresenterShortcut('increase-notes');
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === '-') {
        event.preventDefault();
        executePresenterShortcut('decrease-notes');
        return;
      }
      if (lowerKey === 'k') {
        event.preventDefault();
        executePresenterShortcut('play-pause-movie');
        return;
      }
      if (lowerKey === 'j') {
        event.preventDefault();
        if (!event.repeat) startPresenterMovieHold('rewind');
        return;
      }
      if (lowerKey === 'l') {
        event.preventDefault();
        if (!event.repeat) startPresenterMovieHold('fast-forward');
        return;
      }
      if (lowerKey === 'i') {
        event.preventDefault();
        executePresenterShortcut('jump-movie-start');
        return;
      }
      if (lowerKey === 'o') {
        event.preventDefault();
        executePresenterShortcut('jump-movie-end');
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'j' && event.key.toLowerCase() !== 'l') return;
      stopPresenterMovieHold();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    activePageIndex,
    controlPresenterMovies,
    executePresenterShortcut,
    goToPage,
    keyboardShortcutsMode,
    postCommand,
    resetTimer,
    slideNavigatorIndex,
    slideNavigatorOpen,
    snapshot,
    startPresenterMovieHold,
    stopPresenterMovieHold,
  ]);

  useEffect(() => {
    return () => {
      movieHoldStateRef.current = presentationMovieControls.stopHold(movieHoldStateRef.current);
    };
  }, []);

  const introOverlay = !introDismissed ? (
    <div className="presenter-intro-backdrop" role="presentation">
      <section className="presenter-intro-dialog" role="dialog" aria-modal="true" aria-labelledby="presenter-intro-title">
        <h1 id="presenter-intro-title">Presenter Window</h1>
        <p>
          This window is just for you. Place it on the screen only you can see, such as your laptop or a fallback
          monitor.
        </p>
        <label>
          <input
            type="checkbox"
            checked={dismissIntroForever}
            onChange={(event) => setDismissIntroForever(event.target.checked)}
          />
          <span>Don&apos;t show this message again</span>
        </label>
        <button type="button" onClick={dismissIntro}>
          Got it
        </button>
      </section>
    </div>
  ) : null;

  if (!snapshot || !activePage) {
    return (
      <main className="presenter-view presenter-view-disconnected" aria-label="Presenter view">
        <p>Waiting for presentation...</p>
        {introOverlay}
      </main>
    );
  }

  return (
    <main className="presenter-view" aria-label="Presenter view" style={presenterViewStyle}>
      <section className="presenter-main">
        <header className="presenter-topbar">
          <div className="presenter-clock-group">
            <span className="presenter-clock">{currentTimeLabel}</span>
            <span className="presenter-divider" aria-hidden="true" />
            <span className="presenter-timer">{presenterRemoteTimerFormat.formatElapsed(elapsedMs)}</span>
          </div>
          <div className="presenter-controls ew-compact-row" aria-label="Presenter controls">
            <button
              className="stitch-icon-button presenter-control-button"
              type="button"
              aria-label="Previous slide"
              onClick={() => postCommand({ command: 'previous' })}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                chevron_left
              </span>
            </button>
            <button
              className="stitch-icon-button presenter-control-button"
              type="button"
              aria-label={timerPaused ? 'Resume timer' : 'Pause timer'}
              onClick={toggleTimer}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {timerPaused ? 'play_arrow' : 'pause'}
              </span>
            </button>
            <button
              className="stitch-icon-button presenter-control-button"
              type="button"
              aria-label="Reset timer"
              onClick={resetTimer}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                history
              </span>
            </button>
            <button
              className="stitch-icon-button presenter-control-button"
              type="button"
              aria-label="Show keyboard shortcuts"
              aria-expanded={keyboardShortcutsMode === 'popover'}
              onClick={() =>
                setKeyboardShortcutsMode((current) => (current === 'popover' ? undefined : 'popover'))
              }
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                keyboard
              </span>
            </button>
            <button
              className="stitch-icon-button presenter-control-button"
              type="button"
              aria-label="Show remote control QR code"
              aria-expanded={remotePanelOpen}
              disabled={!snapshot.remoteSession}
              onClick={() => setRemotePanelOpen((current) => !current)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                settings_remote
              </span>
            </button>
            <button
              className="stitch-icon-button presenter-control-button"
              type="button"
              aria-label="Next slide"
              onClick={() => postCommand({ command: 'next' })}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                chevron_right
              </span>
            </button>
          </div>
        </header>
        <div className="presenter-status-row" aria-label="Presenter status">
          <span className="presenter-status-item ew-ellipsis">
            Current: Slide {activePageIndex + 1} of {snapshot.project.pages.length}
          </span>
          <span className="presenter-status-item ew-ellipsis">
            Builds remaining: {buildsRemaining}
          </span>
        </div>
        <section
          className="presenter-stage"
          aria-label="Current slide"
          ref={presenterStageRef}
          onClick={() => postCommand({ command: 'next' })}
        >
          <CanvasWorkspace
            project={snapshot.project}
            activePageId={activePage.id}
            selection={{ ...emptySelection, pageId: activePage.id }}
            presentationMode
            readOnly
            zoomPercent={100}
            animationPreview={snapshot.animationPreview}
          />
        </section>
        <nav className="presenter-slide-strip" aria-label="Slide previews">
          {upcomingPages.map((page, offset) => (
            <button
              aria-label={page.name}
              className="presenter-thumb"
              key={page.id}
              type="button"
              onClick={() => postCommand({ command: 'go-to-page', pageId: page.id })}
            >
              <span className="presenter-thumb-label">Next {offset + 1}</span>
              <PresenterThumbnail page={page} project={snapshot.project} />
            </button>
          ))}
        </nav>
      </section>
      <div
        className="presenter-notes-resizer"
        role="separator"
        aria-label="Resize presenter notes"
        aria-orientation="vertical"
        aria-valuemin={notesMinWidthPx}
        aria-valuemax={notesMaxWidthPx}
        aria-valuenow={notesPanelWidth}
        tabIndex={0}
        onKeyDown={resizeNotesWithKeyboard}
        onPointerDown={startNotesResize}
      >
        <span aria-hidden="true" />
      </div>
      <aside className="presenter-notes-panel" aria-label="Presenter notes">
        <div className="presenter-notes-tabs">
          <span className="presenter-notes-tab-active">Notes</span>
        </div>
        <textarea
          ref={notesRef}
          aria-label="Speaker notes"
          className={speakerNotes ? 'presenter-notes-textarea' : 'presenter-notes-textarea presenter-notes-empty'}
          placeholder="Add notes to your design"
          style={{ fontSize: `${notesFontSize}px` }}
          value={speakerNotes}
          onChange={(event) =>
            postCommand({ command: 'update-notes', notes: event.target.value, pageId: activePage.id })
          }
        />
        <div className="presenter-notes-zoom" aria-label="Notes zoom controls">
          <button
            className="stitch-icon-button presenter-notes-zoom-button"
            type="button"
            aria-label="Decrease notes size"
            onClick={() => setNotesFontSize((current) => Math.max(18, current - notesZoomStepPx))}
          >
            -
          </button>
          <span aria-hidden="true">aA</span>
          <button
            className="stitch-icon-button presenter-notes-zoom-button"
            type="button"
            aria-label="Increase notes size"
            onClick={() => setNotesFontSize((current) => Math.min(56, current + notesZoomStepPx))}
          >
            +
          </button>
        </div>
      </aside>
      {keyboardShortcutsMode ? (
        <KeyboardShortcutsDialog
          title={keyboardShortcutsMode === 'popover' ? 'Magic Shortcuts' : 'Keyboard Shortcuts'}
          variant={keyboardShortcutsMode}
          onClose={() => setKeyboardShortcutsMode(undefined)}
          onShortcutAction={executePresenterShortcut}
          supportedActions={presenterShortcutActions}
        />
      ) : null}
      {remotePanelOpen && snapshot.remoteSession ? (
        <div ref={presenterRemotePanelRef}>
          <PresenterRemotePanel session={snapshot.remoteSession} />
        </div>
      ) : null}
      {slideNavigatorOpen && snapshot ? (
        <div className="presentation-slide-navigator" role="dialog" aria-modal="true" aria-label="Slide navigator">
          <div className="presentation-slide-navigator-header">
            <h2>Slide Navigator</h2>
            <button
              className="stitch-icon-button"
              type="button"
              aria-label="Close slide navigator"
              onClick={() => setSlideNavigatorOpen(false)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>
          <div className="presentation-slide-navigator-list" role="listbox" aria-label="Slides">
            {snapshot.project.pages.map((page, index) => (
              <button
                aria-selected={index === slideNavigatorIndex}
                className={
                  index === slideNavigatorIndex
                    ? 'presentation-slide-navigator-item presentation-slide-navigator-item-active'
                    : 'presentation-slide-navigator-item'
                }
                key={page.id}
                type="button"
                role="option"
                onClick={() => setSlideNavigatorIndex(index)}
                onDoubleClick={() => {
                  goToPage(index);
                  setSlideNavigatorOpen(false);
                }}
              >
                <span>Slide {index + 1}</span>
                <strong>{page.name}</strong>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {introOverlay}
    </main>
  );
}

function PresenterThumbnail({ page, project }: { page: Page; project: ProjectDocument }) {
  const background =
    page.background.type === 'color'
      ? page.background.color
      : (project.assets[page.background.assetId]?.objectUrl ?? page.background.colorFallback);

  return (
    <span
      className="presenter-thumb-canvas"
      style={{
        aspectRatio: `${page.width} / ${page.height}`,
        backgroundColor: page.background.type === 'color' ? background : page.background.colorFallback,
      }}
    >
      {page.background.type === 'asset' && project.assets[page.background.assetId]?.objectUrl ? (
        <img
          alt=""
          className="presenter-thumb-bg ew-fill-media"
          src={project.assets[page.background.assetId]?.objectUrl}
        />
      ) : null}
      {page.elementIds.map((elementId) => {
        const element = project.elements[elementId];
        if (!element || element.visible === false) return null;
        const style = getElementStyle(element, page);
        if (element.type === 'image') {
          const asset = project.assets[element.assetId];
          return asset?.objectUrl ? (
            <img alt="" className="presenter-thumb-element" key={element.id} src={asset.objectUrl} style={style} />
          ) : null;
        }
        if (element.type === 'text') {
          return (
            <span
              className="presenter-thumb-element presenter-thumb-text"
              key={element.id}
              style={{
                ...style,
                color: element.fill,
                fontFamily: element.fontFamily,
                fontSize: `${Math.max(4, (element.fontSize / page.width) * 100)}cqw`,
                fontWeight: element.fontWeight,
                textAlign: element.align,
              }}
            >
              {element.text}
            </span>
          );
        }
        return <span className="presenter-thumb-element" key={element.id} style={style} />;
      })}
    </span>
  );
}
