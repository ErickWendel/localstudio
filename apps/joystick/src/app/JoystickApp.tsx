import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent, TouchEvent } from 'react';
import { ChevronLeft, List, Minus, NotebookText, Pause, Play, Plus, TimerReset, X } from 'lucide-react';
import { presenterRemoteSessionCode } from '@localstudio/presenter-remote/session-code';
import { presenterRemoteTimerFormat } from '@localstudio/presenter-remote/timer-format';
import {
  InMemoryPresenterRemoteSignalingService,
  type RegisterPresenterRemoteSessionInput,
} from '@localstudio/presenter-remote/signaling-service';
import { PresenterRemoteSignalingClient } from '@localstudio/presenter-remote/signaling-client';
import type {
  PresenterRemoteCommand,
  PresenterRemoteSlidePreview,
  PresenterRemoteSlidePreviewElement,
  PresenterRemoteSession,
  PresenterRemoteState,
  PresenterRemoteStreamPreference,
} from '@localstudio/presenter-remote/protocol';
import {
  presenterRemoteStreamReceiver,
  type PresenterRemoteStreamSignaling,
} from './presenterRemoteStreamReceiver';

interface JoystickSignalingService {
  connectController?: ((code: string, controllerId: string) => PresenterRemoteSession | Promise<PresenterRemoteSession | undefined> | undefined) | undefined;
  getPublishedState?: ((code: string) => PresenterRemoteState | undefined | Promise<PresenterRemoteState | undefined>) | undefined;
  lookupSession: (code: string) => PresenterRemoteSession | undefined | Promise<PresenterRemoteSession | undefined>;
  publishCommand: (code: string, command: PresenterRemoteCommand, controllerId?: string) => boolean | Promise<unknown>;
}

interface JoystickAppProps {
  initialUrl?: string | undefined;
  signalingService?: JoystickSignalingService | undefined;
}

const rememberedCodeKey = 'localstudio.joystick.lastCode';
const controllerIdKey = 'localstudio.joystick.controllerId';
type JoystickSimpleCommand = 'next' | 'pause-timer' | 'previous' | 'reset-timer';
const swipeThresholdPx = 44;
const streamPreferenceAspectRatio = 390 / 340;

function getInitialCode(initialUrl: string) {
  const url = new URL(initialUrl);
  return presenterRemoteSessionCode.normalize(url.searchParams.get('code') ?? '');
}

function createDefaultSignalingService(): JoystickSignalingService {
  if (typeof fetch === 'function') {
    return new PresenterRemoteSignalingClient({ endpoint: '/__localstudio/presenter-remote' });
  }
  const service: JoystickSignalingService = new InMemoryPresenterRemoteSignalingService();
  const seedSession: RegisterPresenterRemoteSessionInput | undefined = undefined;
  if (seedSession && service instanceof InMemoryPresenterRemoteSignalingService) {
    service.registerSession(seedSession);
  }
  return service;
}

function createStreamSignalingAdapter(signalingService: JoystickSignalingService): PresenterRemoteStreamSignaling {
  const candidate = signalingService as unknown as PresenterRemoteStreamSignaling & {
    createControllerOffer?: ((...args: unknown[]) => unknown) | undefined;
  };
  return {
    closeController: candidate.closeController?.bind(candidate),
    createControllerOffer:
      typeof candidate.createControllerOffer === 'function'
        ? (code, controllerId, offerSdp) => {
            if (candidate.createControllerOffer?.length === 1) {
              void candidate.createControllerOffer({ controllerId, offerSdp, sessionCode: code });
              return;
            }
            void candidate.createControllerOffer?.(code, controllerId, offerSdp);
          }
        : undefined,
    getAnswer: candidate.getAnswer?.bind(candidate),
    publishIceCandidate: candidate.publishIceCandidate?.bind(candidate),
    takeIceCandidates: candidate.takeIceCandidates?.bind(candidate),
  };
}

