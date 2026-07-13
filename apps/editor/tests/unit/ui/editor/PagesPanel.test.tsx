import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { PagesPanel } from '../../../../src/ui/editor/panels/PagesPanel';

describe('PagesPanel', () => {
  it('keeps the active page card in view as the active slide changes', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    const project = sampleProject.createSampleProject();
    project.pages.push({
      ...project.pages[0]!,
      id: 'page-2',
      name: 'Second Slide',
      elementIds: [],
    });

    const { rerender } = render(<PagesPanel activePageId="page-1" project={project} />);
    scrollIntoView.mockClear();

    rerender(<PagesPanel activePageId="page-2" project={project} />);

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
  });

  it('scales page previews from the full slide dimensions', () => {
    const project = sampleProject.createSampleProject();
    project.pages[0] = {
      ...project.pages[0]!,
      width: 2000,
      height: 1000,
      elementIds: ['text-title'],
    };
    project.elements['text-title'] = {
      id: 'text-title',
      type: 'text',
      text: 'Scaled preview text',
      fontSize: 100,
      fontFamily: 'Open Sans',
      fontWeight: 700,
      fill: '#ffffff',
      align: 'left',
      height: 200,
      locked: false,
      opacity: 1,
      rotation: 0,
      visible: true,
      width: 1000,
      x: 0,
      y: 0,
    };

    const { container } = render(<PagesPanel activePageId="page-1" project={project} />);

    const preview = screen.getByRole('button', { name: 'Select Slide 1' });
    expect(preview).toHaveStyle({ aspectRatio: '2000 / 1000' });
    const miniText = container.querySelector('.page-card-mini-text');
    expect(miniText).toHaveStyle({
      fontSize: '5cqw',
      overflow: 'visible',
      whiteSpace: 'pre-wrap',
    });
  });

  it('selects, adds, duplicates, hides, deletes, reorders, renames, and translates pages', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
    project.pages.push({
      ...project.pages[0]!,
      id: 'page-2',
      name: 'Second Slide',
      elementIds: [],
    });
    const handlers = {
      onAddPage: vi.fn(),
      onClose: vi.fn(),
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

    await user.click(screen.getByRole('button', { name: 'Close pages panel' }));
    expect(handlers.onClose).toHaveBeenCalledTimes(1);

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

    const dataTransfer = {
      dropEffect: '',
      effectAllowed: '',
      getData: vi.fn(() => 'page-1'),
      setData: vi.fn(),
    };
    const firstPageCard = screen.getByRole('article', { name: 'Page 1: Slide 1' });
    const secondPageCard = screen.getByRole('article', { name: 'Page 2: Second Slide' });
    vi.spyOn(secondPageCard, 'getBoundingClientRect').mockReturnValue({
      bottom: 40,
      height: 40,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.dragStart(firstPageCard, { dataTransfer });
    fireEvent.dragOver(secondPageCard, { dataTransfer, clientY: 39 });
    expect(secondPageCard).toHaveAttribute('data-drop-position', 'after');
    fireEvent.drop(secondPageCard, { dataTransfer, clientY: 39 });
    expect(dataTransfer.setData).toHaveBeenCalledWith('application/x-localstudio-page-id', 'page-1');
    expect(handlers.onReorderPage).toHaveBeenCalledWith('page-1', 1);

    await user.click(screen.getByRole('button', { name: 'Delete Slide 1' }));
    expect(handlers.onDeletePage).toHaveBeenCalledWith('page-1');

    await user.click(screen.getByRole('button', { name: 'Rename Slide 1' }));
    await user.clear(screen.getByLabelText('Page 1 title'));
    await user.type(screen.getByLabelText('Page 1 title'), 'Renamed page{Enter}');
    expect(handlers.onRenamePage).toHaveBeenCalledWith('page-1', 'Renamed page');

    expect(screen.getByRole('button', { name: 'Move Slide 1 up' })).toBeDisabled();
  });

  it('marks skipped pages and counts only active pages', () => {
    const project = sampleProject.createSampleProject();
    project.pages.push({
      ...project.pages[0]!,
      id: 'page-2',
      name: 'Skipped Slide',
      elementIds: [],
      visible: false,
    });

    render(<PagesPanel activePageId="page-1" project={project} />);

    expect(screen.getByText('1 active page')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Page 2: Skipped Slide (skipped)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Skipped Slide (skipped)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename Skipped Slide (skipped)' })).toHaveTextContent(
      'Skipped Slide (skipped)',
    );
    expect(screen.getByLabelText('Skipped slide')).toBeInTheDocument();
  });
});
