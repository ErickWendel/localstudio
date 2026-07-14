import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import type Konva from 'konva';
import { vi } from 'vitest';
import type { ElementFramePatch } from '../../../../src/domain/commands/elements/basicCommands';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type { ProjectDocument } from '../../../../src/domain/documents/model';
import { CanvasWorkspace } from '../../../../src/ui/editor/canvas/CanvasWorkspace';
import { canvasWorkspaceTestFixtures } from './CanvasWorkspace.fixtures';

describe('CanvasWorkspace', () => {
  const { shapeCatalog } = canvasWorkspaceTestFixtures;

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

  it('does not leak the selected image label into the canvas DOM', () => {
    render(
      <CanvasWorkspace
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
      />,
    );

    expect(screen.queryByText('Selected Image')).not.toBeInTheDocument();
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

  it('resizes selected text live instead of stretching it until transform end', () => {
    const onUpdateElementFrame = vi.fn<(elementId: string, patch: ElementFramePatch) => void>();
    const stageRef = createRef<Konva.Stage>();
    const project = sampleProject.createSampleProject();

    render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-title'] }}
        stageRef={stageRef}
        onUpdateElementFrame={onUpdateElementFrame}
      />,
    );

    const textNode = stageRef.current
      ?.find('Text')
      .find((node) => (node as Konva.Text).text() === 'AI Design Revolution') as
      | Konva.Text
      | undefined;
    expect(textNode).toBeDefined();

    const originalWidth = textNode!.width();
    const originalHeight = textNode!.height();

    act(() => {
      textNode!.scaleX(1.5);
      textNode!.scaleY(1.25);
      textNode!.fire('transform', { target: textNode });
    });

    expect(textNode!.scaleX()).toBe(1);
    expect(textNode!.scaleY()).toBe(1);
    expect(textNode!.width()).toBeCloseTo(originalWidth * 1.5);
    expect(textNode!.height()).toBeCloseTo(originalHeight * 1.25);
    expect(onUpdateElementFrame).not.toHaveBeenCalled();

    act(() => {
      textNode!.fire('transformend', { target: textNode });
    });

    expect(onUpdateElementFrame).toHaveBeenCalledWith(
      'text-title',
      expect.objectContaining({
        height: 300,
        width: 900,
      }),
    );
  });

  it('shrinks the live text editor frame to the typed text height', () => {
    const onSelectElement = vi.fn();
    const onUpdateElementFrame = vi.fn<(elementId: string, patch: ElementFramePatch) => void>();
    const onUpdateTextContent = vi.fn();
    const stageRef = createRef<Konva.Stage>();
    const project = sampleProject.createSampleProject();

    render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-title'] }}
        stageRef={stageRef}
        onSelectElement={onSelectElement}
        onUpdateElementFrame={onUpdateElementFrame}
        onUpdateTextContent={onUpdateTextContent}
      />,
    );

    const textNode = stageRef.current
      ?.find('Text')
      .find((node) => (node as Konva.Text).text() === 'AI Design Revolution') as
      | Konva.Text
      | undefined;
    expect(textNode).toBeDefined();

    act(() => {
      textNode!.fire('dblclick', { target: textNode });
    });

    const editor = screen.getByLabelText('Edit text');
    fireEvent.change(editor, { target: { value: 'Hello dear' } });

    expect(onUpdateTextContent).toHaveBeenCalledWith('text-title', 'Hello dear');
    const lastFrameUpdate = onUpdateElementFrame.mock.calls.at(-1);
    expect(lastFrameUpdate?.[0]).toBe('text-title');
    expect(typeof lastFrameUpdate?.[1].height).toBe('number');
    expect(lastFrameUpdate?.[1].height).toBeLessThan(project.elements['text-title']!.height);
  });

  it('hides vertical transform handles for selected text', () => {
    const stageRef = createRef<Konva.Stage>();
    const project = sampleProject.createSampleProject();

    render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-title'] }}
        stageRef={stageRef}
      />,
    );

    expect(stageRef.current?.findOne('.top-center')?.visible()).toBe(false);
    expect(stageRef.current?.findOne('.bottom-center')?.visible()).toBe(false);
    expect(stageRef.current?.findOne('.top-left')?.visible()).toBe(true);
    expect(stageRef.current?.findOne('.bottom-right')?.visible()).toBe(true);
  });

  it('resizes selected images live instead of stretching the bitmap until transform end', async () => {
    const onUpdateElementFrame = vi.fn<(elementId: string, patch: ElementFramePatch) => void>();
    const stageRef = createRef<Konva.Stage>();

    render(
      <CanvasWorkspace
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        stageRef={stageRef}
        onUpdateElementFrame={onUpdateElementFrame}
      />,
    );

    await waitFor(() => {
      expect(stageRef.current?.findOne('Image')).toBeDefined();
    });

    const imageNode = stageRef.current?.findOne('Image');
    expect(imageNode).toBeDefined();

    const originalWidth = imageNode!.width();
    const originalHeight = imageNode!.height();

    act(() => {
      imageNode!.scaleX(0.8);
      imageNode!.scaleY(1.2);
      imageNode!.fire('transform', { target: imageNode });
    });

    expect(imageNode!.scaleX()).toBe(1);
    expect(imageNode!.scaleY()).toBe(1);
    expect(imageNode!.width()).toBeCloseTo(originalWidth * 0.8);
    expect(imageNode!.height()).toBeCloseTo(originalHeight * 1.2);
    expect(onUpdateElementFrame).not.toHaveBeenCalled();

    act(() => {
      imageNode!.fire('transformend', { target: imageNode });
    });

    expect(onUpdateElementFrame).toHaveBeenCalledWith(
      'image-hero',
      expect.objectContaining({
        height: 882,
        width: 784,
      }),
    );
  });

  it('selects slide and presentation surfaces from canvas clicks', () => {
    const onSelectPresentation = vi.fn();
    const onSelectSlide = vi.fn();
    const { container } = render(
      <CanvasWorkspace
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        onSelectPresentation={onSelectPresentation}
        onSelectSlide={onSelectSlide}
      />,
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    fireEvent.mouseDown(canvas!);
    fireEvent.pointerDown(container.querySelector('.canvas-workspace')!);

    expect(onSelectSlide).toHaveBeenCalledTimes(1);
    expect(onSelectPresentation).toHaveBeenCalledTimes(1);
  });

  it('draws a green marquee and selects elements intersecting it', async () => {
    const onSelectElement = vi.fn();
    const stageRef = createRef<Konva.Stage>();
    const { container } = render(
      <CanvasWorkspace
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        stageRef={stageRef}
        onSelectElement={onSelectElement}
      />,
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    fireEvent.mouseDown(canvas!, { clientX: 450, clientY: 170 });
    fireEvent.mouseMove(window, { clientX: 735, clientY: 315 });

    await waitFor(() => {
      expect(screen.getByTestId('marquee-selection-box')).toHaveStyle({
        height: '145px',
        left: '450px',
        top: '170px',
        width: '285px',
      });
    });
    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute(
      'data-marquee-selection',
      'active',
    );

    fireEvent.mouseUp(window, { clientX: 735, clientY: 315 });

    expect(onSelectElement).toHaveBeenCalledTimes(2);
    expect(onSelectElement).toHaveBeenNthCalledWith(1, 'text-subtitle');
    expect(onSelectElement).toHaveBeenNthCalledWith(2, 'text-title', { additive: true });
  });

  it('keeps the marquee origin at the initial mouse position when dragging upward', async () => {
    const { container } = render(
      <CanvasWorkspace
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [] }}
        onSelectElement={() => undefined}
      />,
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    fireEvent.mouseDown(canvas!, { clientX: 735, clientY: 315 });
    fireEvent.mouseMove(window, { clientX: 450, clientY: 170 });

    await waitFor(() => {
      expect(screen.getByTestId('marquee-selection-box')).toHaveStyle({
        height: '145px',
        left: '450px',
        top: '170px',
        width: '285px',
      });
    });
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
