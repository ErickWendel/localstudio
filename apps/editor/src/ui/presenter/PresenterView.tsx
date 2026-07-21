import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ChangeEvent as ReactChangeEvent, PointerEvent as ReactPointerEvent } from 'react';
import { AlertTriangle, Captions, Languages, Mic, MonitorUp, Square } from 'lucide-react';
import type {
  Page,
  ProjectDocument,
  SelectionState,
  TranscriptRecording,
  TranscriptSegment,
} from '../../domain/documents/model';
import { pageVisibility } from '../../domain/documents/pageVisibility';
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
import { isKeyboardShortcutEditableTarget } from '../components/isKeyboardShortcutEditableTarget';
import { CanvasWorkspace } from '../editor/canvas/CanvasWorkspace';
import {
  presentationMovieControls,
  type MovieHoldState,
} from '../editor/media/presentationMovieControls';
import { PresenterRemotePanel } from './PresenterRemotePanel';
import { PresenterSlideNavigator } from './PresenterSlideNavigator';
import { PresenterThumbnail } from './PresenterThumbnail';
import {
  buildPresenterTranscriptSegments,
  type PresenterTranscriptSlideMarker,
} from './presenterTranscriptSegments';
import { presenterRemoteMirror } from './presenterRemoteMirror';
import { presenterRemoteStreamPublisher } from './presenterRemoteStreamPublisher';
import { PresenterAudioRecorder } from '../../services/transcription/presenterAudioRecorder';
import { PresenterSpeechTranscriber } from '../../services/transcription/presenterSpeechTranscriber';
import { TRANSLATION_LANGUAGE_OPTIONS } from '../editor/translation/translationLanguages';
import { presenterRemoteTimerFormat } from '@localstudio/presenter-remote/timer-format';
import { PromptModelControl } from '../editor/prompting/PromptModelControl';

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
const defaultRemoteStreamSize = presenterRemoteMirror.size;
const transcriptWindowQueryParam = 'presenterTranscript';
const webSpeechTranscriptionModelId = 'web-speech-api';
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

function getActivePage(project: ProjectDocument, activePageId: string) {
  return pageVisibility.getNearestVisiblePage(project, activePageId) ?? project.pages[0];
}

function getBuildsRemaining(payload: PresenterStatePayload, page: Page) {
  const validBuilds = (page.animationBuilds ?? []).filter((build) =>
    page.elementIds.includes(build.elementId),
  );
  if (validBuilds.length === 0) return 0;
  const preview = payload.animationPreview;
  if (!preview || preview.pageId !== page.id) return validBuilds.length;
  if (preview.phase === 'complete') return 0;
  const hiddenElementIds = new Set(preview.hiddenElementIds);
  return validBuilds.filter((build) => hiddenElementIds.has(build.elementId)).length;
}

function createTranscriptId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getTranscriptChannelName(sessionId: string) {
  return `localstudio-presenter-transcript-${sessionId}`;
}

function postTranscriptChannelMessage(
  channel: BroadcastChannel | undefined,
  message: unknown,
) {
  channel?.postMessage(message);
}

function isTranscriptWindowReadyMessage(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    record.source === 'localstudio-presenter-transcript-window' &&
    record.type === 'ready' &&
    typeof record.sessionId === 'string'
  );
}

function isTranscriptWindowClosedMessage(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    record.source === 'localstudio-presenter-transcript-window' &&
    record.type === 'closed' &&
    typeof record.sessionId === 'string'
  );
}

function normalizeSpeechLanguageCode(languageCode: string | undefined) {
  if (!languageCode) return undefined;
  const normalized = languageCode.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'iw') return 'he-IL';
  if (normalized === 'pt') return 'pt-BR';
  if (normalized === 'en') return 'en-US';
  if (normalized === 'zh-hant') return 'zh-TW';
  if (normalized === 'zh') return 'zh-CN';
  return languageCode;
}

function getLanguageMatchCode(languageCode: string | undefined) {
  return normalizeSpeechLanguageCode(languageCode)?.toLowerCase().split('-')[0];
}

