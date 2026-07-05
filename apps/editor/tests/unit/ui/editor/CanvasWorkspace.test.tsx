import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type {
  ProjectDocument,
  ShapeElement,
  VideoElement,
} from '../../../../src/domain/documents/model';
import { CanvasWorkspace } from '../../../../src/ui/editor/canvas/CanvasWorkspace';

describe('CanvasWorkspace', () => {
  const shapeCatalog: ShapeElement['shape'][] = [
    'ellipse',
    'line',
    'rect',
    'rounded-rect',
    'triangle',
    'pentagon',
    'diamond',
    'parallelogram',
    'arrow',
    'arc',
  ];

  function createMediaProject(): ProjectDocument {
    const project = sampleProject.createSampleProject();
    project.assets['asset-video'] = {
      id: 'asset-video',
      type: 'video',
      name: 'Demo clip',
      mimeType: 'video/mp4',
      objectUrl: 'blob:video',
    };
    project.assets['asset-gif'] = {
      id: 'asset-gif',
      type: 'gif',
      name: 'Animated loop',
      mimeType: 'image/gif',
      objectUrl: 'blob:gif',
    };
    project.elements['video-demo'] = {
      id: 'video-demo',
      type: 'video',
      assetId: 'asset-video',
      x: 120,
      y: 80,
      width: 640,
      height: 360,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      loop: true,
      repeatMode: 'loop',
      controls: true,
      muted: true,
      autoplayInPreview: true,
      trimStartSeconds: 2,
      trimEndSeconds: 6,
      durationSeconds: 12,
      volume: 0.75,
    };
    project.elements['gif-demo'] = {
      id: 'gif-demo',
      type: 'gif',
      assetId: 'asset-gif',
      x: 220,
      y: 180,
      width: 320,
      height: 180,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      playing: true,
    };
    project.pages[0]?.elementIds.push('video-demo', 'gif-demo');
    return project;
  }

  function updateVideoElement(
    project: ProjectDocument,
    patch: Partial<VideoElement>,
  ): ProjectDocument {
    const videoElement = project.elements['video-demo'];
    if (videoElement?.type !== 'video') {
      throw new Error('Expected video-demo test fixture to be a video element.');
    }
    return {
      ...project,
      elements: {
        ...project.elements,
        'video-demo': {
          ...videoElement,
          ...patch,
        },
      },
    };
  }

  it('renders page elements and selected image toolbar', () => {
    const project = sampleProject.createSampleProject();
    const { container } = render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
      />,
    );

    expect(screen.getByLabelText('Slide canvas')).toBeInTheDocument();
    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute('data-drag-guide', 'idle');
    expect(container.querySelector('canvas')).toBeInTheDocument();
    expect(screen.getByLabelText('BG Remover')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Flip' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crop' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Animate' })).toBeInTheDocument();
  });

  it('uses layout sizing instead of transform scaling for zoom', () => {
    render(
      <CanvasWorkspace
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        zoomPercent={50}
      />,
    );

    const canvasFrame = screen.getByLabelText('Slide canvas');

    expect(canvasFrame).not.toHaveStyle({ transform: 'scale(0.5)' });
    expect(canvasFrame).toHaveStyle({ '--canvas-zoom': '0.5' });
  });

  it('renders every supported shape catalog item without crashing', () => {
    const project = sampleProject.createSampleProject();
    const shapes = Object.fromEntries(
      shapeCatalog.map((shape, index) => [
        `shape-${shape}`,
        {
          id: `shape-${shape}`,
          type: 'shape' as const,
          shape,
          x: 80 + index * 24,
          y: 120 + index * 18,
          width: 180,
          height: 140,
          rotation: 0,
          locked: false,
          visible: true,
          opacity: 1,
          fill: '#37FD76',
          stroke: '#FFFFFF',
          strokeWidth: 2,
        },
      ]),
    );
    const shapedProject: ProjectDocument = {
      ...project,
      elements: {
        ...project.elements,
        ...shapes,
      },
      pages: project.pages.map((page) =>
        page.id === 'page-1'
          ? { ...page, elementIds: [...page.elementIds, ...Object.keys(shapes)] }
          : page,
      ),
    };

    const { container } = render(
      <CanvasWorkspace
        project={shapedProject}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['shape-arrow'] }}
      />,
    );

    expect(container.querySelector('canvas')).toBeInTheDocument();
    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
      'data-selected-elements',
      'shape-arrow',
    );
  });

  it('toggles crop mode for selected images', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();

    render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Crop' }));

    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crop left' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crop bottom right' })).toBeInTheDocument();
  });

  it('exits crop mode when the user clicks the canvas background', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    const { container } = render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Crop' }));
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();

    fireEvent.mouseDown(container.querySelector('canvas')!);

    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crop left' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crop' })).toBeInTheDocument();
  });

  it('does not render document text outside the Konva canvas', () => {
    const project = sampleProject.createSampleProject();
    const { container } = render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
      />,
    );

    expect(container.querySelector('.canvas-accessible-text')).not.toBeInTheDocument();
  });

  it('selects the slide when the slide background is clicked', () => {
    const onSelectSlide = vi.fn();
    const { container } = render(
      <CanvasWorkspace
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        onSelectSlide={onSelectSlide}
      />,
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    fireEvent.mouseDown(canvas!);

    expect(onSelectSlide).toHaveBeenCalledTimes(1);
  });

  it('selects the presentation when outside the slide is clicked', () => {
    const onSelectPresentation = vi.fn();
    render(
      <CanvasWorkspace
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        onSelectPresentation={onSelectPresentation}
      />,
    );

    fireEvent.pointerDown(screen.getByLabelText('Slide canvas'));

    expect(onSelectPresentation).toHaveBeenCalledTimes(1);
  });

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

  it('shows background selection guidance and active cursor treatment', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();

    render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        backgroundSelectionMode
        onCancelBackgroundSelection={() => undefined}
      />,
    );

    expect(
      screen.getByText(
        'Right click adds areas to keep. Left click applies the background removal.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Slide canvas')).not.toHaveClass('canvas-frame-bg-selection');
    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
      'data-background-selection-target',
      'image-hero',
    );

    await user.click(screen.getByRole('button', { name: 'Cancel BG Remover' }));
  });

  it('shows selected image processing feedback while background removal runs', () => {
    const project = sampleProject.createSampleProject();

    render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        processingElementIds={['image-hero']}
      />,
    );

    expect(screen.getByText('Removing background...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel BG Remover' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BG Remover' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

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

  it('loads canvas fonts so Konva text redraws after web fonts are ready', () => {
    const load = vi.fn().mockResolvedValue([]);
    const originalFonts = document.fonts;
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        load,
        ready: Promise.resolve(),
      },
    });

    render(
      <CanvasWorkspace
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
      />,
    );

    expect(load).toHaveBeenCalledWith('800 96px Orbitron');
    expect(load).toHaveBeenCalledWith('600 40px "Open Sans"');

    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: originalFonts,
    });
  });
});
