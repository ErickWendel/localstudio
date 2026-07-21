import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Captions, ListMusic, Maximize2, Pause, Play, SendHorizontal, Square, X } from 'lucide-react';
import type {
  ElementAnimationBuild,
  Page,
  ProjectDocument,
  SelectionState,
  TranscriptRecording,
} from '../../domain/documents/model';
import type { FontImportService, ShareService } from '../../services/contracts/interfaces';
import { TranscriptQuestionAnsweringService } from '../../services/transcription/transcriptQuestionAnsweringService';
import type { TranscriptAnswer } from '../../services/transcription/transcriptQuestionAnsweringService';
import { webGpuTextGenerationRuntime } from '../../services/prompting/webGpuTextGenerationRuntime';
import {
  KeyboardShortcutsDialog,
  type KeyboardShortcutAction,
  type KeyboardShortcutGroup,
} from '../components/KeyboardShortcutsDialog';
import { isKeyboardShortcutEditableTarget } from '../components/isKeyboardShortcutEditableTarget';
import { CanvasWorkspace } from '../editor/canvas/CanvasWorkspace';
import { ProjectVideoPreloader } from '../editor/media/ProjectVideoPreloader';
import {
  presentationMovieControls,
  type MovieHoldState,
} from '../editor/media/presentationMovieControls';
import { MiniPagePreview } from '../editor/panels/PageMiniPreview';
import { preloadPublicDeckAssets } from './publicDeckAssetPreloader';

interface PublicDeckViewerProps {
  shareId: string;
  fontImportService: FontImportService;
  shareService: ShareService;
  embed?: boolean;
}

type ViewerState =
  | { status: 'preloading'; loaded: number; project?: ProjectDocument; total: number }
  | { status: 'missing' }
  | { status: 'ready'; project: ProjectDocument };

interface AnimationPreviewState {
  activeBuild: ElementAnimationBuild | undefined;
  activeBuildElementId: string | undefined;
  animationProgress: number;
  hiddenElementIds: string[];
  mode: 'presenter';
  pageId: string;
  phase: 'transition' | 'animation' | 'waiting' | 'complete';
  playing: boolean;
  waitingForClick: boolean;
}

interface PublicPodcastChapter {
  id: string;
  endMs: number | undefined;
  pageIndex: number;
  pageName: string;
  startMs: number;
}

type PublicPlaybackSource = 'overlay' | 'podcast';

const nativeControlActivationKeys = new Set([' ', 'Enter', 'Spacebar']);

function isKeyboardShortcutControlActivation(event: KeyboardEvent) {
  if (!nativeControlActivationKeys.has(event.key)) return false;
  return (
    isKeyboardShortcutInteractiveTarget(event.target) ||
    isKeyboardShortcutInteractiveTarget(document.activeElement)
  );
}

function isKeyboardShortcutInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest('button, a[href], [role="button"], [role="link"]'))
  );
}

const publicDeckShortcutActions = [
  'black-screen',
  'cursor-toggle',
  'decrease-notes',
  'fast-forward-movie',
  'previous-slide',
  'first-slide',
  'increase-notes',
  'jump-movie-end',
  'jump-movie-start',
  'last-slide',
  'next-build',
  'next-navigator-slide',
  'next-slide',
  'open-slide-navigator',
  'pause-presentation',
  'play-pause-movie',
  'previous-build',
  'previous-navigator-slide',
  'reset-timer',
  'rewind-movie',
  'select-navigator-slide',
  'shortcut-toggle',
  'show-slide-number',
  'white-screen',
  'scroll-notes-up',
  'scroll-notes-down',
] satisfies KeyboardShortcutAction[];

const publicDeckShortcutGroups = [
  {
    title: 'Navigation',
    items: [
      { action: 'next-build', keys: ['→', '↓'], label: 'Advance to next build' },
      { action: 'previous-build', keys: ['['], label: 'Go back to previous build' },
      { action: 'next-build', keys: [']'], label: 'Advance and skip build' },
      { action: 'next-slide', keys: ['Shift', '↓'], label: 'Advance to next slide' },
      { action: 'previous-slide', keys: ['←', '↑'], label: 'Go back to previous slide' },
      { action: 'first-slide', keys: ['Home'], label: 'Go to first slide' },
      { action: 'last-slide', keys: ['End'], label: 'Go to last slide' },
    ],
  },
  {
    title: 'Other',
    items: [
      { action: 'shortcut-toggle', keys: ['?'], label: 'Show or hide Keyboard Shortcuts window' },
      { action: 'pause-presentation', keys: ['F'], label: 'Pause presentation; press any key to resume' },
      { action: 'black-screen', keys: ['B'], label: 'Pause presentation and show black screen' },
      { action: 'white-screen', keys: ['W'], label: 'Pause presentation and show white screen' },
      { action: 'cursor-toggle', keys: ['C'], label: 'Show or hide the pointer cursor' },
      { action: 'show-slide-number', keys: ['S'], label: 'Display the current slide number' },
    ],
  },
  {
    title: 'Slide Navigator',
    items: [
      { action: 'open-slide-navigator', keys: ['#'], label: 'Open the slide navigator' },
      { action: 'next-navigator-slide', keys: ['+'], label: 'Go to the next slide in the slide navigator' },
      { action: 'previous-navigator-slide', keys: ['-'], label: 'Go to the previous slide in the slide navigator' },
      { action: 'select-navigator-slide', keys: ['Return'], label: 'Go to the current slide in the slide navigator' },
    ],
  },
  {
    title: 'Presenter Display',
    items: [
      { action: 'reset-timer', keys: ['R'], label: 'Reset timer' },
      { action: 'scroll-notes-up', keys: ['U'], label: 'Scroll notes up' },
      { action: 'scroll-notes-down', keys: ['D'], label: 'Scroll notes down' },
      { action: 'increase-notes', keys: ['⌘', '+'], label: 'Increase note font size' },
      { action: 'decrease-notes', keys: ['⌘', '-'], label: 'Decrease note font size' },
    ],
  },
  {
    title: 'Movies',
    items: [
      { action: 'play-pause-movie', keys: ['K'], label: 'Pause/Play movie' },
      { action: 'rewind-movie', keys: ['J'], label: 'Hold to rewind movie' },
      { action: 'fast-forward-movie', keys: ['L'], label: 'Hold to fast forward movie' },
      { action: 'jump-movie-start', keys: ['I'], label: 'Jump to beginning of movie' },
      { action: 'jump-movie-end', keys: ['O'], label: 'Jump to end of movie' },
    ],
  },
] satisfies KeyboardShortcutGroup[];

interface PublicPlaybackSync {
  currentTimeMs: number;
  durationMs: number;
  playing: boolean;
  recordingId: string;
  source: PublicPlaybackSource;
}

