import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createSampleProject } from '../../../../src/domain/sampleProject';
import { PageRail } from '../../../../src/ui/editor/PageRail';

describe('PageRail', () => {
  it('imports a local image file from disk', async () => {
    const user = userEvent.setup();
    const onImportImage = vi.fn();
    const file = new File(['image-bytes'], 'sample.png', { type: 'image/png' });

    render(
      <PageRail
        project={createSampleProject()}
        activePageId="page-1"
        onImportImage={onImportImage}
      />,
    );

    await user.upload(screen.getByLabelText('Import image file'), file);

    expect(onImportImage).toHaveBeenCalledWith(file);
  });
});
