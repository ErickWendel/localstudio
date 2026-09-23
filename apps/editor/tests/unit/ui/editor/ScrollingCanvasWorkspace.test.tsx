import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { ScrollingCanvasWorkspace } from '../../../../src/ui/editor/canvas/ScrollingCanvasWorkspace';

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

  it('does not scroll when the active slide visibility changes', () => {
    const project = sampleProject.createSampleProject();
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
        activePageId="page-1"
        project={{
          ...project,
          pages: [{ ...project.pages[0]!, visible: false }],
        }}
        selection={{ pageId: 'page-1', elementIds: [] }}
      />,
    );

    expect(scrollIntoView).not.toHaveBeenCalled();
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
    project.pages.push({
      ...project.pages[0]!,
      id: 'page-3',
      name: 'Third Slide',
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

    const { container } = render(
      <ScrollingCanvasWorkspace
        activePageId="page-1"
        project={project}
        selection={{ pageId: 'page-1', elementIds: [] }}
        {...handlers}
      />,
    );

    expect(container.querySelectorAll('.canvas-frame')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Activate Second Slide' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Activate Third Slide' }));
    expect(handlers.onActivePageFromScroll).toHaveBeenCalledWith('page-3');

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

  it('disables slide copy until the project is stored locally and offers save now', async () => {
    const user = userEvent.setup();
    const onCopyPage = vi.fn();
    const onSaveLocalProject = vi.fn();
    const hint =
      'Store this project locally before copying slides. Unsaved assets can paste empty in another tab.';

    render(
      <ScrollingCanvasWorkspace
        activePageId="page-1"
        canCopyPages={false}
        project={sampleProject.createSampleProject()}
        selection={{ pageId: 'page-1', elementIds: [] }}
        onCopyPage={onCopyPage}
        onSaveLocalProject={onSaveLocalProject}
      />,
    );

    const copyButton = screen.getByRole('button', { name: 'Copy Slide 1 to clipboard' });
    expect(copyButton).toBeDisabled();
    expect(copyButton).toHaveAttribute('title', hint);
    expect(screen.getByText(hint)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save now' }));
    expect(onSaveLocalProject).toHaveBeenCalledTimes(1);
    expect(onCopyPage).not.toHaveBeenCalled();
  });

  it('keeps text editing controls in the sticky slide toolbar and wires translation', async () => {
    const user = userEvent.setup();
    const onOpenAnimations = vi.fn();
    const onOpenFontPanel = vi.fn();
    const onTranslateSelectedText = vi.fn();
    const onUpdateElementStyle = vi.fn();
    const onAlignSelectedElement = vi.fn();

    render(
      <ScrollingCanvasWorkspace
        activePageId="page-1"
        project={sampleProject.createSampleProject()}
        selection={{ pageId: 'page-1', elementIds: ['text-subtitle'] }}
        canTranslateSelection
        onOpenAnimations={onOpenAnimations}
        onOpenFontPanel={onOpenFontPanel}
        onAlignSelectedElement={onAlignSelectedElement}
        onTranslateSelectedText={onTranslateSelectedText}
        onUpdateElementStyle={onUpdateElementStyle}
      />,
    );

    expect(screen.getByTestId('sticky-text-selection-toolbar')).toContainElement(
      screen.getByRole('toolbar', { name: 'Text editing controls' }),
    );

    await user.click(
      within(screen.getByTestId('sticky-text-selection-toolbar')).getByRole('button', {
        name: 'Text font family',
      }),
    );
    expect(onOpenFontPanel).toHaveBeenCalledTimes(1);
    expect(
      onUpdateElementStyle.mock.calls.some(
        ([elementId, patch]) => elementId === 'text-subtitle' && 'fontFamily' in patch,
      ),
    ).toBe(false);

    await user.click(
      within(screen.getByTestId('sticky-text-selection-toolbar')).getByRole('button', {
        name: 'Animate',
      }),
    );
    expect(onOpenAnimations).toHaveBeenCalledTimes(1);

    await user.click(
      within(screen.getByTestId('sticky-text-selection-toolbar')).getByRole('button', {
        name: 'Translate Selected Text',
      }),
    );
    expect(onTranslateSelectedText).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Text alignment menu' }));
    expect(screen.getByRole('menu', { name: 'Text alignment' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Align text left' }));
    expect(onUpdateElementStyle).toHaveBeenCalledWith('text-subtitle', { align: 'left' });

    await user.click(screen.getByRole('button', { name: 'Text alignment menu' }));
    await user.click(screen.getByRole('button', { name: 'Center left' }));
    expect(onAlignSelectedElement).toHaveBeenCalledWith('page-left-center');

    await user.click(screen.getByRole('button', { name: 'Edit text hyperlink' }));
    await user.clear(screen.getByRole('textbox', { name: 'Text hyperlink URL' }));
    await user.type(screen.getByRole('textbox', { name: 'Text hyperlink URL' }), 'localstudio.dev');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onUpdateElementStyle).toHaveBeenCalledWith('text-subtitle', {
      hyperlink: 'https://localstudio.dev',
    });
  });

  it('shows selected inline text color in the sticky toolbar', () => {
    const project = sampleProject.createSampleProject();
    const title = project.elements['text-title'];
    if (!title || title.type !== 'text') {
      throw new Error('Expected text-title to be a text element');
    }
    const onUpdateElementStyle = vi.fn();

    render(
      <ScrollingCanvasWorkspace
        activePageId="page-1"
        project={{
          ...project,
          elements: {
            ...project.elements,
            'text-title': {
              ...title,
              colorRanges: [{ start: 3, end: 9, fill: '#123456' }],
            },
          },
        }}
        selection={{ pageId: 'page-1', elementIds: ['text-title'] }}
        activeTextSelection={{ elementId: 'text-title', start: 3, end: 9 }}
        onUpdateElementStyle={onUpdateElementStyle}
      />,
    );

    const colorInput = screen.getByLabelText('Text color');
    expect(colorInput).toHaveValue('#123456');
  });

  it('copies text format and pastes it across a multi-text selection', async () => {
    const user = userEvent.setup();
    const onUpdateElementStyles = vi.fn();
    const onApplyFormat = vi.fn();
    const { rerender } = render(
      <ScrollingCanvasWorkspace
        activePageId="page-1"
        project={sampleProject.createSampleProject()}
        selection={{ pageId: 'page-1', elementIds: ['text-title'] }}
        onUpdateElementStyles={onUpdateElementStyles}
        onApplyFormat={onApplyFormat}
      />,
    );

    const toolbar = screen.getByRole('toolbar', { name: 'Text editing controls' });
    const formatButton = within(toolbar).getByRole('button', { name: 'Copy format' });
    expect(formatButton).toHaveAttribute('title', 'Copy format');
    await user.click(formatButton);

    rerender(
      <ScrollingCanvasWorkspace
        activePageId="page-1"
        project={sampleProject.createSampleProject()}
        selection={{ pageId: 'page-1', elementIds: ['text-title', 'text-subtitle'] }}
        onUpdateElementStyles={onUpdateElementStyles}
        onApplyFormat={onApplyFormat}
      />,
    );

    const pasteButton = within(screen.getByRole('toolbar', { name: 'Text editing controls' })).getByRole(
      'button',
      { name: 'Paste format' },
    );
    expect(pasteButton).toHaveAttribute('title', 'Paste format');
    await user.click(pasteButton);

    expect(onApplyFormat).toHaveBeenCalledWith(
      ['text-title', 'text-subtitle'],
      expect.objectContaining({
        fontFamily: 'Orbitron',
        fontSize: 96,
        fontWeight: 800,
      }),
    );
    expect(
      within(screen.getByRole('toolbar', { name: 'Text editing controls' })).getByRole('button', {
        name: 'Copy format',
      }),
    ).toBeInTheDocument();
  });
});
