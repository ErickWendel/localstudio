import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { PageRail } from '../../../../src/ui/editor/PageRail';

describe('PageRail', () => {
  it('shows the active slide and an add-slide tile instead of inactive placeholders', async () => {
    const user = userEvent.setup();
    const onAddPage = vi.fn();

    render(
      <PageRail
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        onAddPage={onAddPage}
      />,
    );

    expect(screen.getByRole('button', { name: 'Slide 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Slide 2' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Page' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add slide' }));

    expect(onAddPage).toHaveBeenCalledTimes(1);
  });

  it('imports a local media file from disk', async () => {
    const user = userEvent.setup();
    const onImportImage = vi.fn();
    const file = new File(['image-bytes'], 'sample.png', { type: 'image/png' });

    render(
      <PageRail
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        onImportImage={onImportImage}
      />,
    );

    await user.upload(screen.getByLabelText('Import media file'), file);

    expect(onImportImage).toHaveBeenCalledWith(file);
  });
});