function getPresenterLanguageOption(languageCode: string | undefined) {
  const normalized = getLanguageMatchCode(languageCode);
  return (
    TRANSLATION_LANGUAGE_OPTIONS.find(
      (language) => getLanguageMatchCode(language.code) === normalized,
    ) ?? TRANSLATION_LANGUAGE_OPTIONS.find((language) => language.code === 'pt')!
  );
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
  const [recordingStatus, setRecordingStatus] = useState<
    'idle' | 'downloading' | 'permission-needed' | 'recording' | 'save-failed' | 'saved' | 'transcribing'
  >('idle');
  const [recordingError, setRecordingError] = useState<string | undefined>();
  const [selectedTranscriptionLanguageCode, setSelectedTranscriptionLanguageCode] = useState(
    () => getPresenterLanguageOption(undefined).code,
  );
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const remoteStreamSize = defaultRemoteStreamSize;
  const [slideNavigatorOpen, setSlideNavigatorOpen] = useState(false);
  const [slideNavigatorIndex, setSlideNavigatorIndex] = useState(0);
  const [introDismissed, setIntroDismissed] = useState(getInitialIntroDismissed);
  const [dismissIntroForever, setDismissIntroForever] = useState(false);
  const emptySelection = useMemo<SelectionState>(() => ({ elementIds: [], pageId: '' }), []);
  const openerRef = useRef<Window | null>(getPresenterOpener());
  const movieHoldStateRef = useRef<MovieHoldState | undefined>(undefined);
  const remoteMirrorCanvasRef = useRef<HTMLCanvasElement>(null);
  const remoteStreamPublisherRef = useRef<ReturnType<typeof presenterRemoteStreamPublisher.create> | undefined>(undefined);
  const presenterStageRef = useRef<HTMLElement>(null);
  const presenterRemotePanelRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const activePageMetadataRef = useRef<
    { pageId: string; pageIndex: number; pageName: string } | undefined
  >(undefined);
  const recorderRef = useRef<PresenterAudioRecorder | undefined>(undefined);
  const recordingStartedAtRef = useRef(0);
  const recordingObjectUrlRef = useRef<string | undefined>(undefined);
  const transcriptChannelRef = useRef<BroadcastChannel | undefined>(undefined);
  const speechTranscriberRef = useRef<PresenterSpeechTranscriber | undefined>(undefined);
  const fullTranscriptTextRef = useRef('');
  const slideTranscriptMarkersRef = useRef<PresenterTranscriptSlideMarker[]>([]);
  const transcriptSegmentsRef = useRef<TranscriptSegment[]>([]);
  const transcriptionLanguageCodeRef = useRef<string | undefined>(undefined);
  const transcriptionLanguageTouchedRef = useRef(false);
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
    postCommand({ command: 'update-timer', timer: { ...timer, updatedAtEpochMs: Date.now() } });
  }, [postCommand]);
  const elapsedMs = timerPaused ? timerBaseMs : timerBaseMs + (timerNow - timerStartedAt);

  const applyTimerCommand = useCallback((command: 'pause-timer' | 'reset-timer' | 'resume-timer') => {
    if (command === 'pause-timer') {
      const currentElapsedMs = elapsedMsRef.current;
      setTimerBaseMs(currentElapsedMs);
      setTimerPaused(true);
      publishTimerState({ elapsedMs: currentElapsedMs, paused: true });
      return;
    }
    if (command === 'resume-timer') {
      const now = Date.now();
      setTimerNow(now);
      setTimerStartedAt(now);
      setTimerPaused(false);
      publishTimerState({ elapsedMs: timerBaseMsRef.current, paused: false });
      return;
    }
    const now = Date.now();
    setTimerBaseMs(0);
    setTimerNow(now);
    setTimerStartedAt(now);
    setTimerPaused(false);
    publishTimerState({ elapsedMs: 0, paused: false });
  }, [publishTimerState]);

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
    transcriptChannelRef.current = new BroadcastChannel(getTranscriptChannelName(resolvedSessionId));
    return () => {
      transcriptChannelRef.current?.close();
      transcriptChannelRef.current = undefined;
    };
  }, [resolvedSessionId]);

  useEffect(() => {
    return () => {
      void speechTranscriberRef.current?.stop();
      recorderRef.current?.revokeObjectUrl();
      if (recordingObjectUrlRef.current) URL.revokeObjectURL(recordingObjectUrlRef.current);
    };
  }, []);

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
        applyTimerCommand('pause-timer');
        return;
      }
      if (event.data.command === 'resume-timer') {
        applyTimerCommand('resume-timer');
        return;
      }
      if (event.data.command === 'reset-timer') {
        applyTimerCommand('reset-timer');
      }
    }

    window.addEventListener('message', handleMessage);
    postCommand({ command: 'request-state' });
    postCommand({ command: 'resume-timer' });
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [applyTimerCommand, postCommand, resolvedSessionId]);

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

  const visiblePages = useMemo(
    () => (snapshot ? pageVisibility.getVisiblePages(snapshot.project) : []),
    [snapshot],
  );
  const activePage = snapshot ? getActivePage(snapshot.project, snapshot.activePageId) : undefined;
  const currentSnapshotLanguageCode = snapshot?.transcriptionLanguage?.code;
  const selectedTranscriptionLanguage = useMemo(
    () => getPresenterLanguageOption(selectedTranscriptionLanguageCode),
    [selectedTranscriptionLanguageCode],
  );
  const transcriptionLanguageCode = normalizeSpeechLanguageCode(selectedTranscriptionLanguage.code);
  const activePageId = activePage?.id;
  const activePageName = activePage?.name;
  const activePageIndex = activePage
    ? Math.max(0, visiblePages.findIndex((page) => page.id === activePage.id))
    : 0;
  const upcomingPages = visiblePages.slice(activePageIndex + 1, activePageIndex + 3);
  const buildsRemaining = snapshot && activePage ? getBuildsRemaining(snapshot, activePage) : 0;
  const speakerNotes = activePage?.speakerNotes ?? '';
  const currentTimeLabel = currentTime.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const recordingStatusLabel =
    recordingStatus === 'idle'
      ? 'Recorder ready'
    : recordingStatus === 'downloading'
        ? 'Starting live transcription'
        : recordingStatus === 'permission-needed'
          ? 'Microphone permission needed'
          : recordingStatus === 'recording'
            ? `Recording ${transcriptSegments.length} segments`
            : recordingStatus === 'transcribing'
              ? 'Transcribing audio'
              : recordingStatus === 'saved'
                ? 'Recording saved'
                : 'Recording failed';

  useEffect(() => {
    if (transcriptionLanguageTouchedRef.current) return;
    setSelectedTranscriptionLanguageCode(getPresenterLanguageOption(currentSnapshotLanguageCode).code);
  }, [currentSnapshotLanguageCode]);

  useEffect(() => {
    transcriptionLanguageCodeRef.current = transcriptionLanguageCode;
  }, [transcriptionLanguageCode]);

  useEffect(() => {
    activePageMetadataRef.current =
      activePageId && activePageName
        ? { pageId: activePageId, pageIndex: activePageIndex, pageName: activePageName }
        : undefined;
  }, [activePageId, activePageIndex, activePageName]);

  function updateSpeakerNotes(event: ReactChangeEvent<HTMLTextAreaElement>) {
    const notes = event.target.value;
    if (!activePageId) return;
    postCommand({ command: 'update-notes', notes, pageId: activePageId });
  }

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

  const publishTranscriptState = useCallback(
    (nextStatus = recordingStatus) => {
      postTranscriptChannelMessage(transcriptChannelRef.current, {
        segments: transcriptSegmentsRef.current,
        sessionId: resolvedSessionId,
        source: 'localstudio-presenter-transcript',
        status: nextStatus,
        type: 'state',
      });
    },
    [recordingStatus, resolvedSessionId],
  );

  const getCurrentTranscriptMarker = useCallback(
    (
      textOffset: number,
      pageMetadata = activePageMetadataRef.current,
    ): PresenterTranscriptSlideMarker => ({
      id: createTranscriptId('slide-marker'),
      startMs: Math.max(0, Date.now() - recordingStartedAtRef.current),
      textOffset,
      ...pageMetadata,
    }),
    [],
  );

  const refreshTranscriptSegments = useCallback(
    (transcriptText: string, final: boolean) => {
      const markers = slideTranscriptMarkersRef.current;
      if (!markers.length) return;
      const segments = buildPresenterTranscriptSegments(markers, {
        currentTimeMs: Math.max(0, Date.now() - recordingStartedAtRef.current),
        final,
        transcriptText,
      });
      transcriptSegmentsRef.current = segments;
      setTranscriptSegments(segments);
      publishTranscriptState(final ? 'saved' : 'recording');
    },
    [publishTranscriptState],
  );

  useEffect(() => {
    if (recordingStatus !== 'recording') return;
    const currentPage = activePageMetadataRef.current;
    const lastMarker = slideTranscriptMarkersRef.current.at(-1);
    if (
      lastMarker &&
      lastMarker.pageId === currentPage?.pageId &&
      lastMarker.pageIndex === currentPage?.pageIndex
    ) {
      return;
    }
    slideTranscriptMarkersRef.current = [
      ...slideTranscriptMarkersRef.current,
      getCurrentTranscriptMarker(fullTranscriptTextRef.current.length),
    ];
    refreshTranscriptSegments(fullTranscriptTextRef.current, false);
  }, [
    activePageId,
    activePageIndex,
    getCurrentTranscriptMarker,
    recordingStatus,
    refreshTranscriptSegments,
  ]);

  const updateLiveTranscript = useCallback(
    (text: string, final: boolean) => {
      if (!text.trim()) return;
      if (!slideTranscriptMarkersRef.current.length) {
        slideTranscriptMarkersRef.current = [getCurrentTranscriptMarker(0)];
      }
      fullTranscriptTextRef.current = text;
      refreshTranscriptSegments(text, final);
    },
    [getCurrentTranscriptMarker, refreshTranscriptSegments],
  );

  const startRecording = useCallback(async () => {
    if (
      recordingStatus === 'recording' ||
      recordingStatus === 'downloading' ||
      recordingStatus === 'transcribing'
    ) {
      return false;
    }
    try {
      if (recordingObjectUrlRef.current) URL.revokeObjectURL(recordingObjectUrlRef.current);
      recordingObjectUrlRef.current = undefined;
      setRecordingError(undefined);
      setTranscriptSegments([]);
      fullTranscriptTextRef.current = '';
      transcriptSegmentsRef.current = [];
      slideTranscriptMarkersRef.current = [];
      const recorder = new PresenterAudioRecorder();
      recorderRef.current = recorder;
      await recorder.start();
      recordingStartedAtRef.current = Date.now();
      slideTranscriptMarkersRef.current = [getCurrentTranscriptMarker(0)];
      refreshTranscriptSegments('', false);
      const speechTranscriber = new PresenterSpeechTranscriber({
        onError: (message) => setRecordingError(message),
        onTranscript: (update) => updateLiveTranscript(update.text, update.final),
      });
      try {
        speechTranscriber.start(transcriptionLanguageCodeRef.current);
      } catch (error) {
        recorder.cancel();
        recorderRef.current = undefined;
        throw error;
      }
      speechTranscriberRef.current = speechTranscriber;
      setRecordingStatus('recording');
      publishTranscriptState('recording');
      return true;
    } catch (error) {
      setRecordingError(error instanceof Error ? error.message : 'Microphone permission is required.');
      setRecordingStatus('permission-needed');
      return false;
    }
  }, [
    getCurrentTranscriptMarker,
    publishTranscriptState,
    recordingStatus,
    refreshTranscriptSegments,
    updateLiveTranscript,
  ]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    try {
      setRecordingStatus('transcribing');
      await speechTranscriberRef.current?.stop();
      const finalTranscriptText = speechTranscriberRef.current?.getText();
      if (finalTranscriptText) {
        updateLiveTranscript(finalTranscriptText, true);
      } else {
        refreshTranscriptSegments(fullTranscriptTextRef.current, true);
      }
      const result = await recorder.stop();
      const objectUrl = recorder.getObjectUrl() ?? URL.createObjectURL(result.blob);
      recordingObjectUrlRef.current = objectUrl;
      const now = new Date().toISOString();
      const recordingId = createTranscriptId('recording');
      const recording: TranscriptRecording = {
        id: recordingId,
        name: `Presenter recording ${new Date(now).toLocaleString()}`,
        createdAt: now,
        updatedAt: now,
        durationMs: result.durationMs,
        ...(transcriptionLanguageCode ? { language: transcriptionLanguageCode } : {}),
        modelPresetId: webSpeechTranscriptionModelId,
        audio: {
          mimeType: result.mimeType,
          objectUrl,
          storage: 'inline',
        },
        segments: transcriptSegmentsRef.current,
      };
      postCommand({ audioBlob: result.blob, command: 'save-recording', recording });
      setRecordingStatus('saved');
      publishTranscriptState('saved');
    } catch (error) {
      setRecordingError(error instanceof Error ? error.message : 'Recording could not be saved.');
      setRecordingStatus('save-failed');
      publishTranscriptState('save-failed');
    } finally {
      recorderRef.current = undefined;
      speechTranscriberRef.current = undefined;
    }
  }, [
    postCommand,
    publishTranscriptState,
    refreshTranscriptSegments,
    transcriptionLanguageCode,
    updateLiveTranscript,
  ]);

  useEffect(() => {
    const channel = transcriptChannelRef.current;
    if (!channel) return undefined;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (isTranscriptWindowReadyMessage(event.data)) {
        if ((event.data as { sessionId: string }).sessionId !== resolvedSessionId) return;
        publishTranscriptState();
        return;
      }
      if (!isTranscriptWindowClosedMessage(event.data)) return;
      if ((event.data as { sessionId: string }).sessionId !== resolvedSessionId) return;
      if (recordingStatus === 'recording') {
        void stopRecording();
      }
    };
    return () => {
      if (channel.onmessage) channel.onmessage = null;
    };
  }, [publishTranscriptState, recordingStatus, resolvedSessionId, stopRecording]);

  const openTranscriptWindow = useCallback(async () => {
    if (recordingStatus !== 'recording') {
      setRecordingError('You should choose your microphone first.');
      const started = await startRecording();
      if (started) {
        setRecordingError('You should choose your microphone first. Click live transcription again after choosing your microphone.');
      }
      return;
    }
    setRecordingError(undefined);
    const transcriptWindow = window.open(
      'about:blank',
      `localstudio-transcript-${resolvedSessionId}`,
      'popup,width=900,height=760',
    );
    if (!transcriptWindow) {
      setRecordingError('Live transcription window was blocked by the browser.');
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('presenter');
    url.searchParams.set(transcriptWindowQueryParam, '1');
    url.searchParams.set('presenterSession', resolvedSessionId);
    transcriptWindow.location.href = url.toString();
    publishTranscriptState();
  }, [publishTranscriptState, recordingStatus, resolvedSessionId, startRecording]);

  const handleTranscriptionLanguageChange = useCallback(
    (event: ReactChangeEvent<HTMLSelectElement>) => {
      transcriptionLanguageTouchedRef.current = true;
      setSelectedTranscriptionLanguageCode(event.target.value);
      void speechTranscriberRef.current?.setLanguage(normalizeSpeechLanguageCode(event.target.value));
    },
    [],
  );

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
    const page = visiblePages[index];
    if (!page) return false;
    if (recordingStatus === 'recording') {
      const lastMarker = slideTranscriptMarkersRef.current.at(-1);
      if (lastMarker?.pageId !== page.id || lastMarker?.pageIndex !== index) {
        slideTranscriptMarkersRef.current = [
          ...slideTranscriptMarkersRef.current,
          getCurrentTranscriptMarker(fullTranscriptTextRef.current.length, {
            pageId: page.id,
            pageIndex: index,
            pageName: page.name,
          }),
        ];
        refreshTranscriptSegments(fullTranscriptTextRef.current, false);
      }
    }
    setSlideNavigatorIndex(index);
    postCommand({ command: 'go-to-page', pageId: page.id });
    return true;
  }, [
    getCurrentTranscriptMarker,
    postCommand,
    recordingStatus,
    refreshTranscriptSegments,
    visiblePages,
  ]);

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
        Math.min(Math.max(0, visiblePages.length - 1), current + 1),
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
      goToPage(visiblePages.length - 1);
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
    visiblePages,
  ]);

  function dismissIntro() {
    if (dismissIntroForever) window.localStorage.setItem(introStorageKey, '1');
    setIntroDismissed(true);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isKeyboardShortcutEditableTarget(event.target)) return;

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
            Math.min(Math.max(0, visiblePages.length - 1), current + 1),
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
    visiblePages.length,
  ]);

  useEffect(() => {
    return () => {
      movieHoldStateRef.current = presentationMovieControls.stopHold(movieHoldStateRef.current);
    };
  }, []);

  useEffect(() => {
    const canvas = remoteMirrorCanvasRef.current;
    if (!canvas || !snapshot || !activePage) return;
    const render = () => {
      presenterRemoteMirror.renderFrame(canvas, {
        activePage,
        activePageIndex,
        animationPreview: snapshot.animationPreview,
        buildsRemaining,
        currentTimeLabel,
        project: snapshot.project,
        timerLabel: presenterRemoteTimerFormat.formatElapsed(elapsedMs),
        videoElements: getPresenterVideos(),
      }, remoteStreamSize);
    };
    render();
    const intervalId = window.setInterval(render, 125);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [activePage, activePageIndex, buildsRemaining, currentTimeLabel, elapsedMs, remoteStreamSize, snapshot]);

  useEffect(() => {
    const canvas = remoteMirrorCanvasRef.current;
    const sessionCode = snapshot?.remoteSession?.code;
    if (!canvas || !sessionCode) {
      remoteStreamPublisherRef.current?.stop();
      remoteStreamPublisherRef.current = undefined;
      return;
    }
    remoteStreamPublisherRef.current?.stop();
    const publisher = presenterRemoteStreamPublisher.create({
      canvas,
      onPeerId: (peerId) => postCommand({ command: 'update-stream-peer', peerId }),
    });
    remoteStreamPublisherRef.current = publisher;
    publisher.start();
    return () => {
      publisher.stop();
      if (remoteStreamPublisherRef.current === publisher) remoteStreamPublisherRef.current = undefined;
    };
  }, [postCommand, snapshot?.remoteSession?.code]);

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
      <canvas
        aria-hidden="true"
        className="presenter-remote-mirror-canvas"
        height={presenterRemoteMirror.size.height}
        ref={remoteMirrorCanvasRef}
        width={presenterRemoteMirror.size.width}
      />
      <section className="presenter-main">
        <header className="presenter-topbar">
          <div className="presenter-clock-group">
            <span className="presenter-clock">{currentTimeLabel}</span>
            <span className="presenter-divider" aria-hidden="true" />
            <span className="presenter-timer">{presenterRemoteTimerFormat.formatElapsed(elapsedMs)}</span>
          </div>
          <div className="presenter-controls ew-compact-row" aria-label="Presenter controls">
            <div className="presenter-speaking-language">
              <span className="presenter-speaking-language-prefix">I will speak in:</span>
              <label className="presenter-transcription-language">
                <Languages size={16} aria-hidden="true" />
                <select
                  aria-label="Transcription language"
                  disabled={recordingStatus === 'downloading' || recordingStatus === 'transcribing'}
                  value={selectedTranscriptionLanguage.code}
                  onChange={handleTranscriptionLanguageChange}
                >
                  {TRANSLATION_LANGUAGE_OPTIONS.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {snapshot.promptModel ? (
              <PromptModelControl
                compact
                disabled={recordingStatus === 'downloading' || recordingStatus === 'transcribing'}
                state={snapshot.promptModel}
                onCancelDownload={(modelId) => {
                  postCommand({ command: 'cancel-prompt-model-download', modelId });
                  return Promise.resolve();
                }}
                onPrepare={() => {
                  postCommand({ command: 'prepare-prompt-api' });
                  return Promise.resolve();
                }}
                onProviderChange={(providerId) => {
                  postCommand({ command: 'set-prompt-provider', providerId });
                }}
              />
            ) : null}
            <button
              className="stitch-icon-button presenter-control-button"
              type="button"
              aria-label={recordingStatus === 'recording' ? 'Stop recording' : 'Start recording'}
              disabled={recordingStatus === 'downloading' || recordingStatus === 'transcribing'}
              onClick={() => {
                void (recordingStatus === 'recording' ? stopRecording() : startRecording());
              }}
            >
              {recordingStatus === 'recording' ? (
                <Square size={18} aria-hidden="true" />
              ) : (
                <Mic size={18} aria-hidden="true" />
              )}
            </button>
            <button
              className="stitch-icon-button presenter-control-button"
              type="button"
              aria-label="Open live transcription window"
              disabled={recordingStatus === 'downloading' || recordingStatus === 'transcribing'}
              onClick={() => {
                void openTranscriptWindow();
              }}
            >
              <MonitorUp size={18} aria-hidden="true" />
            </button>
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
        <div className="presenter-status-stack" aria-label="Presenter status">
          <div className="presenter-status-row">
            <span className="presenter-status-item ew-ellipsis">
              Current: Slide {activePageIndex + 1} of {visiblePages.length}
            </span>
            <span className="presenter-status-item ew-ellipsis">
              Builds remaining: {buildsRemaining}
            </span>
            <span className="presenter-status-item presenter-recording-status ew-ellipsis">
              <Captions size={18} aria-hidden="true" />
              {recordingStatusLabel}
              {recordingError ? <span className="presenter-sr-status-warning">{recordingError}</span> : null}
            </span>
          </div>
          {recordingError ? (
            <div className="presenter-recording-alert" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{recordingError}</span>
            </div>
          ) : null}
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
          defaultValue={speakerNotes}
          key={activePage.id}
          placeholder="Add notes to your design"
          style={{ fontSize: `${notesFontSize}px` }}
          onChange={updateSpeakerNotes}
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
        <PresenterSlideNavigator
          onActivateSlide={goToPage}
          onClose={() => setSlideNavigatorOpen(false)}
          onSelectSlide={setSlideNavigatorIndex}
          pages={visiblePages}
          selectedIndex={slideNavigatorIndex}
        />
      ) : null}
      {introOverlay}
    </main>
  );
}
