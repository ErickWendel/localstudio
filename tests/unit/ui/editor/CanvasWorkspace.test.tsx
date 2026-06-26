import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createSampleProject } from '../../../../src/domain/sampleProject';
import { CanvasWorkspace } from '../../../../src/ui/editor/CanvasWorkspace';

describe('CanvasWorkspace', () => {
  it('renders page elements and selected image toolbar', () => {
    const project = createSampleProject();
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
  });

  it('toggles crop mode for selected images', async () => {
    const user = userEvent.setup();
    const project = createSampleProject();

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
    const project = createSampleProject();
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
    const project = createSampleProject();
    const { container } = render(
      <CanvasWorkspace
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
      />,
    );

    expect(container.querySelector('.canvas-accessible-text')).not.toBeInTheDocument();
  });

  it('clears selection when the empty canvas background is clicked', () => {
    const onClearSelection = vi.fn();
    const { container } = render(
      <CanvasWorkspace
        project={createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        onClearSelection={onClearSelection}
      />,
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    fireEvent.mouseDown(canvas!);

    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('shows background selection guidance and active cursor treatment', async () => {
    const user = userEvent.setup();
    const project = createSampleProject();

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
      screen.getByText('Right click adds areas to keep. Left click applies the background removal.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Slide canvas')).not.toHaveClass('canvas-frame-bg-selection');
    expect(screen.getByLabelText('Slide canvas')).toHaveAttribute('data-background-selection-target', 'image-hero');

    await user.click(screen.getByRole('button', { name: 'Cancel BG Remover' }));
  });

  it('shows selected image processing feedback while background removal runs', () => {
    const project = createSampleProject();

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

  it('shows image extraction progress before segmentation is ready', () => {
    const project = createSampleProject();

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
        project={createSampleProject()}
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
