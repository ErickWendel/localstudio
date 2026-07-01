import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectDocument } from '../../../../src/domain/model';
import { useAnimationPreviewController } from '../../../../src/ui/editor/useAnimationPreviewController';

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
});
