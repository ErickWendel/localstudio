import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createSampleProject } from '../../../../src/domain/sampleProject';
import { ScrollingCanvasWorkspace } from '../../../../src/ui/editor/ScrollingCanvasWorkspace';

describe('ScrollingCanvasWorkspace', () => {
  it('activates placeholder pages and exposes page header actions', async () => {
    const user = userEvent.setup();
    const project = createSampleProject();
    project.pages.push({
      ...project.pages[0]!,
      id: 'page-2',
      name: 'Second Slide',
      elementIds: [],
    });
    const handlers = {
      onActivePageFromScroll: vi.fn(),
      onAddPage: vi.fn(),
      onDeletePage: vi.fn(),
      onDuplicatePage: vi.fn(),
      onReorderPage: vi.fn(),
      onSetPageVisibility: vi.fn(),
      onTranslatePage: vi.fn(),
    };

    render(
      <ScrollingCanvasWorkspace
        activePageId="page-1"
        project={project}
        selection={{ pageId: 'page-1', elementIds: [] }}
        {...handlers}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Activate Second Slide' }));
    expect(handlers.onActivePageFromScroll).toHaveBeenCalledWith('page-2');

    await user.click(screen.getByRole('button', { name: 'Move Slide 1 down' }));
    expect(handlers.onReorderPage).toHaveBeenCalledWith('page-1', 1);

    await user.click(screen.getByRole('button', { name: 'Duplicate Slide 1' }));
    expect(handlers.onDuplicatePage).toHaveBeenCalledWith('page-1');

    await user.click(screen.getByRole('button', { name: 'Hide Slide 1' }));
    expect(handlers.onSetPageVisibility).toHaveBeenCalledWith('page-1', false);

    await user.click(screen.getByRole('button', { name: 'Delete Slide 1' }));
    expect(handlers.onDeletePage).toHaveBeenCalledWith('page-1');

    await user.click(screen.getAllByRole('button', { name: 'Add page' })[0]!);
    expect(handlers.onAddPage).toHaveBeenCalledTimes(1);
  });
});
