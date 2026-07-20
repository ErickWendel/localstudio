import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Bot, Captions, ListMusic, Pause, Play, SendHorizontal, X } from 'lucide-react';
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
import { CanvasWorkspace } from '../editor/canvas/CanvasWorkspace';
import { ProjectVideoPreloader } from '../editor/media/ProjectVideoPreloader';
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

type TranscriptPanelTab = 'ask' | 'transcript';

interface PublicPodcastChapter {
  id: string;
  endMs: number | undefined;
  pageIndex: number;
  pageName: string;
  startMs: number;
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

function getBuildPlaybackDurationMs(build: ElementAnimationBuild) {
  return Math.max(0, build.durationMs ?? build.delayMs);
}

function hasFinishedAssetPreload(loaded: number, total: number) {
  if (total === 0) return true;
  return loaded >= total;
}

const PUBLIC_DECK_PAGE_MEDIA_PRELOAD_TIMEOUT_MS = 5000;

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

function PublicTranscriptPodcastPlayer({
  onSelectPage,
  pages,
  recordings,
}: {
  onSelectPage: (pageIndex: number) => void;
  pages: Page[];
  recordings: TranscriptRecording[];
}) {
  const [recordingId, setRecordingId] = useState<string | undefined>();
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
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
  const totalMs = durationMs || selectedRecording?.durationMs || 0;
  const progressPercent = getRecordingTimePercent(currentTimeMs, totalMs);

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
    if (!playing || !activeChapter) return;
    if (lastSyncedChapterIdRef.current === activeChapter.id) return;
    lastSyncedChapterIdRef.current = activeChapter.id;
    onSelectPage(activeChapter.pageIndex);
  }, [activeChapter, onSelectPage, playing]);

  function updateProgress() {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTimeMs(Math.round(audio.currentTime * 1000));
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setDurationMs(Math.round(audio.duration * 1000));
    }
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !selectedRecording?.audio.objectUrl) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }

  function seekToChapter(chapter: PublicPodcastChapter) {
    const audio = audioRef.current;
    if (audio) audio.currentTime = chapter.startMs / 1000;
    setCurrentTimeMs(chapter.startMs);
    lastSyncedChapterIdRef.current = chapter.id;
    onSelectPage(chapter.pageIndex);
  }

  function toggleChapterPlayback(chapter: PublicPodcastChapter) {
    const audio = audioRef.current;
    if (!audio) return;
    const isActiveChapter = chapter.id === activeChapter?.id;
    if (isActiveChapter && playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    seekToChapter(chapter);
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
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
        onLoadedMetadata={updateProgress}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
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
            onChange={(event) => setRecordingId(event.target.value)}
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
          }}
        />
      </div>
      <div className="public-podcast-chapters" aria-label="Podcast slides">
        <div className="public-podcast-chapters-heading">
          <span>Slides in this recording</span>
          <strong>{chapters.length}</strong>
        </div>
        {chapters.map((chapter) => (
          <button
            className={
              chapter.id === activeChapter?.id
                ? 'public-podcast-chapter public-podcast-chapter-active'
                : 'public-podcast-chapter'
            }
            key={chapter.id}
            type="button"
            aria-label={`${chapter.id === activeChapter?.id && playing ? 'Pause' : 'Play'} ${chapter.pageName}`}
            onClick={() => toggleChapterPlayback(chapter)}
          >
            <span className="public-podcast-chapter-icon">
              {chapter.id === activeChapter?.id && playing ? (
                <Pause size={14} aria-hidden="true" />
              ) : (
                <Play size={14} aria-hidden="true" />
              )}
            </span>
            <span className="public-podcast-chapter-time">
              {formatTranscriptTimestamp(chapter.startMs)}
            </span>
            <strong>Slide {chapter.pageIndex + 1}</strong>
            <em>{chapter.pageName}</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function PublicDeckPlaybackOverlay({
  activePageIndex,
  canGoNext,
  canGoPrevious,
  chaptersOpen,
  onChaptersOpenChange,
  onOpenTranscript,
  onSelectPage,
  project,
  recordings,
}: {
  activePageIndex: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  chaptersOpen: boolean;
  onChaptersOpenChange: (open: boolean) => void;
  onOpenTranscript: () => void;
  onSelectPage: (pageIndex: number) => void;
  project: ProjectDocument;
  recordings: TranscriptRecording[];
}) {
  const [captionsVisible, setCaptionsVisible] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastSyncedChapterIdRef = useRef<string | undefined>(undefined);
  const selectedRecording = useMemo(
    () => recordings.find((recording) => recording.audio.objectUrl) ?? recordings[0],
    [recordings],
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
  const captionText = activeSegment ? stripSlideLabel(activeSegment.text) : '';
  const hasAudio = Boolean(selectedRecording?.audio.objectUrl);
  const hasCaptions = Boolean(captionText);
  const totalMs = durationMs || selectedRecording?.durationMs || Math.max(0, pages.length - 1) * 1000;
  const progressPercent = getRecordingTimePercent(currentTimeMs, totalMs);
  const chaptersByPageIndex = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.pageIndex, chapter])),
    [chapters],
  );

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
    if (!playing || !activeChapter) return;
    if (lastSyncedChapterIdRef.current === activeChapter.id) return;
    lastSyncedChapterIdRef.current = activeChapter.id;
    onSelectPage(activeChapter.pageIndex);
  }, [activeChapter, onSelectPage, playing]);

  function updateProgress() {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTimeMs(Math.round(audio.currentTime * 1000));
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setDurationMs(Math.round(audio.duration * 1000));
    }
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !selectedRecording?.audio.objectUrl) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
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
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }

  function seekToTime(nextTimeMs: number) {
    const nextSeconds = Math.max(0, nextTimeMs) / 1000;
    const audio = audioRef.current;
    if (audio) audio.currentTime = nextSeconds;
    setCurrentTimeMs(Math.round(nextSeconds * 1000));
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
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
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
          {chapters.map((chapter) => {
            const chapterEndMs = getPodcastChapterEndMs(chapter, chapters, totalMs);
            const chapterWidthPercent = Math.max(
              0.3,
              getRecordingTimePercent(chapterEndMs, totalMs) -
                getRecordingTimePercent(chapter.startMs, totalMs),
            );
            const page = pages[chapter.pageIndex];
            return (
            <button
              key={chapter.id}
              className={
                chapter.pageIndex === activePageIndex
                  ? 'public-deck-playback-chapter-dot public-deck-playback-chapter-dot-active'
                  : 'public-deck-playback-chapter-dot'
              }
              type="button"
              aria-label={`Seek audio to slide ${chapter.pageIndex + 1}: ${chapter.pageName}`}
              style={
                {
                  '--public-deck-chapter-left': `${getRecordingTimePercent(chapter.startMs, totalMs)}%`,
                  '--public-deck-chapter-width': `${chapterWidthPercent}%`,
                } as CSSProperties
              }
              onClick={() => seekToChapter(chapter)}
            >
              {page ? (
                <span className="public-deck-playback-chapter-preview" aria-hidden="true">
                  <MiniPagePreview page={page} project={project} visible={page.visible ?? true} />
                  <strong>Slide {chapter.pageIndex + 1}</strong>
                  <em>{formatTranscriptTimestamp(chapter.startMs)}</em>
                </span>
              ) : null}
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
            aria-label="Open slide chapters"
            aria-expanded={chaptersOpen}
            onClick={() => onChaptersOpenChange(!chaptersOpen)}
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
            aria-label="Open transcript chat"
            onClick={onOpenTranscript}
          >
            <Bot size={18} aria-hidden="true" />
          </button>
        </div>
      </section>
      {chaptersOpen ? (
        <aside className="public-deck-chapters-menu pages-panel" aria-label="Slide chapter menu">
          <div className="pages-panel-header">
            <div>
              <h2 className="panel-heading">Slides</h2>
              <p className="panel-muted">{chapters.length} slides</p>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Close slide chapters"
              onClick={() => onChaptersOpenChange(false)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>
          <div className="pages-list">
            {pages.map((page, pageIndex) => {
              const chapter = chaptersByPageIndex.get(pageIndex);
              return (
                <article
                  className={
                    pageIndex === activePageIndex
                      ? 'public-deck-chapter-card page-card page-card-active'
                      : 'public-deck-chapter-card page-card'
                  }
                  key={page.id}
                  aria-label={`Slide ${pageIndex + 1}: ${page.name}`}
                >
                  <span className="page-card-number">{pageIndex + 1}</span>
                  <button
                    className="page-card-preview"
                    style={{ aspectRatio: `${page.width} / ${page.height}` }}
                    type="button"
                    aria-label={`Play slide ${pageIndex + 1}: ${page.name}`}
                    onClick={() => {
                      if (chapter) {
                        seekToChapter(chapter);
                        return;
                      }
                      onSelectPage(pageIndex);
                    }}
                  >
                    <MiniPagePreview page={page} project={project} visible={page.visible ?? true} />
                  </button>
                  <span className="public-deck-chapter-card-body page-card-body">
                    {chapter ? (
                      <span className="public-deck-chapter-card-time">
                        {formatTranscriptTimestamp(chapter.startMs)}
                      </span>
                    ) : (
                      <span className="public-deck-chapter-card-time public-deck-chapter-card-time-empty">
                        No audio
                      </span>
                    )}
                    <strong>Slide {pageIndex + 1}</strong>
                    <em>{page.name}</em>
                  </span>
                </article>
              );
            })}
          </div>
        </aside>
      ) : null}
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
  const transcriptQaServiceRef = useRef<TranscriptQuestionAnsweringService | undefined>(undefined);
  const emptySelection = useMemo<SelectionState>(() => ({ pageId: '', elementIds: [] }), []);
  const [transcriptPanelOpen, setTranscriptPanelOpen] = useState(false);
  const [transcriptPanelTab, setTranscriptPanelTab] = useState<TranscriptPanelTab>('transcript');
  const [slideChaptersOpen, setSlideChaptersOpen] = useState(false);
  const [transcriptQuestion, setTranscriptQuestion] = useState('');
  const [transcriptAnswer, setTranscriptAnswer] = useState<TranscriptAnswer | undefined>();
  const [transcriptAnswerStatus, setTranscriptAnswerStatus] = useState<
    'answering' | 'failed' | 'idle'
  >('idle');
  const [transcriptAnswerError, setTranscriptAnswerError] = useState<string | undefined>();
  const viewerClassName = embed
    ? 'public-deck-viewer public-deck-viewer-embed'
    : 'public-deck-viewer public-deck-viewer-present';

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
    };
  }, [clearAnimationTimers]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (viewerState.status !== 'ready') return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        rewindPresentation();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        advancePresentation();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [advancePresentation, rewindPresentation, viewerState.status]);

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
    showPlaybackOverlay && slideChaptersOpen ? 'public-deck-viewer-chapters-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  async function answerTranscriptQuestion() {
    if (!transcriptQuestion.trim() || transcriptAnswerStatus === 'answering') return;
    setTranscriptAnswerStatus('answering');
    setTranscriptAnswerError(undefined);
    try {
      transcriptQaServiceRef.current ??= new TranscriptQuestionAnsweringService({
        textGenerationRuntime: new webGpuTextGenerationRuntime.TransformersTextGenerationRuntime(),
      });
      const answer = await transcriptQaServiceRef.current.answer(
        transcriptQuestion,
        transcriptRecordings,
      );
      setTranscriptAnswer(answer);
      setTranscriptAnswerStatus('idle');
    } catch (error) {
      setTranscriptAnswerError(
        error instanceof Error
          ? error.message
          : 'Transcript chat is unavailable in this browser.',
      );
      setTranscriptAnswerStatus('failed');
    }
  }

  return (
    <main
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
      {showPlaybackOverlay ? (
        <PublicDeckPlaybackOverlay
          activePageIndex={activePageIndex}
          canGoNext={canGoNext}
          canGoPrevious={canGoPrevious}
          chaptersOpen={slideChaptersOpen}
          recordings={transcriptRecordings}
          project={project}
          onChaptersOpenChange={setSlideChaptersOpen}
          onOpenTranscript={() => setTranscriptPanelOpen((current) => !current)}
          onSelectPage={(pageIndex) => playPresentationPage(project, pageIndex)}
        />
      ) : (
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
            aria-label="Open transcript chat"
            aria-expanded={transcriptPanelOpen}
            onClick={() => setTranscriptPanelOpen((current) => !current)}
          >
            <Bot size={18} aria-hidden="true" />
          </button>
        </nav>
      )}
      {transcriptPanelOpen ? (
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
          {hasTranscriptRecordings ? (
            <PublicTranscriptPodcastPlayer
              recordings={transcriptRecordings}
              pages={project.pages}
              onSelectPage={(pageIndex) => playPresentationPage(project, pageIndex)}
            />
          ) : (
            <p className="public-deck-status">No presenter recording has been published with this deck.</p>
          )}
          <div className="public-transcript-tabs" role="tablist" aria-label="Transcript views">
            <button
              type="button"
              role="tab"
              aria-selected={transcriptPanelTab === 'transcript'}
              onClick={() => setTranscriptPanelTab('transcript')}
            >
              <Captions size={16} aria-hidden="true" />
              Transcript
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={transcriptPanelTab === 'ask'}
              onClick={() => setTranscriptPanelTab('ask')}
            >
              <Bot size={16} aria-hidden="true" />
              Ask
            </button>
          </div>
          {transcriptPanelTab === 'transcript' ? (
            <section className="public-transcript-list" role="tabpanel">
              {transcriptRecordings.map((recording) => (
                <article key={recording.id}>
                  <h3>{recording.name}</h3>
                  {recording.audio.objectUrl ? (
                    <audio aria-label={`${recording.name} audio`} controls src={recording.audio.objectUrl}>
                      <track kind="captions" />
                    </audio>
                  ) : null}
                  <ol>
                    {recording.segments.map((segment) => (
                      <li key={segment.id}>
                        <time>{formatTranscriptTimestamp(segment.startMs)}</time>
                        <span>{segment.text}</span>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </section>
          ) : (
            <section className="public-transcript-ask" role="tabpanel">
              <div className="public-transcript-question">
                <input
                  value={transcriptQuestion}
                  onChange={(event) => setTranscriptQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void answerTranscriptQuestion();
                  }}
                  placeholder="Ask about this presentation"
                  aria-label="Question for transcript chat"
                />
                <button
                  className="stitch-icon-button"
                  type="button"
                  aria-label="Ask transcript"
                  disabled={transcriptAnswerStatus === 'answering' || !transcriptQuestion.trim()}
                  onClick={() => void answerTranscriptQuestion()}
                >
                  <SendHorizontal size={18} aria-hidden="true" />
                </button>
              </div>
              {transcriptAnswerStatus === 'answering' ? (
                <p className="public-deck-status">Building transcript answer...</p>
              ) : null}
              {transcriptAnswerError ? (
                <p className="public-deck-status">{transcriptAnswerError}</p>
              ) : null}
              {transcriptAnswer ? (
                <article className="public-transcript-answer">
                  <p>{transcriptAnswer.text}</p>
                  <div>
                    {transcriptAnswer.citations.map((citation) => (
                      <span key={`${citation.recordingId}-${citation.segmentId}`}>
                        {formatTranscriptTimestamp(citation.startMs)}
                      </span>
                    ))}
                  </div>
                </article>
              ) : null}
            </section>
          )}
        </aside>
      ) : null}
    </main>
  );
}
