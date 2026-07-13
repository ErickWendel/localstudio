import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectDocument } from '../../../../src/domain/documents/model';
import { useAnimationPreviewController } from '../../../../src/ui/editor/animation/useAnimationPreviewController';

function createProject(): ProjectDocument {
  return {
    id: 'project-1',
    name: 'Preview project',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    assets: {},
    elements: {
      title: {
        id: 'title',
        type: 'text',
        text: 'Title',
        x: 0,
        y: 0,
        width: 400,
        height: 80,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        fontFamily: 'Inter',
        fontSize: 32,
        fontWeight: 700,
        fill: '#111111',
        align: 'left',
      },
    },
    pages: [
      {
        id: 'page-1',
        name: 'Slide 1',
        width: 1280,
        height: 720,
        background: { type: 'color', color: '#ffffff' },
        elementIds: ['title'],
        animationBuilds: [
          {
            id: 'animation-title',
            elementId: 'title',
            effect: 'reveal',
            trigger: 'on-click',
            delayMs: 250,
          },
        ],
      },
      {
        id: 'page-2',
        name: 'Slide 2',
        width: 1280,
        height: 720,
        background: { type: 'color', color: '#ffffff' },
        elementIds: [],
        animationBuilds: [],
      },
    ],
  };
}

describe('useAnimationPreviewController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    return () => vi.useRealTimers();
  });

  it('waits for click-triggered builds and completes after advancing them', () => {
    const projectRef = { current: createProject() };
    const activePageIdRef = { current: 'page-1' };
    const setActivePageId = vi.fn();
    const setSelectedElementIds = vi.fn();
    const { result } = renderHook(() =>
      useAnimationPreviewController({
        activePageIdRef,
        projectRef,
        setActivePageId,
        setSelectedElementIds,
      }),
    );

    act(() => {
      result.current.playAnimationPreview('page-1', 'presenter');
    });

    expect(result.current.animationPreview).toMatchObject({
      hiddenElementIds: ['title'],
      mode: 'presenter',
      pageId: 'page-1',
      phase: 'animation',
      playing: true,
      waitingForClick: false,
    });

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(result.current.animationPreview).toMatchObject({
      activeBuildElementId: 'title',
      hiddenElementIds: ['title'],
      phase: 'waiting',
      waitingForClick: true,
    });

    act(() => {
      result.current.advanceAnimationPreview();
    });

    expect(result.current.animationPreview).toMatchObject({
      activeBuildElementId: 'title',
      phase: 'animation',
      waitingForClick: false,
    });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current.animationPreview).toMatchObject({
      activeBuildElementId: undefined,
      hiddenElementIds: [],
      phase: 'complete',
      waitingForClick: false,
    });
  });

  it('does not hide video media-play builds while waiting for their start trigger', () => {
    const project = createProject();
    project.assets.video = {
      id: 'video',
      type: 'video',
      name: 'Clip',
      mimeType: 'video/mp4',
    };
    project.elements.video = {
      id: 'video',
      type: 'video',
      assetId: 'video',
      x: 0,
      y: 0,
      width: 640,
      height: 360,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      loop: false,
      controls: true,
      muted: false,
      autoplayInPreview: true,
      trimStartSeconds: 0,
    };
    project.pages[0]!.elementIds = ['video'];
    project.pages[0]!.animationBuilds = [
      {
        id: 'video-play',
        elementId: 'video',
        effect: 'reveal',
        trigger: 'on-click',
        delayMs: 0,
        durationMs: 0,
        mediaAction: 'play',
      },
    ];
    const projectRef = { current: project };
    const activePageIdRef = { current: 'page-1' };
    const { result } = renderHook(() =>
      useAnimationPreviewController({
        activePageIdRef,
        projectRef,
        setActivePageId: vi.fn(),
        setSelectedElementIds: vi.fn(),
      }),
    );

    act(() => {
      result.current.playAnimationPreview('page-1', 'presenter');
      vi.runOnlyPendingTimers();
    });

    expect(result.current.animationPreview).toMatchObject({
      activeBuildElementId: 'video',
      hiddenElementIds: [],
      phase: 'waiting',
      waitingForClick: true,
    });
  });

  it('reports the current presenter page synchronously during presentation navigation', () => {
    const projectRef = { current: createProject() };
    const activePageIdRef = { current: 'page-1' };
    const setActivePageId = vi.fn();
    const setSelectedElementIds = vi.fn();
    const onPresenterPageChange = vi.fn();
    const { result } = renderHook(() =>
      useAnimationPreviewController({
        activePageIdRef,
        onPresenterPageChange,
        projectRef,
        setActivePageId,
        setSelectedElementIds,
      }),
    );

    act(() => {
      result.current.playPresentationPreview('page-1');
    });

    act(() => {
      vi.runOnlyPendingTimers();
    });

    act(() => {
      result.current.advanceAnimationPreview();
    });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    act(() => {
      result.current.advancePresentationPreview();
    });

    expect(onPresenterPageChange).toHaveBeenCalledWith('page-1');
    expect(onPresenterPageChange).toHaveBeenLastCalledWith('page-2');
    expect(activePageIdRef.current).toBe('page-2');
  });

  it('skips hidden slides during presenter navigation', () => {
    const project = createProject();
    project.pages[1] = { ...project.pages[1]!, visible: false };
    project.pages.push({
      id: 'page-3',
      name: 'Slide 3',
      width: 1280,
      height: 720,
      background: { type: 'color', color: '#ffffff' },
      elementIds: [],
      animationBuilds: [],
      visible: true,
    });
    const projectRef = { current: project };
    const activePageIdRef = { current: 'page-1' };
    const setActivePageId = vi.fn();
    const setSelectedElementIds = vi.fn();
    const { result } = renderHook(() =>
      useAnimationPreviewController({
        activePageIdRef,
        projectRef,
        setActivePageId,
        setSelectedElementIds,
      }),
    );

    act(() => {
      result.current.playPresentationPreview('page-1');
    });
    act(() => {
      vi.runOnlyPendingTimers();
    });
    act(() => {
      result.current.advanceAnimationPreview();
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    act(() => {
      result.current.advancePresentationPreview();
    });

    expect(activePageIdRef.current).toBe('page-3');
    expect(setActivePageId).toHaveBeenLastCalledWith('page-3');
  });

  it('rewinds through the current slide build pipeline before moving to the previous slide', () => {
    const projectRef = { current: createProject() };
    const activePageIdRef = { current: 'page-1' };
    const setActivePageId = vi.fn();
    const setSelectedElementIds = vi.fn();
    const { result } = renderHook(() =>
      useAnimationPreviewController({
        activePageIdRef,
        projectRef,
        setActivePageId,
        setSelectedElementIds,
      }),
    );

    act(() => {
      result.current.playPresentationPreview('page-1');
    });
    act(() => {
      vi.runOnlyPendingTimers();
    });
    act(() => {
      result.current.advancePresentationPreview();
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current.animationPreview).toMatchObject({
      hiddenElementIds: [],
      pageId: 'page-1',
      phase: 'complete',
    });

    act(() => {
      result.current.rewindPresentationPreview();
    });

    expect(activePageIdRef.current).toBe('page-1');
    expect(result.current.animationPreview).toMatchObject({
      activeBuildElementId: 'title',
      hiddenElementIds: ['title'],
      pageId: 'page-1',
      phase: 'waiting',
      waitingForClick: true,
    });
  });
});
