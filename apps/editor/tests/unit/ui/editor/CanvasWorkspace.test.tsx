import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import type Konva from 'konva';
import { vi } from 'vitest';
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