function formatTranscriptTimestamp(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function getTranscriptRecordings(project: ProjectDocument): TranscriptRecording[] {
  return Object.values(project.recordings ?? {}).filter((recording) => recording.segments.length > 0);
}

function getRecordingTimePercent(currentMs: number, durationMs: number) {
  if (durationMs <= 0) return 0;
  return Math.min(100, Math.max(0, (currentMs / durationMs) * 100));
}

function getSlidePositionPercent(pageIndex: number, pageCount: number) {
  if (pageCount <= 1) return 0;
  return (pageIndex / Math.max(1, pageCount - 1)) * 100;
}

function getSlidePreviewAlignment(pageIndex: number, pageCount: number) {
  if (pageIndex <= 1) {
    return { left: '0px', translateX: '0%' };
  }
  if (pageIndex >= pageCount - 2) {
    return { left: '100%', translateX: '-100%' };
  }
  return { left: '50%', translateX: '-50%' };
}

function stripSlideLabel(text: string) {
  return text.replace(/^\[Slide \d+\]\s*/i, '').trim();
}

function resolveTranscriptSegmentPageIndex(
  segment: TranscriptRecording['segments'][number],
  pages: Page[],
  segmentIndex: number,
) {
  if (segment.pageId) {
    const pageIndex = pages.findIndex((page) => page.id === segment.pageId);
    if (pageIndex !== -1) return pageIndex;
  }
  if (typeof segment.pageIndex === 'number' && segment.pageIndex >= 0 && segment.pageIndex < pages.length) {
    return segment.pageIndex;
  }
  if (segment.pageName) {
    const pageIndex = pages.findIndex((page) => page.name === segment.pageName);
    if (pageIndex !== -1) return pageIndex;
  }
  return segmentIndex === 0 ? 0 : undefined;
}

function createPublicPodcastChapters(recording: TranscriptRecording | undefined, pages: Page[]) {
  if (!recording || pages.length === 0) return [];
  const chaptersByPageIndex = new Map<number, PublicPodcastChapter>();

  recording.segments.forEach((segment, segmentIndex) => {
    const pageIndex = resolveTranscriptSegmentPageIndex(segment, pages, segmentIndex);
    if (pageIndex === undefined) return;
    const page = pages[pageIndex];
    if (!page) return;
    const currentChapter = chaptersByPageIndex.get(pageIndex);
    const startMs = Math.max(0, segment.startMs);
    const endMs = segment.endMs > startMs ? segment.endMs : undefined;
    if (!currentChapter || startMs < currentChapter.startMs) {
      chaptersByPageIndex.set(pageIndex, {
        id: `${recording.id}-${page.id}`,
        endMs,
        pageIndex,
        pageName: page.name,
        startMs,
      });
      return;
    }
    if (endMs && (!currentChapter.endMs || endMs > currentChapter.endMs)) {
      chaptersByPageIndex.set(pageIndex, { ...currentChapter, endMs });
    }
  });

  return Array.from(chaptersByPageIndex.values())
    .sort((first, second) => first.startMs - second.startMs);
}

function getActivePodcastChapter(chapters: PublicPodcastChapter[], currentTimeMs: number) {
  if (!chapters.length) return undefined;
  return chapters.reduce<PublicPodcastChapter | undefined>((activeChapter, chapter) => {
    if (chapter.startMs > currentTimeMs) return activeChapter;
    return chapter;
  }, chapters[0]);
}

function getPodcastChapterForPage(chapters: PublicPodcastChapter[], pageIndex: number) {
  return chapters.find((chapter) => chapter.pageIndex === pageIndex);
}

function getPodcastChapterEndMs(
  chapter: PublicPodcastChapter,
  chapters: PublicPodcastChapter[],
  totalMs: number,
) {
  const chapterIndex = chapters.findIndex((candidate) => candidate.id === chapter.id);
  const nextChapter = chapterIndex === -1 ? undefined : chapters[chapterIndex + 1];
  return nextChapter?.startMs ?? chapter.endMs ?? totalMs;
}

function getActiveTranscriptSegment(recording: TranscriptRecording | undefined, currentTimeMs: number) {
  if (!recording) return undefined;
  return recording.segments.find((segment, index) => {
    const nextSegment = recording.segments[index + 1];
    const segmentEndMs = segment.endMs > segment.startMs ? segment.endMs : nextSegment?.startMs;
    if (currentTimeMs < segment.startMs) return false;
    return segmentEndMs === undefined ? true : currentTimeMs < segmentEndMs;
  });
}

function getTranscriptSegmentPageIndex(
  segment: TranscriptRecording['segments'][number],
  pages: Page[],
  segmentIndex: number,
) {
  return resolveTranscriptSegmentPageIndex(segment, pages, segmentIndex) ?? 0;
}

function getBuildPlaybackDurationMs(build: ElementAnimationBuild) {
  return Math.max(0, build.durationMs ?? build.delayMs);
}

function hasFinishedAssetPreload(loaded: number, total: number) {
  if (total === 0) return true;
  return loaded >= total;
}

const PUBLIC_DECK_PAGE_MEDIA_PRELOAD_TIMEOUT_MS = 5000;
const TRANSCRIPT_PROMPT_EXAMPLES = [
  'Summarize this presentation in 3 bullets',
  'What was explained on the current slide?',
  'List the key takeaways with timestamps',
];

type PageMediaPreloadEntry = { type: 'gif' | 'video'; url: string };

function getPageMediaPreloadEntries(project: ProjectDocument, pageIndex: number) {
  const page = project.pages[pageIndex];
  if (!page) return [];
  const entries = new Map<string, PageMediaPreloadEntry>();
  for (const elementId of page.elementIds) {
    const element = project.elements[elementId];
    if (
      !element ||
      (element.type !== 'video' && element.type !== 'gif') ||
      element.visible === false
    ) {
      continue;
    }
    const assetUrl = project.assets[element.assetId]?.objectUrl;
    if (assetUrl) entries.set(`${element.type}:${assetUrl}`, { type: element.type, url: assetUrl });
  }
  return Array.from(entries.values());
}

function preloadPageGif(url: string, signal: AbortSignal) {
  if (signal.aborted || typeof Image === 'undefined') return Promise.resolve();
  const image = new Image();

  return new Promise<void>((resolve) => {
    let timeoutId: number | undefined;
    const finish = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      image.removeEventListener('load', finish);
      image.removeEventListener('error', finish);
      signal.removeEventListener('abort', finish);
      resolve();
    };

    timeoutId = window.setTimeout(finish, PUBLIC_DECK_PAGE_MEDIA_PRELOAD_TIMEOUT_MS);
    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', finish, { once: true });
    signal.addEventListener('abort', finish, { once: true });
    image.src = url;
  });
}

function preloadPageVideo(url: string, signal: AbortSignal) {
  if (signal.aborted || typeof document === 'undefined') return Promise.resolve();
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  return new Promise<void>((resolve) => {
    let timeoutId: number | undefined;
    const finish = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      video.removeEventListener('loadeddata', finish);
      video.removeEventListener('error', finish);
      signal.removeEventListener('abort', finish);
      video.removeAttribute('src');
      video.load();
      resolve();
    };

    timeoutId = window.setTimeout(finish, PUBLIC_DECK_PAGE_MEDIA_PRELOAD_TIMEOUT_MS);
    video.addEventListener('loadeddata', finish, { once: true });
    video.addEventListener('error', finish, { once: true });
    signal.addEventListener('abort', finish, { once: true });
    video.src = url;
    video.load();
  });
}

async function preloadPageMedia(entries: PageMediaPreloadEntry[], signal: AbortSignal) {
  if (entries.length === 0) return;
  await Promise.all(
    entries.map((entry) =>
      entry.type === 'gif' ? preloadPageGif(entry.url, signal) : preloadPageVideo(entry.url, signal),
    ),
  );
}

