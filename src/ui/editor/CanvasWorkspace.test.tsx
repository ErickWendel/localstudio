import { render, screen } from '@testing-library/react';
import { createSampleProject } from '../../domain/sampleProject';
import { CanvasWorkspace } from './CanvasWorkspace';

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
    expect(screen.getByText('AI Design Revolution')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove Background')).toBeInTheDocument();
  });
});
