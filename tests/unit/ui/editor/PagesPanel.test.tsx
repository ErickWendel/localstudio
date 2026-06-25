import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createSampleProject } from '../../../../src/domain/sampleProject';
import { PagesPanel } from '../../../../src/ui/editor/PagesPanel';

describe('PagesPanel', () => {
  it('selects, adds, duplicates, hides, deletes, reorders, renames, and translates pages', async () => {
    const user = userEvent.setup();
    const project = createSampleProject();
    project.pages.push({
      ...project.pages[0]!,
      id: 'page-2',
      name: 'Second Slide',
      elementIds: [],
    });
    const handlers = {
      onAddPage: vi.fn(),
      onDeletePage: vi.fn(),
      onDuplicatePage: vi.fn(),
      onRenamePage: vi.fn(),
      onReorderPage: vi.fn(),
      onSelectPage: vi.fn(),
      onSetPageVisibility: vi.fn(),
      onTranslatePage: vi.fn(),
    };

    render(<PagesPanel activePageId="page-1" canTranslate project={project} {...handlers} />);

    await user.click(screen.getByRole('button', { name: 'Add page' }));
    expect(handlers.onAddPage).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Select Slide 1' }));
    expect(handlers.onSelectPage).toHaveBeenCalledWith('page-1');

    await user.click(screen.getByRole('button', { name: 'Duplicate Slide 1' }));
    expect(handlers.onDuplicatePage).toHaveBeenCalledWith('page-1');

    await user.click(screen.getByRole('button', { name: 'Hide Slide 1' }));
    expect(handlers.onSetPageVisibility).toHaveBeenCalledWith('page-1', false);

    await user.click(screen.getByRole('button', { name: 'Translate Slide 1' }));
    expect(handlers.onTranslatePage).toHaveBeenCalledWith('page-1');

    await user.click(screen.getByRole('button', { name: 'Move Slide 1 down' }));
    expect(handlers.onReorderPage).toHaveBeenCalledWith('page-1', 1);

    await user.click(screen.getByRole('button', { name: 'Delete Slide 1' }));
    expect(handlers.onDeletePage).toHaveBeenCalledWith('page-1');

    await user.click(screen.getByRole('button', { name: 'Rename Slide 1' }));
    await user.clear(screen.getByLabelText('Page 1 title'));
    await user.type(screen.getByLabelText('Page 1 title'), 'Renamed page{Enter}');
    expect(handlers.onRenamePage).toHaveBeenCalledWith('page-1', 'Renamed page');

    expect(screen.getByRole('button', { name: 'Move Slide 1 up' })).toBeDisabled();
  });
});
