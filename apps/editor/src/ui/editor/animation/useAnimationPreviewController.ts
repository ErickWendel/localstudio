import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { ElementAnimationBuild, ProjectDocument } from '../../../domain/documents/model';

export interface AnimationPreviewState {
  activeBuildElementId: string | undefined;
  hiddenElementIds: string[];
  mode: 'editor' | 'presenter';
  pageId: string;
  phase: 'transition' | 'animation' | 'waiting' | 'complete';
  playing: boolean;
  waitingForClick: boolean;
}

interface AnimationPreviewControllerOptions {
  activePageIdRef: MutableRefObject<string>;
  projectRef: MutableRefObject<ProjectDocument>;
  setActivePageId: (pageId: string) => void;
  setSelectedElementIds: (elementIds: string[]) => void;
}

export function useAnimationPreviewController({
  activePageIdRef,
  projectRef,
  setActivePageId,
  setSelectedElementIds,
}: AnimationPreviewControllerOptions) {
  const [animationPreview, setAnimationPreview] = useState<AnimationPreviewState | undefined>();
  const animationPreviewQueueRef = useRef<ElementAnimationBuild[]>([]);
  const animationPreviewTimeoutsRef = useRef<number[]>([]);

  function clearAnimationPreviewTimers() {
    for (const timeoutId of animationPreviewTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    animationPreviewTimeoutsRef.current = [];
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
            activeBuildElementId: undefined,
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
            activeBuildElementId: undefined,
            hiddenElementIds: current.hiddenElementIds.filter((elementId) => elementId !== build.elementId),
            waitingForClick: false,
          }
        : current,
    );
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
              activeBuildElementId: nextBuild.elementId,
              phase: 'waiting',
              waitingForClick: true,
            }
          : current,
      );
      return;
    }

    animationPreviewQueueRef.current = animationPreviewQueueRef.current.slice(1);
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
    scheduleAnimationPreview(() => {
      revealAnimationBuild(nextBuild);
      runNextAnimationBuild();
    }, nextBuild.delayMs);
  }

  function advanceAnimationPreview() {
    const nextBuild = animationPreviewQueueRef.current[0];
    if (!nextBuild) {
      completeAnimationPreviewSlide();
      return;
    }
    animationPreviewQueueRef.current = animationPreviewQueueRef.current.slice(1);
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
    scheduleAnimationPreview(() => {
      revealAnimationBuild(nextBuild);
      runNextAnimationBuild();
    }, nextBuild.delayMs);
  }

  function playAnimationPreview(pageId = activePageIdRef.current, mode: AnimationPreviewState['mode'] = 'editor') {
    const page = projectRef.current.pages.find((item) => item.id === pageId);
    if (!page) return;
    const builds = (page.animationBuilds ?? []).filter((build) => page.elementIds.includes(build.elementId));
    clearAnimationPreviewTimers();
    animationPreviewQueueRef.current = builds;
    const transitionDelay = page.transition?.delayMs ?? 0;
    setAnimationPreview({
      activeBuildElementId: undefined,
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

  function rewindPresentationPreview() {
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
