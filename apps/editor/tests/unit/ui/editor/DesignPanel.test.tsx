import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('shows presentation theme actions when the presentation is selected', async () => {
    const user = userEvent.setup();
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
    await user.click(screen.getByRole('button', { name: 'Change theme' }));
    await user.click(screen.getByRole('button', { name: 'Edit theme' }));
    await user.click(screen.getByRole('button', { name: 'Apply theme' }));

    expect(onChangeTheme).toHaveBeenCalledOnce();
    expect(onEditTheme).toHaveBeenCalledWith('theme-studio');
    expect(onApplyTheme).toHaveBeenCalledWith('theme-studio');
  });

  it('opens a theme picker from the theme preview with default and imported themes', async () => {
    const user = userEvent.setup();
    const onApplyTheme = vi.fn();

    render(
      <DesignPanel
        project={createProjectWithTemplates()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [], target: 'presentation' }}
        onApplyTheme={onApplyTheme}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Open theme picker, current theme Studio theme' }),
    );

    expect(screen.getByRole('region', { name: 'Choose a theme' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Default theme/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Imported theme/ }));

    expect(onApplyTheme).toHaveBeenCalledWith('theme-imported');
  });

  it('shows slide layout and background controls when the slide background is selected', async () => {
    const user = userEvent.setup();
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
    await user.click(screen.getByRole('button', { name: 'Edit layout' }));
    await user.click(screen.getByRole('button', { name: 'Apply layout' }));
    await user.click(screen.getByLabelText('Title'));
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
  });

  it('opens a slide layout picker from the layout preview and applies the chosen layout', async () => {
    const user = userEvent.setup();
    const onApplySlideLayout = vi.fn();

    render(
      <DesignPanel
        project={createProjectWithTemplates()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [], target: 'slide' }}
        onApplySlideLayout={onApplySlideLayout}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Open layout picker, current layout Statement' }),
    );

    expect(screen.getByRole('region', { name: 'Choose a layout' })).toBeInTheDocument();
    expect(screen.queryByText('Presentation Title')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Title' }));

    expect(onApplySlideLayout).toHaveBeenCalledWith('page-1', 'layout-title');
  });

  it('updates selected shape fill and border modes', async () => {
    const user = userEvent.setup();
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
    await user.selectOptions(screen.getByLabelText('Selected shape fill mode'), 'none');
    expect(onUpdateElementStyle).toHaveBeenCalledWith('shape-test', { fill: null });

    expect(screen.getByLabelText('Selected shape border mode')).toHaveValue('none');
    await user.selectOptions(screen.getByLabelText('Selected shape border mode'), 'color');
    expect(onUpdateElementStyle).toHaveBeenCalledWith('shape-test', {
      stroke: '#37FD76',
      strokeWidth: 2,
    });
  });

  it('updates selected line endpoint styles', async () => {
    const user = userEvent.setup();
    const onUpdateElementStyle = vi.fn();

    render(
      <DesignPanel
        project={createProjectWithSelectedLine()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['shape-test'] }}
        onUpdateElementStyle={onUpdateElementStyle}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Selected shape start endpoint'), 'circle');
    await user.selectOptions(screen.getByLabelText('Selected shape end endpoint'), 'open-arrow');

    expect(onUpdateElementStyle).toHaveBeenCalledWith('shape-test', {
      startEndpoint: 'circle',
    });
    expect(onUpdateElementStyle).toHaveBeenCalledWith('shape-test', {
      endEndpoint: 'open-arrow',
    });
  });

  it('lets users expand search results and download a Google font for selected text', async () => {
    const user = userEvent.setup();
    const onDownloadFont = vi.fn(() => Promise.resolve());

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

    await user.click(screen.getByRole('button', { name: 'Download additional font' }));
    await user.type(screen.getByLabelText('Search downloadable fonts'), 'mont');
    await user.click(screen.getByRole('button', { name: 'Search fonts' }));
    expect(screen.getByLabelText('Downloadable font results')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Download Montserrat' }));

    expect(onDownloadFont).toHaveBeenCalledWith('Montserrat');
  });

  it('finds Google font alternatives by system font aliases', async () => {
    const user = userEvent.setup();

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

    await user.click(screen.getByRole('button', { name: 'Download additional font' }));
    await user.type(screen.getByLabelText('Search downloadable fonts'), 'aria');

    expect(screen.getByRole('button', { name: 'Download Arimo' })).toBeInTheDocument();
    expect(screen.queryByText('No Google Fonts match that search.')).not.toBeInTheDocument();
  });

  it('shows typography controls before selection controls for selected text styles', () => {
    render(
      <DesignPanel
        project={createProjectWithSelectedText()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-test'] }}
      />,
    );

    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
    expect(headings).toContain('Typography');
    expect(headings).toContain('Selection');
    expect(headings.indexOf('Typography')).toBeLessThan(headings.indexOf('Selection'));
  });

  it('includes the selected imported font in the font dropdown options', () => {
    render(
      <DesignPanel
        project={createProjectWithImportedTextFont()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-test'] }}
      />,
    );

    expect(screen.getByLabelText('Selected text font')).toHaveValue('American Typewriter');
    expect(screen.getByRole('option', { name: 'American Typewriter' })).toBeInTheDocument();
  });

  it('keeps selected text style controls in the Style tab only', async () => {
    const user = userEvent.setup();

    render(
      <DesignPanel
        project={createProjectWithSelectedText()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-test'] }}
      />,
    );

    expect(screen.getAllByLabelText('Selected text font')).toHaveLength(1);

    await user.click(screen.getByRole('tab', { name: 'Text' }));

    expect(screen.queryByLabelText('Selected text font')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Selected text font size')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Selected text font weight')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Selected text color')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Selected text alignment')).not.toBeInTheDocument();
  });

  it('shows selected text content editing in the Text tab', async () => {
    const user = userEvent.setup();
    const onUpdateTextContent = vi.fn();

    render(
      <DesignPanel
        project={createProjectWithSelectedText()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-test'] }}
        onUpdateTextContent={onUpdateTextContent}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Text' }));

    const textContent = screen.getByLabelText('Selected text content');
    expect(textContent).toHaveValue('Editable text');

    fireEvent.change(textContent, { target: { value: 'Updated copy' } });

    expect(onUpdateTextContent).toHaveBeenLastCalledWith('text-test', 'Updated copy');
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
