import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ElementAnimationBuild,
  ProjectDocument,
  SelectionState,
} from '../../domain/documents/model';
import type { FontImportService, ShareService } from '../../services/contracts/interfaces';
import { CanvasWorkspace } from '../editor/canvas/CanvasWorkspace';
import { preloadPublicDeckAssets } from './publicDeckAssetPreloader';

interface PublicDeckViewerProps {
  shareId: string;
  fontImportService: FontImportService;
  shareService: ShareService;
  embed?: boolean;
}

type ViewerState =
  | { status: 'loading' }
  | { status: 'preloading'; loaded: number; project: ProjectDocument; total: number }
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

function getBuildPlaybackDurationMs(build: ElementAnimationBuild) {
  return Math.max(0, build.durationMs ?? build.delayMs);
}

function hasReachedPlaybackThreshold(loaded: number, total: number) {
  if (total === 0) return true;
  return loaded / total >= 0.5;
}

export function PublicDeckViewer({
  shareId,
  fontImportService,
  shareService,
  embed = false,
}: PublicDeckViewerProps) {
  const [viewerState, setViewerState] = useState<ViewerState>({ status: 'loading' });
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [animationPreview, setAnimationPreview] = useState<AnimationPreviewState | undefined>();
  const animationQueueRef = useRef<ElementAnimationBuild[]>([]);
  const animationTimeoutsRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const runNextAnimationBuildRef = useRef<() => void>(() => undefined);
  const emptySelection = useMemo<SelectionState>(() => ({ pageId: '', elementIds: [] }), []);
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

  const playPresentationPage = useCallback(
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
        if (!isActive || hasStartedPlayback || !hasReachedPlaybackThreshold(loaded, total)) return;
        hasStartedPlayback = true;
        setViewerState({ status: 'ready', project: shareRecord.project });
        playPresentationPage(shareRecord.project, 0);
      }

      setViewerState({ status: 'preloading', loaded: 0, project: shareRecord.project, total: 0 });
      await fontImportService.loadProjectFonts(shareRecord.project).catch(() => undefined);
      if (!isActive) return;
      await preloadPublicDeckAssets(shareRecord.project, {
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
      startPlaybackWhenReady(1, 1);
    });
    return () => {
      isActive = false;
      preloadController.abort();
    };
  }, [fontImportService, playPresentationPage, shareId, shareService]);

  useEffect(() => {
    return () => {
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

  if (viewerState.status === 'loading') {
    return (
      <main className={viewerClassName}>
        <p className="public-deck-status">Loading deck...</p>
      </main>
    );
  }

  if (viewerState.status === 'preloading') {
    const loadedPercent =
      viewerState.total > 0 ? Math.min(100, Math.round((viewerState.loaded / viewerState.total) * 100)) : 0;
    return (
      <main className={viewerClassName}>
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

  return (
    <main
      className={viewerClassName}
      aria-label={embed ? 'Embedded shared deck' : 'Public presentation'}
    >
      <section className="public-deck-stage-shell" aria-label="Shared slide preview">
        <CanvasWorkspace
          project={project}
          activePageId={activePage.id}
          selection={{ ...emptySelection, pageId: activePage.id }}
          presentationMode
          readOnly
          zoomPercent={100}
          animationPreview={animationPreview}
          onAnimationPreviewAdvance={advancePresentation}
        />
      </section>
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
      </nav>
    </main>
  );
}
