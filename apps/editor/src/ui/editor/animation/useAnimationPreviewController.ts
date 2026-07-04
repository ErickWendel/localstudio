import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { ElementAnimationBuild, ProjectDocument } from '../../../domain/documents/model';

export interface AnimationPreviewState {
  activeBuild: ElementAnimationBuild | undefined;
  activeBuildElementId: string | undefined;
  animationProgress: number;
  hiddenElementIds: string[];
  mode: 'editor' | 'presenter';
  pageId: string;
  phase: 'transition' | 'animation' | 'waiting' | 'complete';
  playing: boolean;
  waitingForClick: boolean;
}

interface AnimationPreviewControllerOptions {
  activePageIdRef: MutableRefObject<string>;
  onPresenterPageChange?: ((pageId: string) => void) | undefined;
  projectRef: MutableRefObject<ProjectDocument>;
  setActivePageId: (pageId: string) => void;
  setSelectedElementIds: (elementIds: string[]) => void;
}

function getBuildPlaybackDurationMs(build: ElementAnimationBuild) {
  return Math.max(0, build.durationMs ?? build.delayMs);
}

export function useAnimationPreviewController({
  activePageIdRef,
  onPresenterPageChange,
  projectRef,
  setActivePageId,
  setSelectedElementIds,
}: AnimationPreviewControllerOptions) {
  const [animationPreview, setAnimationPreview] = useState<AnimationPreviewState | undefined>();
  const animationPreviewQueueRef = useRef<ElementAnimationBuild[]>([]);
  const animationPreviewTimeoutsRef = useRef<number[]>([]);
  const animationPreviewFrameRef = useRef<number | undefined>(undefined);

  function clearAnimationPreviewTimers() {
    for (const timeoutId of animationPreviewTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    animationPreviewTimeoutsRef.current = [];
    if (animationPreviewFrameRef.current !== undefined) {
      window.cancelAnimationFrame(animationPreviewFrameRef.current);
      animationPreviewFrameRef.current = undefined;
    }
  }

  function scheduleAnimationPreview(callback: () => void, delayMs: number) {
    const timeoutId = window.setTimeout(callback, Math.max(0, delayMs));
    animationPreviewTimeoutsRef.current.push(timeoutId);
  }

  function clearAnimationPreview() {
    clearAnimationPreviewTimers();
    animationPreviewQueueRef.current = [];
    setAnimationPreview(undefined);
  }

  function completeAnimationPreviewSlide() {
    animationPreviewQueueRef.current = [];
    clearAnimationPreviewTimers();
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
  }

  function revealAnimationBuild(build: ElementAnimationBuild) {
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
  }

  function animateActiveBuild(build: ElementAnimationBuild) {
    const durationMs = getBuildPlaybackDurationMs(build);
    const startMs = window.performance.now();
    if (animationPreviewFrameRef.current !== undefined) {
      window.cancelAnimationFrame(animationPreviewFrameRef.current);
      animationPreviewFrameRef.current = undefined;
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
        animationPreviewFrameRef.current = window.requestAnimationFrame(tick);
      } else {
        animationPreviewFrameRef.current = undefined;
      }
    }

    animationPreviewFrameRef.current = window.requestAnimationFrame(tick);
  }

  function runNextAnimationBuild() {
    const nextBuild = animationPreviewQueueRef.current[0];
    if (!nextBuild) {
      completeAnimationPreviewSlide();
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

    animationPreviewQueueRef.current = animationPreviewQueueRef.current.slice(1);
    animateActiveBuild(nextBuild);
    scheduleAnimationPreview(() => {
      revealAnimationBuild(nextBuild);
      runNextAnimationBuild();
    }, getBuildPlaybackDurationMs(nextBuild));
  }

  function advanceAnimationPreview() {
    const nextBuild = animationPreviewQueueRef.current[0];
    if (!nextBuild) {
      completeAnimationPreviewSlide();
      return;
    }
    animationPreviewQueueRef.current = animationPreviewQueueRef.current.slice(1);
    animateActiveBuild(nextBuild);
    scheduleAnimationPreview(() => {
      revealAnimationBuild(nextBuild);
      runNextAnimationBuild();
    }, getBuildPlaybackDurationMs(nextBuild));
  }

  function playAnimationPreview(
    pageId = activePageIdRef.current,
    mode: AnimationPreviewState['mode'] = 'editor',
  ) {
    const page = projectRef.current.pages.find((item) => item.id === pageId);
    if (!page) return;
    const builds = (page.animationBuilds ?? []).filter((build) =>
      page.elementIds.includes(build.elementId),
    );
    clearAnimationPreviewTimers();
    animationPreviewQueueRef.current = builds;
    const transitionDelay = page.transition?.delayMs ?? 0;
    if (mode === 'presenter') onPresenterPageChange?.(page.id);
    setAnimationPreview({
      activeBuild: undefined,
      activeBuildElementId: undefined,
      animationProgress: 0,
      hiddenElementIds: builds.map((build) => build.elementId),
      mode,
      pageId: page.id,
      phase: transitionDelay > 0 ? 'transition' : builds.length > 0 ? 'animation' : 'complete',
      playing: true,
      waitingForClick: false,
    });

    if (builds.length === 0) {
      if (transitionDelay > 0) {
        scheduleAnimationPreview(completeAnimationPreviewSlide, transitionDelay);
      }
      return;
    }
    scheduleAnimationPreview(runNextAnimationBuild, transitionDelay);
  }

  function goToPresentationPage(offset: -1 | 1) {
    const pages = projectRef.current.pages;
    const currentIndex = pages.findIndex((page) => page.id === activePageIdRef.current);
    if (currentIndex < 0) return false;
    const nextPage = pages[currentIndex + offset];
    if (!nextPage) return false;
    activePageIdRef.current = nextPage.id;
    setActivePageId(nextPage.id);
    setSelectedElementIds([]);
    playAnimationPreview(nextPage.id, 'presenter');
    return true;
  }

  function playPresentationPreview(pageId = activePageIdRef.current) {
    activePageIdRef.current = pageId;
    setActivePageId(pageId);
    setSelectedElementIds([]);
    playAnimationPreview(pageId, 'presenter');
  }

  function advancePresentationPreview() {
    if (animationPreview?.waitingForClick) {
      advanceAnimationPreview();
      return true;
    }
    if (animationPreview?.phase !== 'complete') return Boolean(animationPreview?.playing);
    return goToPresentationPage(1);
  }

  function getPreviewBuilds(pageId: string) {
    const page = projectRef.current.pages.find((item) => item.id === pageId);
    if (!page) return [];
    return (page.animationBuilds ?? []).filter((build) => page.elementIds.includes(build.elementId));
  }

  function getCurrentBuildIndex(builds: ElementAnimationBuild[]) {
    if (!animationPreview) return -1;
    if (animationPreview.phase === 'complete') return builds.length;
    if (animationPreview.activeBuild) {
      const activeBuildIndex = builds.findIndex((build) => build.id === animationPreview.activeBuild?.id);
      if (activeBuildIndex >= 0) return activeBuildIndex;
    }
    const nextBuild = animationPreviewQueueRef.current[0];
    if (!nextBuild) return builds.length;
    return builds.findIndex((build) => build.id === nextBuild.id);
  }

  function rewindAnimationPreviewBuild() {
    if (!animationPreview) return false;
    const builds = getPreviewBuilds(animationPreview.pageId);
    if (builds.length === 0) return false;
    const currentBuildIndex = getCurrentBuildIndex(builds);
    const targetBuildIndex = currentBuildIndex - 1;
    if (targetBuildIndex < 0) return false;
    const targetBuild = builds[targetBuildIndex];
    if (!targetBuild) return false;
    clearAnimationPreviewTimers();
    animationPreviewQueueRef.current = builds.slice(targetBuildIndex);
    setAnimationPreview((current) =>
      current
        ? {
            ...current,
            activeBuild: undefined,
            activeBuildElementId: targetBuild.elementId,
            animationProgress: 0,
            hiddenElementIds: builds
              .slice(targetBuildIndex)
              .map((build) => build.elementId),
            phase: 'waiting',
            waitingForClick: true,
          }
        : current,
    );
    return true;
  }

  function rewindPresentationPreview() {
    if (rewindAnimationPreviewBuild()) return true;
    return goToPresentationPage(-1);
  }

  useEffect(() => clearAnimationPreviewTimers, []);

  return {
    animationPreview,
    advanceAnimationPreview,
    advancePresentationPreview,
    clearAnimationPreview,
    playAnimationPreview,
    playPresentationPreview,
    rewindPresentationPreview,
  };
}