function PublicTranscriptPromptComposer({
  answer,
  error,
  isAnswering,
  question,
  onQuestionChange,
  onStop,
  onSubmit,
}: {
  answer: TranscriptAnswer | undefined;
  error: string | undefined;
  isAnswering: boolean;
  question: string;
  onQuestionChange: (question: string) => void;
  onStop: () => void;
  onSubmit: (question: string) => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = '0px';
    input.style.height = `${Math.min(Math.max(input.scrollHeight, 20), 112)}px`;
  }, [question]);

  function submitQuestion(nextQuestion = question) {
    const trimmedQuestion = nextQuestion.trim();
    if (!trimmedQuestion || isAnswering) return;
    onQuestionChange(trimmedQuestion);
    onSubmit(trimmedQuestion);
  }

  return (
    <section className="public-transcript-composer prompt-stack" aria-label="Ask recording">
      {answer ? (
        <article className="public-transcript-answer" aria-live="polite">
          <p>{answer.text}</p>
          <div>
            {answer.citations.map((citation) => (
              <span key={`${citation.recordingId}-${citation.segmentId}`}>
                {formatTranscriptTimestamp(citation.startMs)}
              </span>
            ))}
          </div>
        </article>
      ) : null}
      {error ? (
        <p className="public-deck-status public-transcript-answer-status">{error}</p>
      ) : null}
      {isAnswering ? (
        <p className="prompt-generation-status">Building transcript answer...</p>
      ) : null}
      <div className="prompt-examples" aria-label="Transcript prompt examples">
        {TRANSCRIPT_PROMPT_EXAMPLES.map((example) => (
          <button
            key={example}
            className="prompt-example-chip"
            disabled={isAnswering}
            type="button"
            onClick={() => {
              onQuestionChange(example);
              inputRef.current?.focus();
              submitQuestion(example);
            }}
          >
            {example}
          </button>
        ))}
      </div>
      <form
        className={isAnswering ? 'prompt-bar prompt-bar-processing' : 'prompt-bar'}
        aria-busy={isAnswering}
        aria-label="Transcript question prompt"
        onSubmit={(event) => {
          event.preventDefault();
          submitQuestion();
        }}
      >
        <div className="prompt-input-cluster ew-compact-row">
          <textarea
            ref={inputRef}
            aria-label="Question for transcript chat"
            disabled={isAnswering}
            placeholder="Ask about this presentation..."
            rows={1}
            value={question}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submitQuestion();
              }
            }}
            onChange={(event) => onQuestionChange(event.target.value)}
          />
        </div>
        <div className="prompt-submit-actions" data-tour-id="prompt-submit-actions">
          {isAnswering ? (
            <button
              className="icon-button icon-button-danger"
              type="button"
              aria-label="Stop transcript answer"
              onClick={onStop}
            >
              <Square size={16} aria-hidden="true" />
            </button>
          ) : (
            <button
              className="icon-button"
              type="submit"
              aria-label="Ask transcript"
              disabled={!question.trim()}
            >
              <SendHorizontal size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function PublicDeckSlideList({
  activeChapter,
  activePageIndex,
  chaptersByPageIndex,
  onSelectPage,
  onToggleChapterPlayback,
  pages,
  playing = false,
  project,
}: {
  activeChapter?: PublicPodcastChapter | undefined;
  activePageIndex: number;
  chaptersByPageIndex?: ReadonlyMap<number, PublicPodcastChapter>;
  onSelectPage: (pageIndex: number) => void;
  onToggleChapterPlayback?: (chapter: PublicPodcastChapter) => void;
  pages: Page[];
  playing?: boolean;
  project: ProjectDocument;
}) {
  return (
    <div className="public-podcast-chapters" aria-label="Presentation slides">
      <div className="public-podcast-chapters-heading">
        <span>Slides</span>
        <strong>{pages.length}</strong>
      </div>
      {pages.map((page, pageIndex) => {
        const chapter = chaptersByPageIndex?.get(pageIndex);
        const isActiveSlide = pageIndex === activePageIndex;
        return (
          <article
            className={
              isActiveSlide
                ? 'public-podcast-slide public-podcast-chapter-active page-card page-card-active'
                : 'public-podcast-slide page-card'
            }
            key={page.id}
            aria-label={`Slide ${pageIndex + 1}: ${page.name}`}
          >
            <span className="page-card-number">{pageIndex + 1}</span>
            <button
              className="page-card-preview"
              style={{ aspectRatio: `${page.width} / ${page.height}` }}
              type="button"
              aria-label={`Open slide ${pageIndex + 1}: ${page.name}`}
              onClick={() => onSelectPage(pageIndex)}
            >
              <MiniPagePreview page={page} project={project} visible={page.visible ?? true} />
            </button>
            <span className="public-podcast-slide-body page-card-body">
              {chaptersByPageIndex ? (
                chapter ? (
                  <span className="public-podcast-chapter-time">
                    {formatTranscriptTimestamp(chapter.startMs)}
                  </span>
                ) : (
                  <span className="public-podcast-chapter-time public-podcast-chapter-time-empty">
                    No audio
                  </span>
                )
              ) : null}
              <strong>Slide {pageIndex + 1}</strong>
              <em>{page.name}</em>
            </span>
            {chapter && onToggleChapterPlayback ? (
              <button
                className="public-podcast-chapter-icon"
                type="button"
                aria-label={`${chapter.id === activeChapter?.id && playing ? 'Pause' : 'Play'} slide ${pageIndex + 1}`}
                onClick={() => onToggleChapterPlayback(chapter)}
              >
                {chapter.id === activeChapter?.id && playing ? (
                  <Pause size={14} aria-hidden="true" />
                ) : (
                  <Play size={14} aria-hidden="true" />
                )}
              </button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function PublicTranscriptPodcastPlayer({
  activePageIndex,
  onSelectPage,
  onPlaybackSync,
  playbackSync,
  project,
  pages,
  recordings,
}: {
  activePageIndex: number;
  onSelectPage: (pageIndex: number) => void;
  onPlaybackSync: (sync: PublicPlaybackSync) => void;
  playbackSync: PublicPlaybackSync | undefined;
  project: ProjectDocument;
  pages: Page[];
  recordings: TranscriptRecording[];
}) {
  const [recordingId, setRecordingId] = useState<string | undefined>();
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const suppressMediaSyncRef = useRef(false);
  const transcriptSegmentRefs = useRef(new Map<string, HTMLButtonElement>());
  const lastSyncedChapterIdRef = useRef<string | undefined>(undefined);
  const selectedRecording = useMemo(
    () =>
      recordings.find((recording) => recording.id === recordingId) ??
      recordings.find((recording) => recording.audio.objectUrl) ??
      recordings[0],
    [recordingId, recordings],
  );
  const chapters = useMemo(
    () => createPublicPodcastChapters(selectedRecording, pages),
    [pages, selectedRecording],
  );
  const activeChapter = useMemo(
    () => getActivePodcastChapter(chapters, currentTimeMs),
    [chapters, currentTimeMs],
  );
  const activeSegment = useMemo(
    () => getActiveTranscriptSegment(selectedRecording, currentTimeMs),
    [currentTimeMs, selectedRecording],
  );
  const totalMs = selectedRecording?.durationMs || durationMs || 0;
  const progressPercent = getRecordingTimePercent(currentTimeMs, totalMs);
  const activePageChapter = useMemo(
    () => getPodcastChapterForPage(chapters, activePageIndex),
    [activePageIndex, chapters],
  );
  const chaptersByPageIndex = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.pageIndex, chapter])),
    [chapters],
  );

  function publishPlaybackSync(nextTimeMs = currentTimeMs, nextPlaying = playing) {
    if (!selectedRecording) return;
    onPlaybackSync({
      currentTimeMs: nextTimeMs,
      durationMs: totalMs,
      playing: nextPlaying,
      recordingId: selectedRecording.id,
      source: 'podcast',
    });
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.load();
      audio.currentTime = 0;
    }
    lastSyncedChapterIdRef.current = undefined;
    const timeoutId = window.setTimeout(() => {
      setCurrentTimeMs(0);
      setDurationMs(selectedRecording?.durationMs ?? 0);
      setPlaying(false);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedRecording?.durationMs, selectedRecording?.id]);

  useEffect(() => {
    if (!playbackSync || playbackSync.source === 'podcast') return;
    if (playbackSync.recordingId !== selectedRecording?.id) return;
    const audio = audioRef.current;
    if (audio && Math.abs(audio.currentTime * 1000 - playbackSync.currentTimeMs) > 250) {
      audio.currentTime = playbackSync.currentTimeMs / 1000;
    }
    if (!playbackSync.playing && audio) {
      suppressMediaSyncRef.current = true;
      audio.pause();
      window.setTimeout(() => {
        suppressMediaSyncRef.current = false;
      }, 0);
    }
    const timeoutId = window.setTimeout(() => {
      setCurrentTimeMs(playbackSync.currentTimeMs);
      setDurationMs(playbackSync.durationMs || selectedRecording?.durationMs || 0);
      setPlaying(playbackSync.playing);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [playbackSync, selectedRecording?.durationMs, selectedRecording?.id]);

  useEffect(() => {
    if (playing || !activePageChapter) return;
    const audio = audioRef.current;
    if (audio) audio.currentTime = activePageChapter.startMs / 1000;
    lastSyncedChapterIdRef.current = activePageChapter.id;
    const timeoutId = window.setTimeout(() => {
      setCurrentTimeMs(activePageChapter.startMs);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [activePageChapter, playing]);

  useEffect(() => {
    if (!playing || !activeChapter) return;
    if (lastSyncedChapterIdRef.current === activeChapter.id) return;
    lastSyncedChapterIdRef.current = activeChapter.id;
    onSelectPage(activeChapter.pageIndex);
  }, [activeChapter, onSelectPage, playing]);

  useEffect(() => {
    const activeTranscriptSegment = selectedRecording?.segments.find((segment, segmentIndex) => {
      return getTranscriptSegmentPageIndex(segment, pages, segmentIndex) === activePageIndex;
    });
    if (!activeTranscriptSegment) return;
    const activeTranscriptNode = transcriptSegmentRefs.current.get(activeTranscriptSegment.id);
    activeTranscriptNode?.scrollIntoView?.({
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [activePageIndex, pages, selectedRecording]);

  function updateProgress() {
    const audio = audioRef.current;
    if (!audio) return;
    const nextCurrentTimeMs = Math.round(audio.currentTime * 1000);
    const clampedCurrentTimeMs = Math.min(nextCurrentTimeMs, selectedRecording?.durationMs ?? nextCurrentTimeMs);
    setCurrentTimeMs(clampedCurrentTimeMs);
    if (!selectedRecording?.durationMs && Number.isFinite(audio.duration) && audio.duration > 0) {
      setDurationMs(Math.round(audio.duration * 1000));
    }
    publishPlaybackSync(clampedCurrentTimeMs, playing);
  }

  function syncIdleAudioToActivePageChapter(audio: HTMLAudioElement) {
    if (playing || !activePageChapter) return false;
    audio.currentTime = activePageChapter.startMs / 1000;
    setCurrentTimeMs(activePageChapter.startMs);
    lastSyncedChapterIdRef.current = activePageChapter.id;
    return true;
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !selectedRecording?.audio.objectUrl) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      publishPlaybackSync(currentTimeMs, false);
      return;
    }
    if (activePageChapter) {
      const activePageChapterEndMs = getPodcastChapterEndMs(activePageChapter, chapters, totalMs);
      const shouldRestartSlideClip =
        activeChapter?.pageIndex !== activePageIndex ||
        currentTimeMs < activePageChapter.startMs ||
        currentTimeMs >= Math.max(activePageChapter.startMs, activePageChapterEndMs - 120);
      if (shouldRestartSlideClip) {
        audio.currentTime = activePageChapter.startMs / 1000;
        setCurrentTimeMs(activePageChapter.startMs);
        lastSyncedChapterIdRef.current = activePageChapter.id;
      }
    }
    const timeDifferenceMs = Math.abs(audio.currentTime * 1000 - currentTimeMs);
    if (timeDifferenceMs > 250) {
      audio.currentTime = currentTimeMs / 1000;
    }
    void audio.play()
      .then(() => {
        setPlaying(true);
        publishPlaybackSync(Math.round(audio.currentTime * 1000), true);
      })
      .catch(() => setPlaying(false));
  }

  function seekToChapter(chapter: PublicPodcastChapter) {
    const audio = audioRef.current;
    if (audio) audio.currentTime = chapter.startMs / 1000;
    setCurrentTimeMs(chapter.startMs);
    lastSyncedChapterIdRef.current = chapter.id;
    onSelectPage(chapter.pageIndex);
    publishPlaybackSync(chapter.startMs, playing);
  }

  function toggleChapterPlayback(chapter: PublicPodcastChapter) {
    const audio = audioRef.current;
    if (!audio) return;
    const isActiveChapter = chapter.id === activeChapter?.id;
    if (isActiveChapter && playing) {
      audio.pause();
      setPlaying(false);
      publishPlaybackSync(currentTimeMs, false);
      return;
    }
    seekToChapter(chapter);
    void audio.play()
      .then(() => {
        setPlaying(true);
        publishPlaybackSync(chapter.startMs, true);
      })
      .catch(() => setPlaying(false));
  }

  function playSegment(segment: TranscriptRecording['segments'][number], segmentIndex: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const pageIndex = getTranscriptSegmentPageIndex(segment, pages, segmentIndex);
    const nextTimeMs = Math.max(0, segment.startMs);
    audio.currentTime = nextTimeMs / 1000;
    setCurrentTimeMs(nextTimeMs);
    const nextChapter = getPodcastChapterForPage(chapters, pageIndex);
    lastSyncedChapterIdRef.current = nextChapter?.id;
    onSelectPage(pageIndex);
    void audio.play()
      .then(() => {
        setPlaying(true);
        publishPlaybackSync(nextTimeMs, true);
      })
      .catch(() => setPlaying(false));
  }

  function selectSlide(pageIndex: number) {
    const chapter = chaptersByPageIndex.get(pageIndex);
    if (chapter) {
      seekToChapter(chapter);
      return;
    }
    onSelectPage(pageIndex);
  }

  if (!selectedRecording?.audio.objectUrl) {
    return <p className="public-deck-status">No public recording audio was published with this deck.</p>;
  }

  return (
    <section className="public-podcast-player" aria-label="Podcast playback">
      <audio
        ref={audioRef}
        preload="metadata"
        src={selectedRecording.audio.objectUrl}
        onDurationChange={updateProgress}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => {
          if (!syncIdleAudioToActivePageChapter(event.currentTarget)) updateProgress();
        }}
        onPause={() => {
          setPlaying(false);
          if (suppressMediaSyncRef.current) return;
          publishPlaybackSync(currentTimeMs, false);
        }}
        onPlay={() => {
          setPlaying(true);
          publishPlaybackSync(currentTimeMs, true);
        }}
        onTimeUpdate={updateProgress}
      >
        <track kind="captions" />
      </audio>
      <div className="public-podcast-transport">
        <button
          className="public-podcast-play"
          type="button"
          aria-label={playing ? 'Pause podcast audio' : 'Play podcast audio'}
          onClick={togglePlayback}
        >
          {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
        </button>
        <div className="public-podcast-meta">
          <span>
            <ListMusic size={15} aria-hidden="true" />
            Podcast mode
          </span>
          <select
            aria-label="Podcast recording"
            value={selectedRecording.id}
            onChange={(event) => {
              const nextRecordingId = event.target.value;
              setRecordingId(nextRecordingId);
              const nextRecording = recordings.find((recording) => recording.id === nextRecordingId);
              if (nextRecording) {
                onPlaybackSync({
                  currentTimeMs: 0,
                  durationMs: nextRecording.durationMs,
                  playing: false,
                  recordingId: nextRecording.id,
                  source: 'podcast',
                });
              }
            }}
          >
            {recordings.map((recording) => (
              <option key={recording.id} value={recording.id}>
                {recording.name}
              </option>
            ))}
          </select>
        </div>
        <div className="public-podcast-time" aria-label="Podcast audio time">
          <span>{formatTranscriptTimestamp(currentTimeMs)}</span>
          <span>{formatTranscriptTimestamp(totalMs)}</span>
        </div>
      </div>
      <div className="public-podcast-rail">
        <div
          className="public-podcast-progress"
          style={{ '--public-podcast-progress': `${progressPercent}%` } as CSSProperties}
        />
        <input
          aria-label="Seek podcast audio"
          max={Math.max(1, Math.round(totalMs / 1000))}
          min={0}
          step={1}
          type="range"
          value={Math.round(currentTimeMs / 1000)}
          onChange={(event) => {
            const nextSeconds = Number(event.target.value);
            const audio = audioRef.current;
            if (audio) audio.currentTime = nextSeconds;
            setCurrentTimeMs(nextSeconds * 1000);
            publishPlaybackSync(nextSeconds * 1000, playing);
          }}
        />
      </div>
      <PublicDeckSlideList
        activeChapter={activeChapter}
        activePageIndex={activePageIndex}
        chaptersByPageIndex={chaptersByPageIndex}
        pages={pages}
        playing={playing}
        project={project}
        onSelectPage={selectSlide}
        onToggleChapterPlayback={toggleChapterPlayback}
      />
      <section className="public-transcript-list public-podcast-transcript-list" aria-label="Transcript">
        <article>
          <h3>{selectedRecording.name}</h3>
          <ol>
            {selectedRecording.segments.map((segment, segmentIndex) => {
              const segmentPageIndex = getTranscriptSegmentPageIndex(segment, pages, segmentIndex);
              const isActiveSlideSegment = segmentPageIndex === activePageIndex;
              const isActiveTimeSegment = segment.id === activeSegment?.id;
              return (
                <li
                  className={[
                    isActiveSlideSegment ? 'public-transcript-segment-active-slide' : '',
                    isActiveTimeSegment ? 'public-transcript-segment-active-time' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  key={segment.id}
                >
                  <time>{formatTranscriptTimestamp(segment.startMs)}</time>
                  <button
                    ref={(node) => {
                      if (node) {
                        transcriptSegmentRefs.current.set(segment.id, node);
                        return;
                      }
                      transcriptSegmentRefs.current.delete(segment.id);
                    }}
                    type="button"
                    aria-label={`Play transcript segment for slide ${segmentPageIndex + 1} at ${formatTranscriptTimestamp(segment.startMs)}`}
                    onClick={() => playSegment(segment, segmentIndex)}
                  >
                    {segment.text}
                  </button>
                </li>
              );
            })}
          </ol>
        </article>
      </section>
    </section>
  );
}

function PublicDeckPlaybackOverlay({
  activePageIndex,
  canGoNext,
  canGoPrevious,
  keyboardShortcutsOpen,
  onEnterSlideFullscreen,
  onOpenTranscript,
  onPlaybackSync,
  onSelectPage,
  onToggleKeyboardShortcuts,
  playbackSync,
  project,
  recordings,
}: {
  activePageIndex: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  keyboardShortcutsOpen: boolean;
  onEnterSlideFullscreen: () => void;
  onOpenTranscript: () => void;
  onPlaybackSync: (sync: PublicPlaybackSync) => void;
  onSelectPage: (pageIndex: number) => void;
  onToggleKeyboardShortcuts: () => void;
  playbackSync: PublicPlaybackSync | undefined;
  project: ProjectDocument;
  recordings: TranscriptRecording[];
}) {
  const [captionsVisible, setCaptionsVisible] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const suppressMediaSyncRef = useRef(false);
  const lastSyncedChapterIdRef = useRef<string | undefined>(undefined);
  const selectedRecording = useMemo(
    () =>
      recordings.find((recording) => recording.id === playbackSync?.recordingId) ??
      recordings.find((recording) => recording.audio.objectUrl) ??
      recordings[0],
    [playbackSync?.recordingId, recordings],
  );
  const { pages } = project;
  const chapters = useMemo(
    () => (selectedRecording ? createPublicPodcastChapters(selectedRecording, pages) : []),
    [pages, selectedRecording],
  );
  const activeChapter = useMemo(
    () => getActivePodcastChapter(chapters, currentTimeMs),
    [chapters, currentTimeMs],
  );
  const activeSegment = useMemo(
    () => getActiveTranscriptSegment(selectedRecording, currentTimeMs),
    [currentTimeMs, selectedRecording],
  );
  const activeSegmentPageIndex = activeSegment
    ? getTranscriptSegmentPageIndex(activeSegment, pages, selectedRecording?.segments.indexOf(activeSegment) ?? 0)
    : undefined;
  const captionText =
    activeSegment && activeSegmentPageIndex === activePageIndex ? stripSlideLabel(activeSegment.text) : '';
  const hasAudio = Boolean(selectedRecording?.audio.objectUrl);
  const hasCaptions = Boolean(captionText);
  const totalMs = selectedRecording?.durationMs || durationMs || Math.max(0, pages.length - 1) * 1000;
  const chaptersByPageIndex = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.pageIndex, chapter])),
    [chapters],
  );
  const lastRecordedChapter = chapters.at(-1);
  const lastRecordedSlidePercent = lastRecordedChapter
    ? getSlidePositionPercent(lastRecordedChapter.pageIndex, pages.length)
    : 0;
  const progressPercent =
    lastRecordedSlidePercent * (getRecordingTimePercent(currentTimeMs, totalMs) / 100);

  function publishPlaybackSync(nextTimeMs = currentTimeMs, nextPlaying = playing) {
    if (!selectedRecording) return;
    onPlaybackSync({
      currentTimeMs: nextTimeMs,
      durationMs: totalMs,
      playing: nextPlaying,
      recordingId: selectedRecording.id,
      source: 'overlay',
    });
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.load();
    }
    lastSyncedChapterIdRef.current = undefined;
    const timeoutId = window.setTimeout(() => {
      setCurrentTimeMs(0);
      setDurationMs(selectedRecording?.durationMs ?? 0);
      setPlaying(false);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectedRecording?.durationMs, selectedRecording?.id]);

  useEffect(() => {
    if (!playbackSync || playbackSync.source === 'overlay') return;
    if (playbackSync.recordingId !== selectedRecording?.id) return;
    const audio = audioRef.current;
    if (audio && Math.abs(audio.currentTime * 1000 - playbackSync.currentTimeMs) > 250) {
      audio.currentTime = playbackSync.currentTimeMs / 1000;
    }
    if (!playbackSync.playing && audio) {
      suppressMediaSyncRef.current = true;
      audio.pause();
      window.setTimeout(() => {
        suppressMediaSyncRef.current = false;
      }, 0);
    }
    const timeoutId = window.setTimeout(() => {
      setCurrentTimeMs(playbackSync.currentTimeMs);
      setDurationMs(playbackSync.durationMs || selectedRecording?.durationMs || 0);
      setPlaying(playbackSync.playing);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [playbackSync, selectedRecording?.durationMs, selectedRecording?.id]);

  useEffect(() => {
    if (!playing || !activeChapter) return;
    if (lastSyncedChapterIdRef.current === activeChapter.id) return;
    lastSyncedChapterIdRef.current = activeChapter.id;
    onSelectPage(activeChapter.pageIndex);
  }, [activeChapter, onSelectPage, playing]);

  useEffect(() => {
    if (playing) return;
    const activePageChapter = getPodcastChapterForPage(chapters, activePageIndex);
    if (!activePageChapter) return;
    const audio = audioRef.current;
    if (audio) audio.currentTime = activePageChapter.startMs / 1000;
    lastSyncedChapterIdRef.current = activePageChapter.id;
    const timeoutId = window.setTimeout(() => {
      setCurrentTimeMs(activePageChapter.startMs);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [activePageIndex, chapters, playing]);

  function updateProgress() {
    const audio = audioRef.current;
    if (!audio) return;
    const nextCurrentTimeMs = Math.round(audio.currentTime * 1000);
    setCurrentTimeMs(nextCurrentTimeMs);
    if (!selectedRecording?.durationMs && Number.isFinite(audio.duration) && audio.duration > 0) {
      setDurationMs(Math.round(audio.duration * 1000));
    }
    publishPlaybackSync(nextCurrentTimeMs, playing);
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !selectedRecording?.audio.objectUrl) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      publishPlaybackSync(currentTimeMs, false);
      return;
    }
    const activePageChapter = getPodcastChapterForPage(chapters, activePageIndex);
    if (activePageChapter) {
      const activePageChapterEndMs = getPodcastChapterEndMs(activePageChapter, chapters, totalMs);
      const shouldRestartSlideClip =
        activeChapter?.pageIndex !== activePageIndex ||
        currentTimeMs < activePageChapter.startMs ||
        currentTimeMs >= Math.max(activePageChapter.startMs, activePageChapterEndMs - 120);
      if (shouldRestartSlideClip) {
        audio.currentTime = activePageChapter.startMs / 1000;
        setCurrentTimeMs(activePageChapter.startMs);
        lastSyncedChapterIdRef.current = activePageChapter.id;
      }
    }
    void audio.play()
      .then(() => {
        setPlaying(true);
        publishPlaybackSync(Math.round(audio.currentTime * 1000), true);
      })
      .catch(() => setPlaying(false));
  }

  function seekToTime(nextTimeMs: number) {
    const nextSeconds = Math.max(0, nextTimeMs) / 1000;
    const audio = audioRef.current;
    if (audio) audio.currentTime = nextSeconds;
    setCurrentTimeMs(Math.round(nextSeconds * 1000));
    publishPlaybackSync(Math.round(nextSeconds * 1000), playing);
  }

  function seekToChapter(chapter: PublicPodcastChapter) {
    seekToTime(chapter.startMs);
    lastSyncedChapterIdRef.current = chapter.id;
    onSelectPage(chapter.pageIndex);
  }

  function goToSlide(pageIndex: number) {
    const chapter = getPodcastChapterForPage(chapters, pageIndex);
    if (chapter) {
      seekToChapter(chapter);
      return;
    }
    onSelectPage(pageIndex);
  }

  return (
    <>
      {selectedRecording?.audio.objectUrl ? (
        <audio
          ref={audioRef}
          preload="metadata"
          src={selectedRecording.audio.objectUrl}
          onDurationChange={updateProgress}
          onEnded={() => setPlaying(false)}
          onLoadedMetadata={updateProgress}
          onPause={() => {
            setPlaying(false);
            if (suppressMediaSyncRef.current) return;
            publishPlaybackSync(currentTimeMs, false);
          }}
          onPlay={() => {
            setPlaying(true);
            publishPlaybackSync(currentTimeMs, true);
          }}
          onTimeUpdate={updateProgress}
        >
          <track kind="captions" />
        </audio>
      ) : null}
      {captionsVisible && captionText ? (
        <div className="public-deck-caption-overlay" aria-live="polite">
          {captionText}
        </div>
      ) : null}
      <section className="public-deck-playback-overlay" aria-label="Presentation playback">
        <div className="public-deck-playback-rail">
          <div
            className="public-deck-playback-progress"
            style={{ '--public-deck-progress': `${progressPercent}%` } as CSSProperties}
          />
          {pages.map((page, pageIndex) => {
            const chapter = chaptersByPageIndex.get(pageIndex);
            const slideLeftPercent = getSlidePositionPercent(pageIndex, pages.length);
            const previewAlignment = getSlidePreviewAlignment(pageIndex, pages.length);
            return (
              <button
                key={page.id}
                className={[
                  'public-deck-playback-chapter-dot',
                  pageIndex === activePageIndex ? 'public-deck-playback-chapter-dot-active' : '',
                  chapter ? 'public-deck-playback-chapter-dot-recorded' : 'public-deck-playback-chapter-dot-empty',
                ]
                  .filter(Boolean)
                  .join(' ')}
                type="button"
                aria-label={`Jump to slide ${pageIndex + 1}: ${page.name}`}
                style={
                  {
                    '--public-deck-chapter-left': `${slideLeftPercent}%`,
                    '--public-deck-chapter-preview-left': previewAlignment.left,
                    '--public-deck-chapter-preview-x': previewAlignment.translateX,
                  } as CSSProperties
                }
                onClick={() => goToSlide(pageIndex)}
              >
                <span className="public-deck-playback-chapter-preview" aria-hidden="true">
                  <MiniPagePreview page={page} project={project} visible={page.visible ?? true} />
                  <strong>Slide {pageIndex + 1}</strong>
                  <em>{chapter ? formatTranscriptTimestamp(chapter.startMs) : 'No audio'}</em>
                </span>
              </button>
            );
          })}
          <input
            aria-label="Seek presentation audio"
            max={Math.max(1, Math.round(totalMs / 1000))}
            min={0}
            step={1}
            type="range"
            value={Math.round(currentTimeMs / 1000)}
            onChange={(event) => seekToTime(Number(event.target.value) * 1000)}
          />
        </div>
        <div className="public-deck-playback-controls">
          <button
            className="public-deck-playback-button public-deck-playback-button-primary"
            disabled={!hasAudio}
            type="button"
            aria-label={
              hasAudio
                ? playing
                  ? 'Pause presentation audio'
                  : 'Play presentation audio'
                : 'Presentation audio unavailable'
            }
            onClick={togglePlayback}
          >
            {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
          </button>
          <span className="public-deck-playback-time">
            {formatTranscriptTimestamp(currentTimeMs)} / {formatTranscriptTimestamp(totalMs)}
          </span>
          <span className="public-deck-playback-page-count">
            {activePageIndex + 1} / {pages.length}
          </span>
          <button
            className="public-deck-playback-chapter-pill"
            type="button"
            aria-label="Open transcript chat"
            onClick={onOpenTranscript}
          >
            <ListMusic size={16} aria-hidden="true" />
            <span>
              {activeChapter
                ? `Slide ${activeChapter.pageIndex + 1}: ${activeChapter.pageName}`
                : selectedRecording?.name ?? 'Slides'}
            </span>
          </button>
          <div className="public-deck-playback-spacer" />
          <button
            className="public-deck-playback-button"
            disabled={!canGoPrevious}
            type="button"
            aria-label="Previous slide"
            onClick={() => goToSlide(activePageIndex - 1)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              chevron_left
            </span>
          </button>
          <button
            className="public-deck-playback-button"
            disabled={!canGoNext}
            type="button"
            aria-label="Next slide"
            onClick={() => goToSlide(activePageIndex + 1)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              chevron_right
            </span>
          </button>
          <button
            className={
              captionsVisible
                ? 'public-deck-playback-button public-deck-playback-button-active'
                : 'public-deck-playback-button'
            }
            disabled={!hasCaptions}
            type="button"
            aria-label={
              hasCaptions ? (captionsVisible ? 'Hide captions' : 'Show captions') : 'Captions unavailable'
            }
            aria-pressed={captionsVisible}
            onClick={() => setCaptionsVisible((current) => !current)}
          >
            <Captions size={18} aria-hidden="true" />
          </button>
          <button
            className="public-deck-playback-button"
            type="button"
            aria-label="Show keyboard shortcuts"
            aria-expanded={keyboardShortcutsOpen}
            onClick={onToggleKeyboardShortcuts}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              keyboard
            </span>
          </button>
          <button
            className="public-deck-playback-button"
            type="button"
            aria-label="Present slide fullscreen"
            onClick={onEnterSlideFullscreen}
          >
            <Maximize2 size={18} aria-hidden="true" />
          </button>
        </div>
      </section>
    </>
  );
}

export function PublicDeckViewer({
  shareId,
  fontImportService,
  shareService,
  embed = false,
}: PublicDeckViewerProps) {
  const [viewerState, setViewerState] = useState<ViewerState>({
    status: 'preloading',
    loaded: 0,
    total: 0,
  });
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [animationPreview, setAnimationPreview] = useState<AnimationPreviewState | undefined>();
  const animationQueueRef = useRef<ElementAnimationBuild[]>([]);
  const animationTimeoutsRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const pagePreloadAbortRef = useRef<AbortController | undefined>(undefined);
  const runNextAnimationBuildRef = useRef<() => void>(() => undefined);
  const movieHoldStateRef = useRef<MovieHoldState | undefined>(undefined);
  const transcriptQaServiceRef = useRef<TranscriptQuestionAnsweringService | undefined>(undefined);
  const transcriptAnswerRunIdRef = useRef(0);
  const emptySelection = useMemo<SelectionState>(() => ({ pageId: '', elementIds: [] }), []);
  const [transcriptPanelOpen, setTranscriptPanelOpen] = useState(false);
  const [slideListOpen, setSlideListOpen] = useState(false);
  const [publicPlaybackSync, setPublicPlaybackSync] = useState<PublicPlaybackSync | undefined>();
  const [slideOnlyFullscreen, setSlideOnlyFullscreen] = useState(false);
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
  const publicViewerRef = useRef<HTMLElement | null>(null);
  const [transcriptQuestion, setTranscriptQuestion] = useState('');
  const [transcriptAnswer, setTranscriptAnswer] = useState<TranscriptAnswer | undefined>();
  const [transcriptAnswerStatus, setTranscriptAnswerStatus] = useState<
    'answering' | 'failed' | 'idle'
  >('idle');
  const [transcriptAnswerError, setTranscriptAnswerError] = useState<string | undefined>();
  const viewerClassName = embed
    ? 'public-deck-viewer public-deck-viewer-embed'
    : 'public-deck-viewer public-deck-viewer-present';

  const enterSlideOnlyFullscreen = useCallback(() => {
    setTranscriptPanelOpen(false);
    setSlideListOpen(false);
    setSlideOnlyFullscreen(true);
    const viewerElement = publicViewerRef.current;
    if (!viewerElement?.requestFullscreen) return;
    void viewerElement.requestFullscreen().catch(() => {
      setSlideOnlyFullscreen(false);
    });
  }, []);

  const getPublicDeckVideos = useCallback(() => {
    const viewerElement = publicViewerRef.current;
    if (!viewerElement) return [];
    return Array.from(
      viewerElement.querySelectorAll<HTMLVideoElement>('.public-deck-stage-shell video'),
    );
  }, []);

  const controlPublicDeckMovies = useCallback((action: 'end' | 'play-toggle' | 'start') => {
    return presentationMovieControls.control(getPublicDeckVideos(), action);
  }, [getPublicDeckVideos]);

  const pulsePublicDeckMovieHold = useCallback((action: 'fast-forward' | 'rewind') => {
    movieHoldStateRef.current = presentationMovieControls.pulse(
      getPublicDeckVideos(),
      action,
      movieHoldStateRef.current,
    );
  }, [getPublicDeckVideos]);

  const startPublicDeckMovieHold = useCallback((action: 'fast-forward' | 'rewind') => {
    movieHoldStateRef.current = presentationMovieControls.startHold(
      getPublicDeckVideos(),
      action,
      movieHoldStateRef.current,
    );
  }, [getPublicDeckVideos]);

  const stopPublicDeckMovieHold = useCallback(() => {
    movieHoldStateRef.current = presentationMovieControls.stopHold(movieHoldStateRef.current);
  }, []);

  const clearAnimationTimers = useCallback(() => {
    for (const timeoutId of animationTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    animationTimeoutsRef.current = [];
    if (animationFrameRef.current !== undefined) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
  }, []);

  const scheduleAnimation = useCallback((callback: () => void, delayMs: number) => {
    const timeoutId = window.setTimeout(callback, Math.max(0, delayMs));
    animationTimeoutsRef.current.push(timeoutId);
  }, []);

  const completeAnimationSlide = useCallback(() => {
    animationQueueRef.current = [];
    clearAnimationTimers();
    setAnimationPreview((current) =>
      current
        ? {
            ...current,
            activeBuild: undefined,
            activeBuildElementId: undefined,
            animationProgress: 1,
            hiddenElementIds: [],
            phase: 'complete',
            waitingForClick: false,
          }
        : current,
    );
  }, [clearAnimationTimers]);

  const revealAnimationBuild = useCallback((build: ElementAnimationBuild) => {
    setAnimationPreview((current) =>
      current
        ? {
            ...current,
            activeBuild: undefined,
            activeBuildElementId: undefined,
            animationProgress: 1,
            hiddenElementIds: current.hiddenElementIds.filter(
              (elementId) => elementId !== build.elementId,
            ),
            waitingForClick: false,
          }
        : current,
    );
  }, []);

  const animateActiveBuild = useCallback((build: ElementAnimationBuild) => {
    const durationMs = getBuildPlaybackDurationMs(build);
    const startMs = window.performance.now();
    if (animationFrameRef.current !== undefined) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    setAnimationPreview((current) =>
      current
        ? {
            ...current,
            activeBuild: build,
            activeBuildElementId: build.elementId,
            animationProgress: durationMs === 0 ? 1 : 0,
            phase: 'animation',
            waitingForClick: false,
          }
        : current,
    );

    if (durationMs === 0) return;

    function tick(nowMs: number) {
      const progress = Math.min(1, Math.max(0, (nowMs - startMs) / durationMs));
      setAnimationPreview((current) =>
        current?.activeBuild?.id === build.id
          ? {
              ...current,
              animationProgress: progress,
            }
          : current,
      );
      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
      } else {
        animationFrameRef.current = undefined;
      }
    }

    animationFrameRef.current = window.requestAnimationFrame(tick);
  }, []);

  const runNextAnimationBuild = useCallback(() => {
    const nextBuild = animationQueueRef.current[0];
    if (!nextBuild) {
      completeAnimationSlide();
      return;
    }

    if (nextBuild.trigger === 'on-click') {
      setAnimationPreview((current) =>
        current
          ? {
              ...current,
              activeBuild: undefined,
              activeBuildElementId: nextBuild.elementId,
              animationProgress: 0,
              phase: 'waiting',
              waitingForClick: true,
            }
          : current,
      );
      return;
    }

    animationQueueRef.current = animationQueueRef.current.slice(1);
    animateActiveBuild(nextBuild);
    scheduleAnimation(() => {
      revealAnimationBuild(nextBuild);
      runNextAnimationBuildRef.current();
    }, getBuildPlaybackDurationMs(nextBuild));
  }, [animateActiveBuild, completeAnimationSlide, revealAnimationBuild, scheduleAnimation]);
  useEffect(() => {
    runNextAnimationBuildRef.current = runNextAnimationBuild;
  }, [runNextAnimationBuild]);

  const advanceAnimationPreview = useCallback(() => {
    const nextBuild = animationQueueRef.current[0];
    if (!nextBuild) {
      completeAnimationSlide();
      return;
    }
    animationQueueRef.current = animationQueueRef.current.slice(1);
    animateActiveBuild(nextBuild);
    scheduleAnimation(() => {
      revealAnimationBuild(nextBuild);
      runNextAnimationBuild();
    }, getBuildPlaybackDurationMs(nextBuild));
  }, [
    animateActiveBuild,
    completeAnimationSlide,
    revealAnimationBuild,
    runNextAnimationBuild,
    scheduleAnimation,
  ]);

  const showPresentationPage = useCallback(
    (project: ProjectDocument, pageIndex: number) => {
      const page = project.pages[pageIndex];
      if (!page) return;
      const builds = (page.animationBuilds ?? []).filter((build) =>
        page.elementIds.includes(build.elementId),
      );
      clearAnimationTimers();
      animationQueueRef.current = builds;
      setActivePageIndex(pageIndex);
      const transitionDelay = page.transition?.delayMs ?? 0;
      setAnimationPreview({
        activeBuild: undefined,
        activeBuildElementId: undefined,
        animationProgress: 0,
        hiddenElementIds: builds
          .filter((build) => build.mediaAction !== 'play')
          .map((build) => build.elementId),
        mode: 'presenter',
        pageId: page.id,
        phase: transitionDelay > 0 ? 'transition' : builds.length > 0 ? 'animation' : 'complete',
        playing: true,
        waitingForClick: false,
      });

      if (builds.length === 0) {
        if (transitionDelay > 0) scheduleAnimation(completeAnimationSlide, transitionDelay);
        return;
      }
      scheduleAnimation(runNextAnimationBuild, transitionDelay);
    },
    [clearAnimationTimers, completeAnimationSlide, runNextAnimationBuild, scheduleAnimation],
  );

  const playPresentationPage = useCallback(
    (project: ProjectDocument, pageIndex: number) => {
      const mediaEntries = getPageMediaPreloadEntries(project, pageIndex);
      pagePreloadAbortRef.current?.abort();
      if (mediaEntries.length === 0) {
        showPresentationPage(project, pageIndex);
        return;
      }

      const preloadController = new AbortController();
      pagePreloadAbortRef.current = preloadController;
      void preloadPageMedia(mediaEntries, preloadController.signal).then(() => {
        if (preloadController.signal.aborted) return;
        if (pagePreloadAbortRef.current === preloadController) {
          pagePreloadAbortRef.current = undefined;
        }
        showPresentationPage(project, pageIndex);
      });
    },
    [showPresentationPage],
  );

  const advancePresentation = useCallback(() => {
    if (viewerState.status !== 'ready') return;
    if (animationPreview?.waitingForClick) {
      advanceAnimationPreview();
      return;
    }
    if (animationPreview?.phase !== 'complete') return;
    playPresentationPage(viewerState.project, activePageIndex + 1);
  }, [
    activePageIndex,
    advanceAnimationPreview,
    animationPreview,
    playPresentationPage,
    viewerState,
  ]);

  const rewindPresentation = useCallback(() => {
    if (viewerState.status !== 'ready') return;
    playPresentationPage(viewerState.project, activePageIndex - 1);
  }, [activePageIndex, playPresentationPage, viewerState]);

  useEffect(() => {
    let isActive = true;
    const preloadController = new AbortController();
    void shareService.getShare(shareId).then(async (record) => {
      if (!isActive) return;
      if (!record) {
        setViewerState({ status: 'missing' });
        setActivePageIndex(0);
        setAnimationPreview(undefined);
        return;
      }
      const shareRecord = record;

      let hasStartedPlayback = false;
      function startPlaybackWhenReady(loaded: number, total: number) {
        if (!isActive || hasStartedPlayback || !hasFinishedAssetPreload(loaded, total)) return;
        hasStartedPlayback = true;
        setViewerState({ status: 'ready', project: shareRecord.project });
        playPresentationPage(shareRecord.project, 0);
      }

      setViewerState({ status: 'preloading', loaded: 0, project: shareRecord.project, total: 0 });
      const assetPreloadPromise = preloadPublicDeckAssets(shareRecord.project, {
        signal: preloadController.signal,
        onProgress: (progress) => {
          if (!isActive) return;
          setViewerState((current) =>
            current.status === 'preloading'
              ? {
                  status: 'preloading',
                  loaded: progress.loaded,
                  project: shareRecord.project,
                  total: progress.total,
                }
              : current,
          );
          startPlaybackWhenReady(progress.loaded, progress.total);
        },
      });
      await Promise.all([
        fontImportService.loadProjectFonts(shareRecord.project).catch(() => undefined),
        assetPreloadPromise,
      ]);
      if (!isActive) return;
      startPlaybackWhenReady(1, 1);
    });
    return () => {
      isActive = false;
      preloadController.abort();
    };
  }, [fontImportService, playPresentationPage, shareId, shareService]);

  useEffect(() => {
    return () => {
      pagePreloadAbortRef.current?.abort();
      clearAnimationTimers();
      movieHoldStateRef.current = presentationMovieControls.stopHold(movieHoldStateRef.current);
    };
  }, [clearAnimationTimers]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (viewerState.status !== 'ready') return;
      if (isKeyboardShortcutEditableTarget(event.target)) return;
      if (isKeyboardShortcutControlActivation(event)) return;
      if (keyboardShortcutsOpen && event.key === 'Escape') {
        event.preventDefault();
        setKeyboardShortcutsOpen(false);
        return;
      }
      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault();
        setKeyboardShortcutsOpen((current) => !current);
        return;
      }
      const lowerKey = event.key.toLowerCase();
      if (event.key === 'Home') {
        event.preventDefault();
        playPresentationPage(viewerState.project, 0);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        playPresentationPage(viewerState.project, viewerState.project.pages.length - 1);
        return;
      }
      if (event.key === 'ArrowDown' && event.shiftKey) {
        event.preventDefault();
        playPresentationPage(viewerState.project, activePageIndex + 1);
        return;
      }
      if (
        event.key === 'ArrowRight' ||
        event.key === 'ArrowDown' ||
        event.key === 'PageDown' ||
        event.key === ' ' ||
        event.key === 'Enter' ||
        event.key === ']'
      ) {
        event.preventDefault();
        advancePresentation();
        return;
      }
      if (event.key === '[' || event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        rewindPresentation();
        return;
      }
      if (lowerKey === 'k') {
        event.preventDefault();
        controlPublicDeckMovies('play-toggle');
        return;
      }
      if (lowerKey === 'j') {
        event.preventDefault();
        if (!event.repeat) startPublicDeckMovieHold('rewind');
        return;
      }
      if (lowerKey === 'l') {
        event.preventDefault();
        if (!event.repeat) startPublicDeckMovieHold('fast-forward');
        return;
      }
      if (lowerKey === 'i') {
        event.preventDefault();
        controlPublicDeckMovies('start');
        return;
      }
      if (lowerKey === 'o') {
        event.preventDefault();
        controlPublicDeckMovies('end');
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'j' && event.key.toLowerCase() !== 'l') return;
      stopPublicDeckMovieHold();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    activePageIndex,
    advancePresentation,
    controlPublicDeckMovies,
    keyboardShortcutsOpen,
    playPresentationPage,
    rewindPresentation,
    startPublicDeckMovieHold,
    stopPublicDeckMovieHold,
    viewerState,
  ]);

  useEffect(() => {
    function handleFullscreenChange() {
      if (document.fullscreenElement !== publicViewerRef.current) {
        setSlideOnlyFullscreen(false);
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (viewerState.status === 'preloading') {
    const loadedPercent =
      viewerState.total > 0 ? Math.min(100, Math.round((viewerState.loaded / viewerState.total) * 100)) : 0;
    return (
      <main className={viewerClassName}>
        {viewerState.project ? <ProjectVideoPreloader project={viewerState.project} /> : null}
        <section className="public-deck-loading" aria-label="Preparing shared deck">
          <p className="public-deck-status">Preparing media...</p>
          <div className="public-deck-loading-track" aria-hidden="true">
            <span style={{ width: `${loadedPercent}%` }} />
          </div>
          <p className="public-deck-status">
            {viewerState.total > 0
              ? `${viewerState.loaded} / ${viewerState.total} assets ready`
              : 'Checking assets'}
          </p>
        </section>
      </main>
    );
  }

  if (viewerState.status === 'missing') {
    return (
      <main className={viewerClassName}>
        <section className="public-deck-empty">
          <h1>Deck not found</h1>
          <p>This shared deck is unavailable or the link is incorrect.</p>
        </section>
      </main>
    );
  }

  const project = viewerState.project;
  const activePage = project.pages[activePageIndex] ?? project.pages[0];
  if (!activePage) {
    return (
      <main className={viewerClassName}>
        <section className="public-deck-empty">
          <h1>Deck could not be loaded</h1>
          <p>This shared deck does not contain any slides.</p>
        </section>
      </main>
    );
  }
  const canGoPrevious = activePageIndex > 0;
  const canGoNext = activePageIndex < project.pages.length - 1;
  const transcriptRecordings = getTranscriptRecordings(project);
  const hasTranscriptRecordings = transcriptRecordings.length > 0;
  const showPlaybackOverlay = hasTranscriptRecordings && !embed;
  const readyViewerClassName = [
    viewerClassName,
    showPlaybackOverlay ? 'public-deck-viewer-with-playback' : '',
    showPlaybackOverlay && transcriptPanelOpen && !slideOnlyFullscreen ? 'public-deck-viewer-transcript-open' : '',
    slideOnlyFullscreen ? 'public-deck-viewer-slide-fullscreen' : '',
  ]
    .filter(Boolean)
    .join(' ');

  async function answerTranscriptQuestion(question = transcriptQuestion) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || transcriptAnswerStatus === 'answering') return;
    const runId = transcriptAnswerRunIdRef.current + 1;
    transcriptAnswerRunIdRef.current = runId;
    setTranscriptAnswerStatus('answering');
    setTranscriptAnswerError(undefined);
    try {
      transcriptQaServiceRef.current ??= new TranscriptQuestionAnsweringService({
        textGenerationRuntime: new webGpuTextGenerationRuntime.TransformersTextGenerationRuntime(),
      });
      const answer = await transcriptQaServiceRef.current.answer(
        trimmedQuestion,
        transcriptRecordings,
      );
      if (transcriptAnswerRunIdRef.current !== runId) return;
      setTranscriptAnswer(answer);
      setTranscriptAnswerStatus('idle');
    } catch (error) {
      if (transcriptAnswerRunIdRef.current !== runId) return;
      setTranscriptAnswerError(
        error instanceof Error
          ? error.message
          : 'Transcript chat is unavailable in this browser.',
      );
      setTranscriptAnswerStatus('failed');
    }
  }

  function stopTranscriptAnswer() {
    transcriptAnswerRunIdRef.current += 1;
    setTranscriptAnswerStatus('idle');
    setTranscriptAnswerError('Transcript answer stopped.');
  }

  function executePublicDeckShortcut(action: KeyboardShortcutAction) {
    if (action === 'shortcut-toggle') setKeyboardShortcutsOpen((current) => !current);
    if (action === 'previous-slide' || action === 'previous-build') rewindPresentation();
    if (action === 'next-slide') advancePresentation();
    if (action === 'next-build') advancePresentation();
    if (action === 'first-slide') playPresentationPage(project, 0);
    if (action === 'last-slide') playPresentationPage(project, project.pages.length - 1);
    if (action === 'play-pause-movie') controlPublicDeckMovies('play-toggle');
    if (action === 'rewind-movie') pulsePublicDeckMovieHold('rewind');
    if (action === 'fast-forward-movie') pulsePublicDeckMovieHold('fast-forward');
    if (action === 'jump-movie-start') controlPublicDeckMovies('start');
    if (action === 'jump-movie-end') controlPublicDeckMovies('end');
  }

  return (
    <main
      ref={publicViewerRef}
      className={readyViewerClassName}
      aria-label={embed ? 'Embedded shared deck' : 'Public presentation'}
    >
      <ProjectVideoPreloader project={project} />
      <section className="public-deck-stage-shell" aria-label="Shared slide preview">
        <CanvasWorkspace
          project={project}
          activePageId={activePage.id}
          selection={{ ...emptySelection, pageId: activePage.id }}
          hideReadOnlyMediaPlaceholder
          presentationMode
          readOnly
          zoomPercent={100}
          animationPreview={animationPreview}
          onAnimationPreviewAdvance={advancePresentation}
        />
      </section>
      {project.pages.length > 1 && !showPlaybackOverlay ? (
        <nav className="public-deck-slide-dots" aria-label="Jump to slide">
          {project.pages.map((page, pageIndex) => (
            <button
              key={page.id}
              className={
                pageIndex === activePageIndex
                  ? 'public-deck-slide-dot public-deck-slide-dot-active'
                  : 'public-deck-slide-dot'
              }
              type="button"
              aria-current={pageIndex === activePageIndex ? 'page' : undefined}
              aria-label={`Jump to slide ${pageIndex + 1}: ${page.name}`}
              onClick={() => playPresentationPage(project, pageIndex)}
            />
          ))}
        </nav>
      ) : null}
      {showPlaybackOverlay && !slideOnlyFullscreen ? (
        <PublicDeckPlaybackOverlay
          activePageIndex={activePageIndex}
          canGoNext={canGoNext}
          canGoPrevious={canGoPrevious}
          keyboardShortcutsOpen={keyboardShortcutsOpen}
          playbackSync={publicPlaybackSync}
          recordings={transcriptRecordings}
          project={project}
          onEnterSlideFullscreen={enterSlideOnlyFullscreen}
          onOpenTranscript={() => setTranscriptPanelOpen((current) => !current)}
          onPlaybackSync={setPublicPlaybackSync}
          onSelectPage={(pageIndex) => playPresentationPage(project, pageIndex)}
          onToggleKeyboardShortcuts={() => setKeyboardShortcutsOpen((current) => !current)}
        />
      ) : !slideOnlyFullscreen ? (
        <nav className="public-deck-controls" aria-label="Slide navigation">
          <button
            className="stitch-icon-button"
            disabled={!canGoPrevious}
            type="button"
            aria-label="Previous slide"
            onClick={() => {
              rewindPresentation();
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              chevron_left
            </span>
          </button>
          <span className="public-deck-page-count">
            {activePageIndex + 1} / {project.pages.length}
          </span>
          <button
            className="stitch-icon-button"
            disabled={!canGoNext}
            type="button"
            aria-label="Next slide"
            onClick={() => {
              advancePresentation();
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              chevron_right
            </span>
          </button>
          <button
            className="stitch-icon-button"
            type="button"
            aria-label={hasTranscriptRecordings ? 'Open transcript chat' : 'Open slide list'}
            aria-expanded={hasTranscriptRecordings ? transcriptPanelOpen : slideListOpen}
            onClick={() => {
              if (hasTranscriptRecordings) {
                setTranscriptPanelOpen((current) => !current);
                return;
              }
              setSlideListOpen((current) => !current);
            }}
          >
            <ListMusic size={18} aria-hidden="true" />
          </button>
          <button
            className="stitch-icon-button"
            type="button"
            aria-label="Show keyboard shortcuts"
            aria-expanded={keyboardShortcutsOpen}
            onClick={() => setKeyboardShortcutsOpen((current) => !current)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              keyboard
            </span>
          </button>
        </nav>
      ) : null}
      {slideListOpen && !hasTranscriptRecordings && !slideOnlyFullscreen ? (
        <aside className="public-slide-list-popover" aria-label="Slide list">
          <header>
            <h2>Slides</h2>
            <button
              className="stitch-icon-button"
              type="button"
              aria-label="Close slide list"
              onClick={() => setSlideListOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <PublicDeckSlideList
            activePageIndex={activePageIndex}
            pages={project.pages}
            project={project}
            onSelectPage={(pageIndex) => {
              playPresentationPage(project, pageIndex);
              setSlideListOpen(false);
            }}
          />
        </aside>
      ) : null}
      {transcriptPanelOpen && hasTranscriptRecordings && !slideOnlyFullscreen ? (
        <aside className="public-transcript-panel" aria-label="Transcript chat">
          <header>
            <div>
              <span className="public-deck-kicker">Presentation transcript</span>
              <h2>Ask the recording</h2>
            </div>
            <button
              className="stitch-icon-button"
              type="button"
              aria-label="Close transcript chat"
              onClick={() => setTranscriptPanelOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <PublicTranscriptPodcastPlayer
            activePageIndex={activePageIndex}
            playbackSync={publicPlaybackSync}
            recordings={transcriptRecordings}
            project={project}
            pages={project.pages}
            onPlaybackSync={setPublicPlaybackSync}
            onSelectPage={(pageIndex) => playPresentationPage(project, pageIndex)}
          />
          <PublicTranscriptPromptComposer
            answer={transcriptAnswer}
            error={transcriptAnswerError}
            isAnswering={transcriptAnswerStatus === 'answering'}
            question={transcriptQuestion}
            onQuestionChange={setTranscriptQuestion}
            onStop={stopTranscriptAnswer}
            onSubmit={(question) => void answerTranscriptQuestion(question)}
          />
        </aside>
      ) : null}
      {keyboardShortcutsOpen ? (
        <KeyboardShortcutsDialog
          title="Keyboard Shortcuts"
          variant="popover"
          onClose={() => setKeyboardShortcutsOpen(false)}
          onShortcutAction={executePublicDeckShortcut}
          shortcutGroups={publicDeckShortcutGroups}
          supportedActions={publicDeckShortcutActions}
        />
      ) : null}
    </main>
  );
}
