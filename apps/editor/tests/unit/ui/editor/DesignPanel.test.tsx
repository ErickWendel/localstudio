import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type {
  ProjectDocument,
  ShapeElement,
  TextElement,
} from '../../../../src/domain/documents/model';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { DesignPanel } from '../../../../src/ui/editor/panels/DesignPanel';

function createProjectWithSelectedShape(): ProjectDocument {
  const project = sampleProject.createSampleProject();
  const shape: ShapeElement = {
    id: 'shape-test',
    type: 'shape',
    shape: 'rect',
    x: 120,
    y: 160,
    width: 240,
    height: 180,
    rotation: 0,
    locked: false,
    visible: true,
    opacity: 1,
    fill: '#37FD76',
  };
  return {
    ...project,
    elements: {
      ...project.elements,
      [shape.id]: shape,
    },
    pages: project.pages.map((page) =>
      page.id === 'page-1' ? { ...page, elementIds: [...page.elementIds, shape.id] } : page,
    ),
  };
}

function createProjectWithSelectedLine(): ProjectDocument {
  const project = createProjectWithSelectedShape();
  const shape = project.elements['shape-test'];
  if (shape?.type !== 'shape') return project;
  const { fill, ...lineShape } = shape;
  void fill;
  return {
    ...project,
    elements: {
      ...project.elements,
      'shape-test': {
        ...lineShape,
        shape: 'line',
        stroke: '#37FD76',
        strokeWidth: 4,
      },
    },
  };
}

function createProjectWithSelectedText(): ProjectDocument {
  const project = sampleProject.createSampleProject();
  const text: TextElement = {
    id: 'text-test',
    type: 'text',
    text: 'Editable text',
    x: 120,
    y: 160,
    width: 360,
    height: 120,
    rotation: 0,
    locked: false,
    visible: true,
    opacity: 1,
    align: 'left',
    fill: '#ffffff',
    fontFamily: 'Open Sans',
    fontSize: 32,
    fontWeight: 400,
  };
  return {
    ...project,
    elements: {
      ...project.elements,
      [text.id]: text,
    },
    pages: project.pages.map((page) =>
      page.id === 'page-1' ? { ...page, elementIds: [...page.elementIds, text.id] } : page,
    ),
  };
}

function createProjectWithImportedTextFont(): ProjectDocument {
  const project = createProjectWithSelectedText();
  const text = project.elements['text-test'];
  if (text?.type !== 'text') return project;
  return {
    ...project,
    elements: {
      ...project.elements,
      [text.id]: {
        ...text,
        fontFamily: 'American Typewriter',
      },
    },
  };
}

function createProjectWithTemplates(): ProjectDocument {
  return {
    ...sampleProject.createSampleProject(),
    themeId: 'theme-studio',
    themeGallery: ['theme-studio'],
    themes: {
      'theme-imported': {
        id: 'theme-imported',
        name: 'Imported theme',
        palette: {
          accent: '#00AEEF',
          background: '#101820',
          mutedText: '#9AA6B2',
          surface: '#17212B',
          text: '#F7FAFC',
        },
        typography: {
          bodyFontFamily: 'Inter',
          headingFontFamily: 'Space Grotesk',
        },
      },
      'theme-studio': {
        id: 'theme-studio',
        name: 'Studio theme',
        palette: {
          accent: '#37FD76',
          background: '#050D10',
          mutedText: '#91999D',
          surface: '#0C1417',
          text: '#FFFFFF',
        },
        typography: {
          bodyFontFamily: 'Inter',
          headingFontFamily: 'Orbitron',
        },
      },
    },
    slideLayouts: {
      'layout-title': {
        id: 'layout-title',
        name: 'Title',
        background: { type: 'color', color: '#050D10' },
        elementIds: ['layout-title-text'],
        elements: {
          'layout-title-text': {
            id: 'layout-title-text',
            type: 'text',
            text: 'Presentation Title',
            x: 120,
            y: 140,
            width: 720,
            height: 120,
            rotation: 0,
            locked: false,
            visible: true,
            opacity: 1,
            fontFamily: 'Inter',
            fontSize: 44,
            fontWeight: 800,
            fill: '#050D10',
            align: 'left',
            placeholderRole: 'title',
            templateSource: { layoutId: 'layout-title', type: 'layout' },
          },
        },
        placeholderRoles: ['title'],
        placeholderVisibility: {
          body: true,
          footer: true,
          slideNumber: true,
          title: true,
        },
      },
      'layout-statement': {
        id: 'layout-statement',
        name: 'Statement',
        background: { type: 'color', color: '#050D10' },
        elementIds: ['layout-statement-text'],
        elements: {
          'layout-statement-text': {
            id: 'layout-statement-text',
            type: 'text',
            text: 'Statement',
            x: 520,
            y: 420,
            width: 480,
            height: 90,
            rotation: 0,
            locked: false,
            visible: true,
            opacity: 1,
            fontFamily: 'Inter',
            fontSize: 38,
            fontWeight: 800,
            fill: '#050D10',
            align: 'center',
            placeholderRole: 'title',
            templateSource: { layoutId: 'layout-statement', type: 'layout' },
          },
        },
        placeholderRoles: ['title', 'body'],
        placeholderVisibility: {
          body: true,
          footer: true,
          slideNumber: true,
          title: true,
        },
      },
    },
    pages: sampleProject.createSampleProject().pages.map((page) =>
      page.id === 'page-1' ? { ...page, layoutId: 'layout-statement' } : page,
    ),
  };
}

