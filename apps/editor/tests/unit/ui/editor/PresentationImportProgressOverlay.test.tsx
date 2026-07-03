import { render, screen } from '@testing-library/react';
import { PresentationImportProgressOverlay } from '../../../../src/ui/editor/shell/PresentationImportProgressOverlay';

describe('PresentationImportProgressOverlay', () => {
  it('shows descriptive PowerPoint import progress', () => {
    render(
      <PresentationImportProgressOverlay
        progress={{
          detail: 'Inspecting slide XML, relationships, and media references.',
          progress: 36,
          stage: 'inspecting',
          title: 'Inspecting PPTX structure',
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Inspecting PPTX structure' })).toBeInTheDocument();
    expect(screen.getByText('Inspecting slide XML, relationships, and media references.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'PowerPoint import progress' })).toHaveAttribute(
      'aria-valuenow',
      '36',
    );
  });
});
