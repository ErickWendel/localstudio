import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import type Konva from 'konva';
import { vi } from 'vitest';
import type { AnimationEffect } from '../../../../src/domain/documents/model';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { CanvasWorkspace } from '../../../../src/ui/editor/canvas/CanvasWorkspace';
import { canvasWorkspaceTestFixtures } from './CanvasWorkspace.fixtures';

const { createMediaProject, updateVideoElement } = canvasWorkspaceTestFixtures;

describe('CanvasWorkspace animation preview', () => {
  it('marks active animation preview state and advances click-triggered builds', () => {
    const onAnimationPreviewAdvance = vi.fn();
    const { container } = render(
      <CanvasWorkspace
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        animationPreview={{
          activeBuildElementId: 'image-hero',
          pageId: 'page-1',
          phase: 'waiting',
          hiddenElementIds: ['image-hero'],
          playing: true,
          waitingForClick: true,
        }}
        onAnimationPreviewAdvance={onAnimationPreviewAdvance}
      />,
    );

    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
      'data-animation-preview',
      'playing',
    );
    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
      'data-animation-preview-waiting',
      'true',
    );
    expect(screen.getByText('Click the slide to play the next animation.')).toBeInTheDocument();

    fireEvent.mouseDown(container.querySelector('canvas')!);

    expect(onAnimationPreviewAdvance).toHaveBeenCalledTimes(1);
  });

  it('starts pending movie builds when the slide click advances the next build', () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve());
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const onAnimationPreviewAdvance = vi.fn();
    const project = updateVideoElement(createMediaProject(), { startOnClick: true });
    project.pages[0]!.animationBuilds = [
      {
        id: 'video-build',
        elementId: 'video-demo',
        effect: 'reveal',
        trigger: 'on-click',
        delayMs: 0,
        durationMs: 0,
        mediaAction: 'play',
      },
    ];
    const { container } = render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        animationPreview={{
          activeBuildElementId: 'video-demo',
          pageId: 'page-1',
          phase: 'waiting',
          hiddenElementIds: [],
          playing: true,
          waitingForClick: true,
        }}
        onAnimationPreviewAdvance={onAnimationPreviewAdvance}
      />,
    );

    fireEvent.mouseDown(container.querySelector('canvas')!);

    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(onAnimationPreviewAdvance).toHaveBeenCalledTimes(1);
    playSpy.mockRestore();
    pauseSpy.mockRestore();
  });

  it('advances completed animation previews by click in presentation mode', () => {
    const onAnimationPreviewAdvance = vi.fn();
    const { container } = render(
      <CanvasWorkspace
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        animationPreview={{
          activeBuildElementId: undefined,
          pageId: 'page-1',
          phase: 'complete',
          hiddenElementIds: [],
          playing: true,
          waitingForClick: false,
        }}
        presentationMode
        onAnimationPreviewAdvance={onAnimationPreviewAdvance}
      />,
    );

    fireEvent.mouseDown(container.querySelector('canvas')!);

    expect(onAnimationPreviewAdvance).toHaveBeenCalledTimes(1);
  });

  it('hides canvas quick actions while animation preview is active', () => {
    render(
      <CanvasWorkspace
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        animationPreview={{
          activeBuildElementId: undefined,
          pageId: 'page-1',
          phase: 'transition',
          hiddenElementIds: [],
          playing: true,
          waitingForClick: false,
        }}
        onInsertMedia={vi.fn()}
        onInsertText={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Insert Text' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Insert Media' })).not.toBeInTheDocument();
  });

  it.each<{ effect: AnimationEffect; expectedNodeName: string }>([
    { effect: 'move-in', expectedNodeName: '.animated-element-image-hero' },
    { effect: 'wipe', expectedNodeName: '.animation-mask' },
    { effect: 'confetti', expectedNodeName: '.animation-particle' },
  ])('renders $effect animation preview nodes on the Konva stage', async ({ effect, expectedNodeName }) => {
    const project = sampleProject.createSampleProject();
    const build = {
      id: `build-${effect}`,
      elementId: 'image-hero',
      effect,
      trigger: 'on-click' as const,
      delayMs: 700,
      direction: 'left' as const,
    };
    const stageRef = createRef<Konva.Stage>();

    render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        stageRef={stageRef}
        animationPreview={{
          activeBuild: build,
          activeBuildElementId: 'image-hero',
          animationProgress: 0.5,
          hiddenElementIds: ['image-hero'],
          pageId: 'page-1',
          phase: 'animation',
          playing: true,
          waitingForClick: false,
        }}
      />,
    );

    await waitFor(() => {
      expect(stageRef.current?.find(expectedNodeName).length).toBeGreaterThan(0);
    });
  });

  it('shows canvas quick actions after animation preview completes', () => {
    render(
      <CanvasWorkspace
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        animationPreview={{
          activeBuildElementId: undefined,
          pageId: 'page-1',
          phase: 'complete',
          hiddenElementIds: [],
          playing: true,
          waitingForClick: false,
        }}
        onInsertMedia={vi.fn()}
        onInsertText={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Insert Text' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert Media' })).toBeInTheDocument();
  });

  it('shows numbered animation build badges and highlights the selected animated element', () => {
    const project = sampleProject.createSampleProject();
    project.pages[0] = {
      ...project.pages[0]!,
      animationBuilds: [
        {
          id: 'build-image-hero',
          elementId: 'image-hero',
          effect: 'reveal',
          trigger: 'on-click',
          delayMs: 0,
        },
        {
          id: 'build-text-title',
          elementId: 'text-title',
          effect: 'reveal',
          trigger: 'on-click',
          delayMs: 0,
        },
      ],
    };

    render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-title'] }}
      />,
    );

    expect(screen.getByLabelText('Animation build 1 for Image')).toHaveTextContent('1');
    expect(screen.getByLabelText('Animation build 2 for AI Design Revolution')).toHaveAttribute(
      'data-selected',
      'true',
    );
  });
});