function getLocalStorage() {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function getStoredValue(key: string) {
  return getLocalStorage()?.getItem(key) ?? undefined;
}

function setStoredValue(key: string, value: string) {
  getLocalStorage()?.setItem(key, value);
}

function getControllerId() {
  const existingId = getStoredValue(controllerIdKey);
  if (existingId) return existingId;
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `controller-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  setStoredValue(controllerIdKey, id);
  return id;
}

function getElementStyle(element: PresenterRemoteSlidePreviewElement, preview: PresenterRemoteSlidePreview) {
  return {
    height: `${(element.height / preview.height) * 100}%`,
    left: `${(element.x / preview.width) * 100}%`,
    opacity: element.opacity,
    top: `${(element.y / preview.height) * 100}%`,
    transform: `rotate(${element.rotation}deg)`,
    width: `${(element.width / preview.width) * 100}%`,
  };
}

function getNetworkQualityHint(): PresenterRemoteStreamPreference['quality'] {
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string | undefined; saveData?: boolean | undefined } | undefined;
  }).connection;
  if (connection?.saveData) return 'low';
  if (connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g') return 'low';
  if (connection?.effectiveType === '3g') return 'medium';
  return window.devicePixelRatio >= 2 ? 'high' : 'medium';
}

function createStreamPreference(element: HTMLElement): PresenterRemoteStreamPreference {
  const bounds = element.getBoundingClientRect();
  const quality = getNetworkQualityHint();
  const multiplier = quality === 'high' ? Math.min(window.devicePixelRatio || 1, 3) : quality === 'medium' ? 1.5 : 1;
  const width = Math.max(390, Math.min(1280, Math.round(bounds.width * multiplier)));
  const height = Math.max(340, Math.min(1120, Math.round(width / streamPreferenceAspectRatio)));
  return {
    fps: quality === 'high' ? 12 : quality === 'medium' ? 8 : 6,
    height,
    quality,
    type: 'stream-preference',
    width,
  };
}

function useHorizontalSwipeNavigation(onNavigate: (direction: 'next' | 'previous') => void) {
  const touchStartX = useRef<number | undefined>(undefined);
  const pointerStartX = useRef<number | undefined>(undefined);

  function handleTouchStart(event: TouchEvent<HTMLButtonElement>) {
    touchStartX.current = event.changedTouches[0]?.clientX;
  }

  function handleTouchEnd(event: TouchEvent<HTMLButtonElement>) {
    const startX = touchStartX.current;
    touchStartX.current = undefined;
    const endX = event.changedTouches[0]?.clientX;
    if (startX === undefined || endX === undefined) return;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < swipeThresholdPx) return;
    onNavigate(deltaX < 0 ? 'next' : 'previous');
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse') return;
    pointerStartX.current = event.clientX;
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse') return;
    const startX = pointerStartX.current;
    pointerStartX.current = undefined;
    if (startX === undefined) return;
    const deltaX = event.clientX - startX;
    if (Math.abs(deltaX) < swipeThresholdPx) return;
    onNavigate(deltaX < 0 ? 'next' : 'previous');
  }

  return {
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerUp,
    onTouchEnd: handleTouchEnd,
    onTouchStart: handleTouchStart,
  };
}

function SlideCanvas({
  compact = false,
  preview,
  renderMediaAssets = true,
}: {
  compact?: boolean;
  preview: PresenterRemoteSlidePreview | undefined;
  renderMediaAssets?: boolean;
}) {
  if (!preview) {
    return (
      <span className={compact ? 'joystick-slide-canvas joystick-slide-canvas-empty joystick-slide-canvas-compact' : 'joystick-slide-canvas joystick-slide-canvas-empty'}>
        <NotebookText size={compact ? 24 : 38} />
      </span>
    );
  }

  return (
    <span
      className={compact ? 'joystick-slide-canvas joystick-slide-canvas-compact' : 'joystick-slide-canvas'}
      style={{
        aspectRatio: `${preview.width} / ${preview.height}`,
        backgroundColor: preview.backgroundColor,
      }}
    >
      {preview.backgroundImageUrl ? (
        <img alt="" className="joystick-slide-bg" src={preview.backgroundImageUrl} />
      ) : null}
      {preview.elements.map((element) => {
        const style = getElementStyle(element, preview);
        if (element.kind === 'image') {
          if (!element.assetUrl) return null;
          return (
            <img
              alt=""
              className="joystick-slide-element joystick-slide-image"
              key={element.id}
              src={element.assetUrl}
              style={style}
            />
          );
        }
        if (element.kind === 'media') {
          if (renderMediaAssets && element.assetUrl && element.mediaType === 'gif') {
            return (
              <img
                alt=""
                className="joystick-slide-element joystick-slide-image"
                key={element.id}
                src={element.assetUrl}
                style={style}
              />
            );
          }
          if (renderMediaAssets && element.assetUrl && element.mediaType === 'video') {
            return (
              <video
                aria-label="Slide video"
                autoPlay={element.autoplay}
                className="joystick-slide-element joystick-slide-video"
                key={element.id}
                loop={element.loop}
                muted={element.muted}
                playsInline
                src={element.assetUrl}
                style={style}
              />
            );
          }
          return (
            <span className="joystick-slide-element joystick-slide-media" key={element.id} style={style}>
              <span aria-hidden="true">play_arrow</span>
            </span>
          );
        }
        if (element.kind === 'text') {
          return (
            <span
              className="joystick-slide-element joystick-slide-text"
              key={element.id}
              style={{
                ...style,
                alignItems:
                  element.verticalAlign === 'bottom'
                    ? 'flex-end'
                    : element.verticalAlign === 'middle' ? 'center' : 'flex-start',
                color: element.fill,
                fontFamily: element.fontFamily,
                fontSize: `${Math.max(compact ? 3 : 5, (element.fontSize / preview.width) * 100)}cqw`,
                fontWeight: element.fontWeight,
                justifyContent:
                  element.align === 'right'
                    ? 'flex-end'
                    : element.align === 'center' ? 'center' : 'flex-start',
                lineHeight: element.lineHeight ?? 1.05,
                textAlign: element.align,
              }}
            >
              {element.text}
            </span>
          );
        }
        if (element.kind !== 'shape') return null;
        return (
          <span
            className={`joystick-slide-element joystick-slide-shape joystick-slide-shape-${element.shape}`}
            key={element.id}
            style={{
              ...style,
              backgroundColor: element.fill ?? 'transparent',
              borderColor: element.stroke,
              borderWidth: element.strokeWidth,
            }}
          />
        );
      })}
    </span>
  );
}

function StreamPreview({
  onNavigate,
  onStreamPreference,
  stream,
}: {
  onNavigate: (direction: 'next' | 'previous') => void;
  onStreamPreference: (preference: PresenterRemoteStreamPreference) => void;
  stream: MediaStream;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLButtonElement>(null);
  const swipeHandlers = useHorizontalSwipeNavigation(onNavigate);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let lastPreferenceKey = '';
    const publishPreference = () => {
      const preference = createStreamPreference(container);
      const preferenceKey = `${preference.width}x${preference.height}@${preference.fps}:${preference.quality}`;
      if (preferenceKey === lastPreferenceKey) return;
      lastPreferenceKey = preferenceKey;
      onStreamPreference(preference);
    };
    publishPreference();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(publishPreference);
    observer.observe(container);
    return () => observer.disconnect();
  }, [onStreamPreference, stream]);

  function handleClick() {
    onNavigate('next');
  }

  return (
    <button
      type="button"
      ref={containerRef}
      className="joystick-stream-hit-target"
      aria-label="Presenter stream preview"
      onClick={handleClick}
      {...swipeHandlers}
    >
      <video ref={videoRef} autoPlay className="joystick-stream-video" muted playsInline />
    </button>
  );
}

function SlidePreview({
  renderMediaAssets = true,
  onNavigate,
  preview,
}: {
  renderMediaAssets?: boolean;
  onNavigate: (direction: 'next' | 'previous') => void;
  preview: PresenterRemoteSlidePreview | undefined;
}) {
  const swipeHandlers = useHorizontalSwipeNavigation(onNavigate);

  function handleStageClick(event: MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    onNavigate(event.clientX - bounds.left < bounds.width / 2 ? 'previous' : 'next');
  }

  return (
    <button
      type="button"
      className="joystick-stage-button"
      aria-label="Current slide preview"
      onClick={handleStageClick}
      {...swipeHandlers}
    >
      <SlideCanvas preview={preview} renderMediaAssets={renderMediaAssets} />
    </button>
  );
}

function UpcomingSlideStrip({
  onGoToPage,
  previews,
  renderMediaAssets = true,
}: {
  onGoToPage: (pageId: string) => void;
  previews: NonNullable<PresenterRemoteState['upcomingSlidePreviews']>;
  renderMediaAssets?: boolean;
}) {
  if (previews.length === 0) {
    return (
      <section className="joystick-upcoming-strip joystick-upcoming-strip-empty" aria-label="Upcoming slides">
        <span>End of deck</span>
      </section>
    );
  }

  return (
    <section className="joystick-upcoming-strip" aria-label="Upcoming slides">
      {previews.map((item, index) => (
        <button
          type="button"
          className="joystick-upcoming-thumb"
          key={item.pageId}
          aria-label={`Go to upcoming slide ${index + 1}: ${item.pageName}`}
          onClick={() => onGoToPage(item.pageId)}
        >
          <span>Next {index + 1}</span>
          <SlideCanvas compact preview={item.preview} renderMediaAssets={renderMediaAssets} />
        </button>
      ))}
    </section>
  );
}

export function JoystickApp({
  initialUrl = window.location.href,
  signalingService: providedSignalingService,
}: JoystickAppProps) {
  const defaultSignalingService = useMemo(() => createDefaultSignalingService(), []);
  const signalingService = providedSignalingService ?? defaultSignalingService;
  const [code, setCode] = useState(() => getInitialCode(initialUrl));
  const [lastCommand, setLastCommand] = useState<string | undefined>();
  const [remoteState, setRemoteState] = useState<PresenterRemoteState | undefined>();
  const [remoteStateReceivedAt, setRemoteStateReceivedAt] = useState(0);
  const [session, setSession] = useState<PresenterRemoteSession | undefined>();
  const [resolvingSession, setResolvingSession] = useState(true);
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [slideNavigatorOpen, setSlideNavigatorOpen] = useState(false);
  const [notesFontSize, setNotesFontSize] = useState(28);
  const [controllerId] = useState(() => getControllerId());
  const [remoteStream, setRemoteStream] = useState<MediaStream | undefined>();
  const [remoteStreamStatus, setRemoteStreamStatus] = useState<'connected' | 'connecting' | 'failed' | 'idle'>('idle');
  const remoteStreamReceiverRef = useRef<ReturnType<typeof presenterRemoteStreamReceiver.create> | undefined>(undefined);
  const sessionCode = session?.code;

  useEffect(() => {
    let cancelled = false;
    async function resolveSession() {
      setResolvingSession(true);
      const rememberedCode = presenterRemoteSessionCode.normalize(getStoredValue(rememberedCodeKey) ?? '');
      const requestedCode = presenterRemoteSessionCode.isValid(code) ? code : rememberedCode;
      if (requestedCode && presenterRemoteSessionCode.isValid(requestedCode)) {
        const foundSession = await signalingService.lookupSession(requestedCode);
        const connectedSession =
          foundSession && signalingService.connectController
            ? await signalingService.connectController(requestedCode, controllerId)
            : foundSession;
        if (!cancelled) {
          setCode(requestedCode);
          setSession(connectedSession);
          setResolvingSession(false);
        }
        return;
      }

      if (!cancelled) {
        setSession(undefined);
        setResolvingSession(false);
      }
    }

    void resolveSession();
    return () => {
      cancelled = true;
    };
  }, [code, controllerId, signalingService]);

  const status: 'connected' | 'needs-code' = session ? 'connected' : 'needs-code';
  const displayedCode = code || session?.code || '';

  useEffect(() => {
    if (session) setStoredValue(rememberedCodeKey, session.code);
  }, [session]);

  useEffect(() => {
    if (!sessionCode || !signalingService.getPublishedState) return;
    const currentSessionCode = sessionCode;
    let cancelled = false;
    async function refreshState() {
      const nextState = await signalingService.getPublishedState?.(currentSessionCode);
      if (!cancelled) {
        setRemoteState(nextState);
        if (nextState) setRemoteStateReceivedAt(Date.now());
      }
    }
    void refreshState();
    const intervalId = window.setInterval(() => {
      void refreshState();
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [sessionCode, signalingService]);

  useEffect(() => {
    if (!sessionCode) return;
    const intervalId = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [sessionCode]);

  useEffect(() => {
    const shouldUseStream = Boolean(
      sessionCode &&
      remoteState?.presenterMode === 'presenting' &&
      remoteState.previewMode === 'stream' &&
      remoteState.stream?.enabled,
    );
    if (!sessionCode || !shouldUseStream) {
      remoteStreamReceiverRef.current?.stop();
      remoteStreamReceiverRef.current = undefined;
      return;
    }
    remoteStreamReceiverRef.current?.stop();
    const receiver = presenterRemoteStreamReceiver.create({
      controllerId,
      onStatusChange: setRemoteStreamStatus,
      onStream: setRemoteStream,
      sessionCode,
      signaling: createStreamSignalingAdapter(signalingService),
    });
    remoteStreamReceiverRef.current = receiver;
    void receiver.start();
    return () => {
      receiver.stop();
      if (remoteStreamReceiverRef.current === receiver) remoteStreamReceiverRef.current = undefined;
    };
  }, [controllerId, remoteState?.presenterMode, remoteState?.previewMode, remoteState?.stream?.enabled, sessionCode, signalingService]);

  const connectionLabel = useMemo(() => {
    const connectedControllerCount = Math.max(
      1,
      remoteState?.connectedControllerCount ?? session?.connectedControllerCount ?? 0,
    );
    if (status === 'connected') return `Connected (${connectedControllerCount})`;
    if (status === 'needs-code') return 'Enter code';
    return 'Disconnected';
  }, [remoteState, session, status]);

  function sendRemoteCommand(command: PresenterRemoteCommand) {
    if (!session) return;
    const sentByStream = Boolean(remoteStreamReceiverRef.current?.sendCommand(command));
    if (sentByStream) {
      setLastCommand(command.command);
      return;
    }
    void Promise.resolve(signalingService.publishCommand(session.code, command, controllerId))
      .then(() => setLastCommand(command.command));
  }

  const sendStreamPreference = useCallback((preference: PresenterRemoteStreamPreference) => {
    remoteStreamReceiverRef.current?.sendStreamPreference(preference);
  }, []);

  function sendCommand(command: JoystickSimpleCommand) {
    sendRemoteCommand({ command, type: 'command' });
  }

  function navigateSlide(direction: 'next' | 'previous') {
    if (!connected) return;
    const currentIndex = displayedRemoteState?.activePageIndex;
    const targetIndex =
      typeof currentIndex === 'number'
        ? currentIndex + (direction === 'next' ? 1 : -1)
        : undefined;
    const targetPage = typeof targetIndex === 'number' ? pages[targetIndex] : undefined;
    if (targetPage) {
      sendRemoteCommand({ command: 'go-to-page', pageId: targetPage.id, type: 'command' });
      return;
    }
    sendCommand(direction);
  }

  const connected = status === 'connected' && Boolean(session);
  const displayedRemoteState = sessionCode ? remoteState : undefined;
  const slidePosition = displayedRemoteState
    ? `${displayedRemoteState.activePageIndex + 1} / ${displayedRemoteState.pageCount}`
    : connected ? 'Connected' : '-- / --';
  const currentStatusLabel = displayedRemoteState
    ? `Current: Slide ${displayedRemoteState.activePageIndex + 1} of ${displayedRemoteState.pageCount}`
    : 'Current: Waiting';
  const buildsRemainingLabel = `Builds remaining: ${displayedRemoteState?.buildsRemaining ?? 0}`;
  const notes = displayedRemoteState?.notes.trim();
  const timerElapsedMs = displayedRemoteState
    ? displayedRemoteState.timer.elapsedMs +
      (displayedRemoteState.timer.paused
        ? 0
        : timerNow - (displayedRemoteState.timer.updatedAtEpochMs ?? remoteStateReceivedAt))
    : 0;
  const timerLabel = presenterRemoteTimerFormat.formatElapsed(timerElapsedMs);
  const presenterReady = connected && displayedRemoteState?.presenterMode === 'ready';
  const appClassName = presenterReady ? 'joystick-app joystick-app-start' : 'joystick-app';
  const timerPaused = displayedRemoteState?.timer.paused ?? false;
  const timerToggleCommand = timerPaused ? 'resume-timer' : 'pause-timer';
  const pages = displayedRemoteState?.pages ?? [];
  const streamModeActive = connected && displayedRemoteState?.previewMode === 'stream' && remoteStream;
  const renderStructuredMediaAssets = displayedRemoteState?.previewMode !== 'stream';
  const upcomingSlidePreviews = displayedRemoteState?.upcomingSlidePreviews ??
    (displayedRemoteState?.nextSlidePreview
      ? [
          {
            pageId: pages[displayedRemoteState.activePageIndex + 1]?.id ?? 'next-slide',
            pageName: displayedRemoteState.nextPageName ?? 'Next slide',
            preview: displayedRemoteState.nextSlidePreview,
          },
        ]
      : []);

  if (presenterReady) {
    return (
      <main className={appClassName} aria-label="Presentation remote control">
        <header className="joystick-start-topbar">
          <span>{session?.presenterLabel ?? 'Presenter device'}</span>
          <span className={`joystick-status joystick-status-${status}`}>{connectionLabel}</span>
        </header>
        <section className="joystick-start-screen" aria-label="Presenter mode required">
          <p>
            Open presenter mode on <strong>{session?.presenterLabel ?? 'this computer'}</strong> to control{' '}
            <strong>{displayedRemoteState?.deckName ?? 'this presentation'}</strong> from this phone.
          </p>
          <span className="joystick-start-indicator" aria-hidden="true" />
          {lastCommand ? <span className="joystick-start-status">Command sent: {lastCommand}</span> : null}
        </section>
      </main>
    );
  }

  if (streamModeActive) {
    return (
      <main className="joystick-app joystick-app-stream" aria-label="Presentation remote control">
        <header className="joystick-stream-topbar">
          <span className="joystick-page-count" aria-label="Slide position">
            {slidePosition}
          </span>
          <span className={`joystick-status-dot joystick-status-dot-${status}`} aria-label={connectionLabel} />
          <span className="joystick-timer" aria-label="Presentation timer">
            {timerLabel}
          </span>
          <span>{buildsRemainingLabel}</span>
        </header>
        <section className="joystick-stream-stage" aria-label="Streamed presenter preview">
          <StreamPreview stream={remoteStream} onNavigate={navigateSlide} onStreamPreference={sendStreamPreference} />
        </section>
        <UpcomingSlideStrip
          previews={upcomingSlidePreviews}
          onGoToPage={(pageId) => sendRemoteCommand({ command: 'go-to-page', pageId, type: 'command' })}
          renderMediaAssets={false}
        />
        <section className="joystick-stream-notes" aria-label="Presenter notes">
          <div className="joystick-stream-notes-toolbar" aria-label="Notes controls">
            <span>Notes</span>
            <div>
              <button
                type="button"
                aria-label="Decrease notes size"
                onClick={() => setNotesFontSize((current) => Math.max(18, current - 3))}
              >
                <Minus size={17} />
              </button>
              <button
                type="button"
                aria-label="Increase notes size"
                onClick={() => setNotesFontSize((current) => Math.min(54, current + 3))}
              >
                <Plus size={17} />
              </button>
            </div>
          </div>
          {notes ? (
            <div
              className="joystick-stream-notes-content"
              aria-label="Presenter notes content"
              style={{ fontSize: `${notesFontSize}px` }}
            >
              {notes}
            </div>
          ) : (
            <div className="joystick-stream-empty-notes">
              <NotebookText size={34} />
              <p>Presenter notes that are created will appear here</p>
            </div>
          )}
        </section>
        <div className="joystick-stream-controls" aria-label="Remote controls">
          <span>{connectionLabel}</span>
          <button type="button" onClick={() => navigateSlide('previous')} aria-label="Previous slide">
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            onClick={() => sendRemoteCommand({ command: timerToggleCommand, type: 'command' })}
            aria-label={timerPaused ? 'Resume timer' : 'Pause timer'}
          >
            {timerPaused ? <Play size={22} /> : <Pause size={22} />}
          </button>
          <button type="button" onClick={() => sendCommand('reset-timer')} aria-label="Reset timer">
            <TimerReset size={22} />
          </button>
          <button
            type="button"
            disabled={pages.length === 0}
            onClick={() => setSlideNavigatorOpen(true)}
            aria-label="Show slide navigation"
          >
            <List size={22} />
          </button>
        </div>
        {remoteStreamStatus === 'failed' ? (
          <p className="joystick-stream-status">Stream unavailable. Using fallback controls.</p>
        ) : null}
        {slideNavigatorOpen ? (
          <section className="joystick-slide-navigator" role="dialog" aria-modal="true" aria-label="Slide navigation">
            <header>
              <h2>Slides</h2>
              <button type="button" aria-label="Close slide navigation" onClick={() => setSlideNavigatorOpen(false)}>
                <X size={20} />
              </button>
            </header>
            <div className="joystick-slide-navigator-list">
              {pages.map((page, index) => (
                <button
                  type="button"
                  key={page.id}
                  aria-current={page.id === displayedRemoteState?.activePageId ? 'page' : undefined}
                  aria-label={`Go to slide ${index + 1}: ${page.name}`}
                  onClick={() => {
                    sendRemoteCommand({ command: 'go-to-page', pageId: page.id, type: 'command' });
                    setSlideNavigatorOpen(false);
                  }}
                >
                  <span>{index + 1}</span>
                  <strong>{page.name}</strong>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    );
  }

  return (
    <main className={appClassName} aria-label="Presentation remote control">
      <header className="joystick-topbar">
        <span className="joystick-page-count" aria-label="Slide position">
          {slidePosition}
        </span>
        <span className={`joystick-status-dot joystick-status-dot-${status}`} aria-label={connectionLabel} />
        <span className="joystick-timer" aria-label="Presentation timer">
          {timerLabel}
        </span>
        <button
          type="button"
          disabled={!connected}
          onClick={() => sendRemoteCommand({ command: timerToggleCommand, type: 'command' })}
          aria-label={timerPaused ? 'Resume timer' : 'Pause timer'}
        >
          {timerPaused ? <Play size={20} /> : <Pause size={20} />}
        </button>
        <button type="button" disabled={!connected} onClick={() => sendCommand('reset-timer')} aria-label="Reset timer">
          <TimerReset size={20} />
        </button>
        <button
          type="button"
          disabled={!connected || pages.length === 0}
          onClick={() => setSlideNavigatorOpen(true)}
          aria-label="Show slide navigation"
        >
          <List size={20} />
        </button>
      </header>

      <section className="joystick-presenter-meta" aria-label="Presenter status">
        <span>{currentStatusLabel}</span>
        <span>{buildsRemainingLabel}</span>
      </section>

      {!connected ? (
        <section className="joystick-pairing-panel" aria-label="Pair remote">
        <div className="joystick-code-row">
          <label htmlFor="session-code">Code</label>
          <input
            id="session-code"
            inputMode="text"
            maxLength={9}
            value={displayedCode}
            onChange={(event) => setCode(presenterRemoteSessionCode.normalize(event.target.value))}
          />
          <button
            type="button"
            onClick={() => setCode(displayedCode)}
            disabled={!presenterRemoteSessionCode.isValid(displayedCode)}
          >
            Join
          </button>
        </div>
        {session ? (
          <p className="joystick-presenter-name">{session.presenterLabel}</p>
        ) : resolvingSession ? (
          <p className="joystick-help">Looking for the presenter session...</p>
        ) : (
          <p className="joystick-help">Enter the code shown on the presenter screen.</p>
        )}
        </section>
      ) : null}

      <section className="joystick-stage" aria-label="Current slide">
        <SlidePreview
          preview={displayedRemoteState?.slidePreview}
          onNavigate={navigateSlide}
          renderMediaAssets={renderStructuredMediaAssets}
        />
      </section>

      <UpcomingSlideStrip
        previews={upcomingSlidePreviews}
        onGoToPage={(pageId) => sendRemoteCommand({ command: 'go-to-page', pageId, type: 'command' })}
        renderMediaAssets={renderStructuredMediaAssets}
      />

      <section className="joystick-notes-panel" aria-label="Presenter notes">
        <div className="joystick-notes-toolbar" aria-label="Notes controls">
          <span>Notes</span>
          <div>
            <button
              type="button"
              aria-label="Decrease notes size"
              onClick={() => setNotesFontSize((current) => Math.max(18, current - 3))}
            >
              <Minus size={18} />
            </button>
            <button
              type="button"
              aria-label="Increase notes size"
              onClick={() => setNotesFontSize((current) => Math.min(48, current + 3))}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
        {notes ? (
          <div
            className="joystick-notes-content"
            aria-label="Presenter notes content"
            style={{ fontSize: `${notesFontSize}px` }}
          >
            {notes}
          </div>
        ) : (
          <div className="joystick-empty-state">
            <NotebookText size={40} />
            <p>Presenter notes that are created will appear here</p>
          </div>
        )}
      </section>

      {lastCommand ? <p className="joystick-command-status">Command sent: {lastCommand}</p> : null}
      {slideNavigatorOpen ? (
        <section className="joystick-slide-navigator" role="dialog" aria-modal="true" aria-label="Slide navigation">
          <header>
            <h2>Slides</h2>
            <button type="button" aria-label="Close slide navigation" onClick={() => setSlideNavigatorOpen(false)}>
              <X size={20} />
            </button>
          </header>
          <div className="joystick-slide-navigator-list">
            {pages.map((page, index) => (
              <button
                type="button"
                key={page.id}
                aria-current={page.id === displayedRemoteState?.activePageId ? 'page' : undefined}
                aria-label={`Go to slide ${index + 1}: ${page.name}`}
                onClick={() => {
                  sendRemoteCommand({ command: 'go-to-page', pageId: page.id, type: 'command' });
                  setSlideNavigatorOpen(false);
                }}
              >
                <span>{index + 1}</span>
                <strong>{page.name}</strong>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
