import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(container.querySelector('canvas')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove Background')).toBeInTheDocument();
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

    expect(screen.getByText('Click the main object to keep. Everything else will be removed.')).toBeInTheDocument();
    expect(screen.getByLabelText('Slide canvas')).toHaveClass('canvas-frame-bg-selection');

    await user.click(screen.getByRole('button', { name: 'Cancel Background Selection' }));
  });
});
