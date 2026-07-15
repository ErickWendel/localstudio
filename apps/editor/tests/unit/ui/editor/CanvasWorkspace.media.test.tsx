import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { CanvasWorkspace } from '../../../../src/ui/editor/canvas/CanvasWorkspace';
import { canvasWorkspaceTestFixtures } from './CanvasWorkspace.fixtures';

const { createMediaProject, updateVideoElement } = canvasWorkspaceTestFixtures;

describe('CanvasWorkspace media elements', () => {
  it('does not show image-only floating tools for selected videos or GIFs', () => {
    const project = createMediaProject();

    const { rerender } = render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['video-demo'] }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'BG Remover' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Flip' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crop' })).not.toBeInTheDocument();

    rerender(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['gif-demo'] }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'BG Remover' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Flip' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crop' })).not.toBeInTheDocument();
  });

  it('renders video media with playback attributes and preview autoplay', () => {
    const project = createMediaProject();

    const { container, rerender } = render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['video-demo'] }}
      />,
    );

    const editorVideo = container.querySelector(
      'video[aria-label="Demo clip"]',
    ) as HTMLVideoElement;
    expect(editorVideo).toBeInTheDocument();
    expect(editorVideo.autoplay).toBe(false);
    expect(editorVideo.loop).toBe(false);
    expect(editorVideo.controls).toBe(false);
    expect(editorVideo.muted).toBe(true);
    expect(editorVideo.volume).toBe(0.75);
    expect(editorVideo.preload).toBe('auto');

    rerender(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        presentationMode
        readOnly
      />,
    );

    const previewVideo = container.querySelector(
      'video[aria-label="Demo clip"]',
    ) as HTMLVideoElement;
    expect(previewVideo.autoplay).toBe(true);
    expect(previewVideo.controls).toBe(false);
    expect(previewVideo.preload).toBe('auto');
    expect(previewVideo.dataset.trimStart).toBe('2');
    expect(previewVideo.dataset.trimEnd).toBe('6');
  });

  it('plays start-on-click videos when their animation build becomes active', async () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve());
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
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

    const { container, rerender } = render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        animationPreview={{
          activeBuildElementId: 'video-demo',
          animationProgress: 0,
          hiddenElementIds: [],
          pageId: 'page-1',
          phase: 'waiting',
          playing: true,
          waitingForClick: true,
        }}
        presentationMode
        readOnly
      />,
    );

    const video = container.querySelector('video[aria-label="Demo clip"]') as HTMLVideoElement;
    expect(video.autoplay).toBe(false);
    expect(video.style.opacity).toBe('1');

    rerender(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        animationPreview={{
          activeBuild: project.pages[0]?.animationBuilds?.[0],
          activeBuildElementId: 'video-demo',
          animationProgress: 1,
          hiddenElementIds: ['video-demo'],
          pageId: 'page-1',
          phase: 'animation',
          playing: true,
          waitingForClick: false,
        }}
        presentationMode
        readOnly
      />,
    );

    await waitFor(() => expect(playSpy).toHaveBeenCalled());
    expect(video.style.opacity).toBe('1');
    playSpy.mockRestore();
    pauseSpy.mockRestore();
  });

  it('plays movie-start builds during editor animation preview', async () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve());
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
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

    render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        animationPreview={{
          activeBuild: project.pages[0]?.animationBuilds?.[0],
          activeBuildElementId: 'video-demo',
          animationProgress: 1,
          hiddenElementIds: [],
          mode: 'editor',
          pageId: 'page-1',
          phase: 'animation',
          playing: true,
          waitingForClick: false,
        }}
      />,
    );

    await waitFor(() => expect(playSpy).toHaveBeenCalled());
    playSpy.mockRestore();
    pauseSpy.mockRestore();
  });

  it('keeps video overlays non-interactive in editor mode so the canvas handles selection', () => {
    const project = createMediaProject();
    const { container, rerender } = render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
      />,
    );

    const unselectedVideo = container.querySelector(
      'video[aria-label="Demo clip"]',
    ) as HTMLVideoElement;
    expect(unselectedVideo.style.pointerEvents).toBe('none');

    rerender(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['video-demo'] }}
      />,
    );

    const selectedVideo = container.querySelector(
      'video[aria-label="Demo clip"]',
    ) as HTMLVideoElement;
    expect(selectedVideo.style.pointerEvents).toBe('none');
    expect(selectedVideo.controls).toBe(false);
  });

  it('seeks the selected video when trim sliders update the boundaries', () => {
    const project = createMediaProject();
    const { container, rerender } = render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['video-demo'] }}
      />,
    );

    const video = container.querySelector('video[aria-label="Demo clip"]') as HTMLVideoElement;
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(2);

    const startTrimmedProject = updateVideoElement(project, { trimStartSeconds: 4 });
    rerender(
      <CanvasWorkspace
        project={startTrimmedProject}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['video-demo'] }}
      />,
    );
    expect(video.currentTime).toBe(4);

    const endTrimmedProject = updateVideoElement(startTrimmedProject, { trimEndSeconds: 5 });
    rerender(
      <CanvasWorkspace
        project={endTrimmedProject}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['video-demo'] }}
      />,
    );
    expect(video.currentTime).toBe(5);
  });

  it('plays, pauses, and seeks the selected video from inspector playback state', async () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined);
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const project = updateVideoElement(createMediaProject(), {
      playbackPositionSeconds: 3,
      playing: true,
    });

    const { container, rerender } = render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['video-demo'] }}
      />,
    );

    const video = container.querySelector('video[aria-label="Demo clip"]') as HTMLVideoElement;
    await waitFor(() => expect(playSpy).toHaveBeenCalled());
    expect(video.currentTime).toBe(3);

    rerender(
      <CanvasWorkspace
        project={updateVideoElement(project, { playing: false })}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['video-demo'] }}
      />,
    );

    await waitFor(() => expect(pauseSpy).toHaveBeenCalled());
    playSpy.mockRestore();
    pauseSpy.mockRestore();
  });

  it('restarts autoplay videos when fullscreen presentation playback starts', async () => {
    const playSpy = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve());
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const project = createMediaProject();
    const { container, rerender } = render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
      />,
    );

    const video = container.querySelector('video[aria-label="Demo clip"]') as HTMLVideoElement;
    video.currentTime = 5;

    rerender(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        animationPreview={{
          activeBuildElementId: undefined,
          animationProgress: 0,
          hiddenElementIds: [],
          mode: 'presenter',
          pageId: 'page-1',
          phase: 'complete',
          playbackRunId: 1,
          playing: true,
          waitingForClick: false,
        }}
        presentationMode
        readOnly
      />,
    );

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(1));
    expect(video.currentTime).toBe(2);

    video.currentTime = 5;
    rerender(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        animationPreview={{
          activeBuildElementId: undefined,
          animationProgress: 0,
          hiddenElementIds: [],
          mode: 'presenter',
          pageId: 'page-1',
          phase: 'complete',
          playbackRunId: 2,
          playing: true,
          waitingForClick: false,
        }}
        presentationMode
        readOnly
      />,
    );

    await waitFor(() => expect(playSpy).toHaveBeenCalledTimes(2));
    expect(video.currentTime).toBe(2);
    playSpy.mockRestore();
    pauseSpy.mockRestore();
  });

  it('renders GIF media as an animated non-image element', () => {
    const project = createMediaProject();
    const { container } = render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['gif-demo'] }}
      />,
    );

    expect(container.querySelector('img[aria-label="Animated loop"]')).toBeInTheDocument();
  });

  it('mounts animated GIF sources only when preview playback reaches a hidden build', () => {
    const project = createMediaProject();
    project.pages[0]!.animationBuilds = [
      {
        id: 'gif-build',
        elementId: 'gif-demo',
        effect: 'reveal',
        trigger: 'after-transition',
        delayMs: 0,
        durationMs: 500,
      },
    ];
    const build = project.pages[0]!.animationBuilds[0];

    const { container, rerender } = render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        animationPreview={{
          activeBuildElementId: undefined,
          animationProgress: 0,
          hiddenElementIds: ['gif-demo'],
          pageId: 'page-1',
          phase: 'transition',
          playing: true,
          waitingForClick: false,
        }}
        presentationMode
        readOnly
      />,
    );

    const hiddenGif = container.querySelector(
      'img[aria-label="Animated loop"]',
    ) as HTMLImageElement;
    expect(hiddenGif.getAttribute('src')).toBeNull();

    rerender(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        animationPreview={{
          activeBuild: build,
          activeBuildElementId: 'gif-demo',
          animationProgress: 0,
          hiddenElementIds: ['gif-demo'],
          pageId: 'page-1',
          phase: 'animation',
          playing: true,
          waitingForClick: false,
        }}
        presentationMode
        readOnly
      />,
    );

    const activeGif = container.querySelector(
      'img[aria-label="Animated loop"]',
    ) as HTMLImageElement;
    expect(activeGif.getAttribute('src')).toBe('blob:gif');
  });

  it('restarts visible GIFs when fullscreen presentation playback starts', () => {
    const project = createMediaProject();
    const { container, rerender } = render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
      />,
    );

    const editorGif = container.querySelector(
      'img[aria-label="Animated loop"]',
    ) as HTMLImageElement;
    expect(editorGif.getAttribute('src')).toBe('blob:gif');

    rerender(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        animationPreview={{
          activeBuildElementId: undefined,
          animationProgress: 0,
          hiddenElementIds: [],
          mode: 'presenter',
          pageId: 'page-1',
          phase: 'complete',
          playbackRunId: 1,
          playing: true,
          waitingForClick: false,
        }}
        presentationMode
        readOnly
      />,
    );

    const firstPresentationGif = container.querySelector(
      'img[aria-label="Animated loop"]',
    ) as HTMLImageElement;
    expect(firstPresentationGif).not.toBe(editorGif);
    expect(firstPresentationGif.getAttribute('src')).toBe('blob:gif');

    rerender(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        animationPreview={{
          activeBuildElementId: undefined,
          animationProgress: 0,
          hiddenElementIds: [],
          mode: 'presenter',
          pageId: 'page-1',
          phase: 'complete',
          playbackRunId: 2,
          playing: true,
          waitingForClick: false,
        }}
        presentationMode
        readOnly
      />,
    );

    const secondPresentationGif = container.querySelector(
      'img[aria-label="Animated loop"]',
    ) as HTMLImageElement;
    expect(secondPresentationGif).not.toBe(firstPresentationGif);
    expect(secondPresentationGif.getAttribute('src')).toBe('blob:gif');
  });

  it('shows the object animation toolbar action for selected media elements', () => {
    const project = createMediaProject();
    render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['video-demo'] }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Animate' })).toBeInTheDocument();
  });

  it('keeps selected GIF overlays transparent to pointer input so the canvas object can move', () => {
    const project = createMediaProject();
    const { container } = render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['gif-demo'] }}
      />,
    );

    const selectedGif = container.querySelector(
      'img[aria-label="Animated loop"]',
    ) as HTMLImageElement;
    expect(selectedGif.style.pointerEvents).toBe('none');
  });

  it('shows image extraction progress before segmentation is ready', () => {
    const project = sampleProject.createSampleProject();

    render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        backgroundSelectionMode
        backgroundPreparation={{ elementId: 'image-hero', progress: 42, status: 'preparing' }}
      />,
    );

    expect(screen.getByText('Extracting image embedding...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Image extraction progress' })).toHaveAttribute(
      'aria-valuenow',
      '42',
    );
  });
});
