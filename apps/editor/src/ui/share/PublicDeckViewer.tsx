import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ElementAnimationBuild, ProjectDocument, SelectionState } from '../../domain/model';
import type { ShareService } from '../../services/interfaces';
import { CanvasWorkspace } from '../editor/CanvasWorkspace';

interface PublicDeckViewerProps {
  shareId: string;
  shareService: ShareService;
  embed?: boolean;
}

type ViewerState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; project: ProjectDocument };

interface AnimationPreviewState {
  activeBuildElementId: string | undefined;
  hiddenElementIds: string[];
  mode: 'presenter';
  pageId: string;
  phase: 'transition' | 'animation' | 'waiting' | 'complete';
  playing: boolean;
  waitingForClick: boolean;
}

export function PublicDeckViewer({ shareId, shareService, embed = false }: PublicDeckViewerProps) {
  const [viewerState, setViewerState] = useState<ViewerState>({ status: 'loading' });
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [animationPreview, setAnimationPreview] = useState<AnimationPreviewState | undefined>();
  const animationQueueRef = useRef<ElementAnimationBuild[]>([]);
  const animationTimeoutsRef = useRef<number[]>([]);
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
            activeBuildElementId: undefined,
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
            activeBuildElementId: undefined,
            hiddenElementIds: current.hiddenElementIds.filter((elementId) => elementId !== build.elementId),
            waitingForClick: false,
          }
        : current,
    );
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
              activeBuildElementId: nextBuild.elementId,
              phase: 'waiting',
              waitingForClick: true,
            }
          : current,
      );
      return;
    }

    animationQueueRef.current = animationQueueRef.current.slice(1);
    setAnimationPreview((current) =>
      current
        ? {
            ...current,
            activeBuildElementId: nextBuild.elementId,
            phase: 'animation',
            waitingForClick: false,
          }
        : current,
    );
    scheduleAnimation(() => {
      revealAnimationBuild(nextBuild);
      runNextAnimationBuildRef.current();
    }, nextBuild.delayMs);
  }, [completeAnimationSlide, revealAnimationBuild, scheduleAnimation]);
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
    setAnimationPreview((current) =>
      current
        ? {
            ...current,
            activeBuildElementId: nextBuild.elementId,
            phase: 'animation',
            waitingForClick: false,
          }
        : current,
    );
    scheduleAnimation(() => {
      revealAnimationBuild(nextBuild);
      runNextAnimationBuild();
    }, nextBuild.delayMs);
  }, [completeAnimationSlide, revealAnimationBuild, runNextAnimationBuild, scheduleAnimation]);

  const playPresentationPage = useCallback((project: ProjectDocument, pageIndex: number) => {
    const page = project.pages[pageIndex];
    if (!page) return;
    const builds = (page.animationBuilds ?? []).filter((build) => page.elementIds.includes(build.elementId));
    clearAnimationTimers();
    animationQueueRef.current = builds;
    setActivePageIndex(pageIndex);
    const transitionDelay = page.transition?.delayMs ?? 0;
    setAnimationPreview({
      activeBuildElementId: undefined,
      hiddenElementIds: builds.map((build) => build.elementId),
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
  }, [clearAnimationTimers, completeAnimationSlide, runNextAnimationBuild, scheduleAnimation]);

  const advancePresentation = useCallback(() => {
    if (viewerState.status !== 'ready') return;
    if (animationPreview?.waitingForClick) {
      advanceAnimationPreview();
      return;
    }
    if (animationPreview?.phase !== 'complete') return;
    playPresentationPage(viewerState.project, activePageIndex + 1);
  }, [activePageIndex, advanceAnimationPreview, animationPreview, playPresentationPage, viewerState]);

  const rewindPresentation = useCallback(() => {
    if (viewerState.status !== 'ready') return;
    playPresentationPage(viewerState.project, activePageIndex - 1);
  }, [activePageIndex, playPresentationPage, viewerState]);

  useEffect(() => {
    let isActive = true;
    void shareService.getShare(shareId).then((record) => {
      if (!isActive) return;
      setViewerState(record ? { status: 'ready', project: record.project } : { status: 'missing' });
      if (record) {
        playPresentationPage(record.project, 0);
      } else {
        setActivePageIndex(0);
        setAnimationPreview(undefined);
      }
    });
    return () => {
      isActive = false;
    };
  }, [playPresentationPage, shareId, shareService]);

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
