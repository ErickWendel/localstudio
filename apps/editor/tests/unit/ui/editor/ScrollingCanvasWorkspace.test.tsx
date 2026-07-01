import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { ScrollingCanvasWorkspace } from '../../../../src/ui/editor/ScrollingCanvasWorkspace';

describe('ScrollingCanvasWorkspace', () => {
  it('scrolls the active slide into view after active page changes', () => {
    const project = sampleProject.createSampleProject();
    project.pages.push({
      ...project.pages[0]!,
      id: 'page-2',
      name: 'Second Slide',
      elementIds: [],
    });
    const scrollIntoView = vi.fn();
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    const { rerender } = render(
      <ScrollingCanvasWorkspace
        activePageId="page-1"
        project={project}
        selection={{ pageId: 'page-1', elementIds: [] }}
      />,
    );

    scrollIntoView.mockClear();
    rerender(
      <ScrollingCanvasWorkspace
        activePageId="page-2"
        project={project}
        selection={{ pageId: 'page-2', elementIds: [] }}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
  });

  it('activates placeholder pages and exposes page header actions', async () => {
    const user = userEvent.setup();
    const project = sampleProject.createSampleProject();
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
    expect(handlers.onAddPage).toHaveBeenCalledWith('page-1');

    await user.click(screen.getByRole('button', { name: 'Add page after Second Slide' }));
    expect(handlers.onAddPage).toHaveBeenCalledWith('page-2');
  });

  it('keeps text editing controls in the sticky slide toolbar and wires translation', async () => {
    const user = userEvent.setup();
    const onTranslateSelectedText = vi.fn();
    const onUpdateElementStyle = vi.fn();

    render(
      <ScrollingCanvasWorkspace
        activePageId="page-1"
        project={sampleProject.createSampleProject()}
        selection={{ pageId: 'page-1', elementIds: ['text-subtitle'] }}
        canTranslateSelection
        onTranslateSelectedText={onTranslateSelectedText}
        onUpdateElementStyle={onUpdateElementStyle}
      />,
    );

    expect(screen.getByTestId('sticky-text-selection-toolbar')).toContainElement(
      screen.getByRole('toolbar', { name: 'Text editing controls' }),
    );

    await user.click(screen.getByRole('button', { name: 'Translate Selected Text' }));
    expect(onTranslateSelectedText).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Align text left' }));
    expect(onUpdateElementStyle).toHaveBeenCalledWith('text-subtitle', { align: 'left' });
  });
});