describe('DesignPanel', () => {
  it('shows presentation theme actions and applies imported themes', () => {
    const onApplyTheme = vi.fn();
    const onChangeTheme = vi.fn();
    const onEditTheme = vi.fn();

    render(
      <DesignPanel
        project={createProjectWithTemplates()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [], target: 'presentation' }}
        onApplyTheme={onApplyTheme}
        onChangeTheme={onChangeTheme}
        onEditTheme={onEditTheme}
      />,
    );

    expect(screen.getByText('Studio theme')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Change theme'));
    fireEvent.click(screen.getByText('Edit theme'));
    fireEvent.click(screen.getByText('Apply theme'));

    expect(onChangeTheme).toHaveBeenCalledOnce();
    expect(onEditTheme).toHaveBeenCalledWith('theme-studio');
    expect(onApplyTheme).toHaveBeenCalledWith('theme-studio');

    fireEvent.click(screen.getByLabelText('Open theme picker, current theme Studio theme'));

    fireEvent.click(screen.getByText('Imported theme'));

    expect(onApplyTheme).toHaveBeenCalledWith('theme-imported');
  });

  it('shows slide layout and background controls and applies the chosen layout', () => {
    const onApplySlideLayout = vi.fn();
    const onEditSlideLayout = vi.fn();
    const onToggleSlideLayoutPlaceholder = vi.fn();
    const onUpdatePageBackground = vi.fn();

    render(
      <DesignPanel
        project={createProjectWithTemplates()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [], target: 'slide' }}
        onApplySlideLayout={onApplySlideLayout}
        onEditSlideLayout={onEditSlideLayout}
        onToggleSlideLayoutPlaceholder={onToggleSlideLayoutPlaceholder}
        onUpdatePageBackground={onUpdatePageBackground}
      />,
    );

    expect(screen.getByText('Statement')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Edit layout'));
    fireEvent.click(screen.getByText('Apply layout'));
    fireEvent.click(screen.getByLabelText('Title'));
    fireEvent.change(screen.getByLabelText('Slide background color'), {
      target: { value: '#112233' },
    });

    expect(onEditSlideLayout).toHaveBeenCalledWith('layout-statement');
    expect(onApplySlideLayout).toHaveBeenCalledWith('page-1', 'layout-statement');
    expect(onToggleSlideLayoutPlaceholder).toHaveBeenCalledWith(
      'layout-statement',
      'title',
      false,
    );
    expect(onUpdatePageBackground).toHaveBeenCalledWith({ type: 'color', color: '#112233' });

    fireEvent.click(screen.getByLabelText('Open layout picker, current layout Statement'));

    expect(screen.queryByText('Presentation Title')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Title' }));

    expect(onApplySlideLayout).toHaveBeenCalledWith('page-1', 'layout-title');
  });

  it('updates selected shape fill and border modes', () => {
    const onUpdateElementStyle = vi.fn();

    render(
      <DesignPanel
        project={createProjectWithSelectedShape()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['shape-test'] }}
        onUpdateElementStyle={onUpdateElementStyle}
      />,
    );

    expect(screen.getByLabelText('Selected shape fill mode')).toHaveValue('color');
    fireEvent.change(screen.getByLabelText('Selected shape fill mode'), {
      target: { value: 'none' },
    });
    expect(onUpdateElementStyle).toHaveBeenCalledWith('shape-test', { fill: null });

    expect(screen.getByLabelText('Selected shape border mode')).toHaveValue('none');
    fireEvent.change(screen.getByLabelText('Selected shape border mode'), {
      target: { value: 'color' },
    });
    expect(onUpdateElementStyle).toHaveBeenCalledWith('shape-test', {
      stroke: '#37FD76',
      strokeWidth: 2,
    });
  });

  it('updates selected line endpoint styles', () => {
    const onUpdateElementStyle = vi.fn();

    render(
      <DesignPanel
        project={createProjectWithSelectedLine()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['shape-test'] }}
        onUpdateElementStyle={onUpdateElementStyle}
      />,
    );

    fireEvent.change(screen.getByLabelText('Selected shape start endpoint'), {
      target: { value: 'circle' },
    });
    fireEvent.change(screen.getByLabelText('Selected shape end endpoint'), {
      target: { value: 'open-arrow' },
    });

    expect(onUpdateElementStyle).toHaveBeenCalledWith('shape-test', {
      startEndpoint: 'circle',
    });
    expect(onUpdateElementStyle).toHaveBeenCalledWith('shape-test', {
      endEndpoint: 'open-arrow',
    });
  });

  it('lets users expand search results and download a Google font for selected text', () => {
    const onDownloadFont = vi.fn(() => new Promise<void>(() => undefined));

    render(
      <DesignPanel
        project={createProjectWithSelectedText()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-test'] }}
        availableFonts={[
          { family: 'Arimo', aliases: ['Arial'], source: 'google-fonts' },
          { family: 'Montserrat', source: 'google-fonts' },
          { family: 'Noto Sans KR', source: 'google-fonts' },
        ]}
        onDownloadFont={onDownloadFont}
      />,
    );

    expect(screen.queryByLabelText('Search downloadable fonts')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Selected text font'));
    fireEvent.change(screen.getByLabelText('Search downloadable fonts'), {
      target: { value: 'mont' },
    });
    expect(screen.getByLabelText('Downloadable font results')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Download Montserrat' }));

    expect(onDownloadFont).toHaveBeenCalledWith('Montserrat');
  });

  it('adds a selected local font from the configured font folder before applying it', async () => {
    const onImportLocalFont = vi.fn(() => Promise.resolve());
    const onUpdateElementStyle = vi.fn();

    render(
      <DesignPanel
        project={createProjectWithSelectedText()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-test'] }}
        localFonts={[{ family: 'Acme Sans', source: 'local-font-folder' }]}
        onImportLocalFont={onImportLocalFont}
        onUpdateElementStyle={onUpdateElementStyle}
      />,
    );

    fireEvent.click(screen.getByLabelText('Selected text font'));
    fireEvent.change(screen.getByLabelText('Search downloadable fonts'), {
      target: { value: 'Acme' },
    });
    const localFontResult = screen.getByRole('button', { name: 'Add Acme Sans from local fonts' });
    expect(localFontResult.querySelector('.ew-ellipsis')).toHaveStyle({ fontFamily: 'Acme Sans' });
    fireEvent.click(localFontResult);

    await waitFor(() => {
      expect(onImportLocalFont).toHaveBeenCalledWith('Acme Sans');
    });
    expect(onUpdateElementStyle).not.toHaveBeenCalledWith('text-test', {
      fontFamily: 'Acme Sans',
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Add Acme Sans from local fonts' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Acme Sans added to mirrored fonts');
  });

  it('finds Google font alternatives by system font aliases', () => {
    render(
      <DesignPanel
        project={createProjectWithSelectedText()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-test'] }}
        availableFonts={[
          { family: 'Arimo', aliases: ['Arial'], source: 'google-fonts' },
          { family: 'Montserrat', source: 'google-fonts' },
        ]}
      />,
    );

    fireEvent.click(screen.getByLabelText('Selected text font'));
    fireEvent.change(screen.getByLabelText('Search downloadable fonts'), {
      target: { value: 'aria' },
    });

    expect(screen.getByRole('button', { name: 'Download Arimo' })).toBeInTheDocument();
    expect(screen.queryByText('No Google Fonts match that search.')).not.toBeInTheDocument();
  });

  it('shows selected text style controls and text content editing in the expected tabs', () => {
    const onUpdateTextContent = vi.fn();

    render(
      <DesignPanel
        project={createProjectWithSelectedText()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-test'] }}
        onUpdateTextContent={onUpdateTextContent}
      />,
    );

    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
    expect(headings).toContain('Typography');
    expect(headings).toContain('Selection');
    expect(headings.indexOf('Typography')).toBeLessThan(headings.indexOf('Selection'));

    expect(screen.getAllByLabelText('Selected text font')).toHaveLength(1);

    fireEvent.click(screen.getByRole('tab', { name: 'Text' }));

    expect(screen.queryByLabelText('Selected text font')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Selected text font size')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Selected text font weight')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Selected text color')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Selected text alignment')).not.toBeInTheDocument();

    const textContent = screen.getByLabelText('Selected text content');
    expect(textContent).toHaveValue('Editable text');

    fireEvent.change(textContent, { target: { value: 'Updated copy' } });

    expect(onUpdateTextContent).toHaveBeenLastCalledWith('text-test', 'Updated copy');
  });

  it('includes the selected imported font in the font dropdown options', () => {
    render(
      <DesignPanel
        project={createProjectWithImportedTextFont()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-test'] }}
      />,
    );

    expect(screen.getByLabelText('Selected text font')).toHaveTextContent('American Typewriter');
    fireEvent.click(screen.getByLabelText('Selected text font'));
    expect(screen.getByRole('button', { name: 'Apply American Typewriter' })).toBeInTheDocument();
  });

  it('focuses the selected text font list when requested', async () => {
    render(
      <DesignPanel
        project={createProjectWithSelectedText()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-test'] }}
        focusFontControlKey={1}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Selected text font')).toHaveFocus();
    });
  });
});
