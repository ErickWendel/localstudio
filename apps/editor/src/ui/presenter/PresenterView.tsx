import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { DesignElement, Page, ProjectDocument, SelectionState } from '../../domain/documents/model';
import type {
  PresenterCommandMessage,
  PresenterStateMessage,
  PresenterStatePayload,
  PresenterWindowCommand,
} from '../../services/presenter/presenterSessionTypes';
import { CanvasWorkspace } from '../editor/canvas/CanvasWorkspace';

interface PresenterViewProps {
  sessionId?: string;
}

const introStorageKey = 'localstudio.presenterWindowIntroDismissed';
const notesZoomStepPx = 2;

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

function getRouteSessionId() {
  return new URL(window.location.href).searchParams.get('presenterSession') ?? undefined;
}

function getInitialIntroDismissed() {
  return window.localStorage.getItem(introStorageKey) === '1';
}

function getPresenterOpener() {
  const candidate = window.opener as unknown;
  if (!candidate || typeof candidate !== 'object') return null;
  if (!('postMessage' in candidate)) return null;
  return candidate as Window;
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
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
  const [introDismissed, setIntroDismissed] = useState(getInitialIntroDismissed);
  const [dismissIntroForever, setDismissIntroForever] = useState(false);
  const emptySelection = useMemo<SelectionState>(() => ({ elementIds: [], pageId: '' }), []);
  const openerRef = useRef<Window | null>(getPresenterOpener());
  const resolvedSessionId = sessionId ?? 'presenter';

  const postCommand = useCallback((command: PresenterWindowCommand) => {
    const message: PresenterCommandMessage = {
      ...command,
      sessionId: resolvedSessionId,
      source: 'localstudio-presenter-window',
      type: 'command',
    };
    openerRef.current?.postMessage(message, window.location.origin);
  }, [resolvedSessionId]);

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
      if (!isPresenterStateMessage(event.data)) return;
      if (event.data.sessionId !== resolvedSessionId) return;
      setSnapshot(event.data.payload);
    }

    window.addEventListener('message', handleMessage);
    postCommand({ command: 'request-state' });
    postCommand({ command: 'resume-timer' });
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [postCommand, resolvedSessionId]);

  useEffect(() => {
    function handlePageHide() {
      postCommand({ command: 'close' });
    }

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [postCommand]);

  const elapsedMs = timerPaused ? timerBaseMs : timerBaseMs + (timerNow - timerStartedAt);
  const activePage = snapshot ? getActivePage(snapshot.project, snapshot.activePageId) : undefined;
  const activePageIndex = snapshot ? getPageIndex(snapshot.project, snapshot.activePageId) : 0;
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
      return;
    }
    setTimerBaseMs(elapsedMs);
    setTimerPaused(true);
    postCommand({ command: 'pause-timer' });
  }

  function resetTimer() {
    const now = Date.now();
    setTimerBaseMs(0);
    setTimerNow(now);
    setTimerStartedAt(now);
    setTimerPaused(false);
    postCommand({ command: 'reset-timer' });
  }

  function dismissIntro() {
    if (dismissIntroForever) window.localStorage.setItem(introStorageKey, '1');
    setIntroDismissed(true);
  }

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
    <main className="presenter-view" aria-label="Presenter view">
      <section className="presenter-main">
        <header className="presenter-topbar">
          <div className="presenter-clock-group">
            <span className="presenter-clock">{currentTimeLabel}</span>
            <span className="presenter-divider" aria-hidden="true" />
            <span className="presenter-timer">{formatElapsed(elapsedMs)}</span>
          </div>
          <div className="presenter-controls" aria-label="Presenter controls">
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
          <span className="presenter-status-item">
            Current: Slide {activePageIndex + 1} of {snapshot.project.pages.length}
          </span>
          <span className="presenter-status-item">Builds remaining: {buildsRemaining}</span>
        </div>
        <section className="presenter-stage" aria-label="Current slide">
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
          {snapshot.project.pages.map((page, index) => (
            <button
              aria-current={index === activePageIndex ? 'page' : undefined}
              aria-label={page.name}
              className={index === activePageIndex ? 'presenter-thumb presenter-thumb-active' : 'presenter-thumb'}
              key={page.id}
              type="button"
              onClick={() => {
                if (index < activePageIndex) postCommand({ command: 'previous' });
                if (index > activePageIndex) postCommand({ command: 'next' });
              }}
            >
              <PresenterThumbnail page={page} project={snapshot.project} />
            </button>
          ))}
        </nav>
      </section>
      <aside className="presenter-notes-panel" aria-label="Presenter notes">
        <div className="presenter-notes-tabs">
          <span className="presenter-notes-tab-active">Notes</span>
        </div>
        <textarea
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
        <img alt="" className="presenter-thumb-bg" src={project.assets[page.background.assetId]?.objectUrl} />
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
