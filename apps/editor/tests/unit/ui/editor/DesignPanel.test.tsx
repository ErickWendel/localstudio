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
  const project = sampleProject.createSampleProject();
  const statementTitle: TextElement = {
    id: 'layout-statement-title',
    type: 'text',
    text: 'Statement Title',
    x: 220,
    y: 420,
    width: 1480,
    height: 120,
    rotation: 0,
    locked: true,
    visible: true,
    opacity: 1,
    align: 'center',
    fill: '#FFFFFF',
    fontFamily: 'Orbitron',
    fontSize: 72,
    fontWeight: 800,
  };
  const mediaTitle: TextElement = {
    id: 'layout-media-title',
    type: 'text',
    text: 'Media Title',
    x: 180,
    y: 180,
    width: 760,
    height: 100,
    rotation: 0,
    locked: true,
    visible: true,
    opacity: 1,
    align: 'left',
    fill: '#FFFFFF',
    fontFamily: 'Open Sans',
    fontSize: 54,
    fontWeight: 800,
  };
  const mediaBlock: ShapeElement = {
    id: 'layout-media-block',
    type: 'shape',
    shape: 'rect',
    x: 1080,
    y: 160,
    width: 620,
    height: 760,
    rotation: 0,
    locked: true,
    visible: true,
    opacity: 1,
    fill: '#36D7FF',
  };
  return {
    ...project,
    themeId: 'theme-localstudio',
    themeGallery: ['theme-localstudio', 'theme-ice'],
    themes: {
      'theme-localstudio': {
        id: 'theme-localstudio',
        name: 'LocalStudio',
        palette: {
          background: '#050D10',
          text: '#FFFFFF',
          primary: '#37FD76',
          secondary: '#36D7FF',
          muted: '#91999D',
        },
        typography: {
          bodyFontFamily: 'Open Sans',
          displayFontFamily: 'Orbitron',
        },
        preview: { background: '#050D10', accents: ['#37FD76', '#36D7FF'] },
        source: 'custom',
      },
      'theme-ice': {
        id: 'theme-ice',
        name: 'Ice Room',
        palette: {
          background: '#EAF6FF',
          text: '#061319',
          primary: '#00779A',
          secondary: '#37FD76',
          muted: '#52636A',
        },
        typography: {
          bodyFontFamily: 'Open Sans',
          displayFontFamily: 'Orbitron',
        },
        preview: { background: '#EAF6FF', accents: ['#00779A', '#37FD76'] },
        source: 'custom',
      },
    },
    slideLayouts: {
      'layout-statement': {
        id: 'layout-statement',
        themeId: 'theme-localstudio',
        name: 'Statement',
        background: { type: 'color', color: '#050D10' },
        placeholderRoles: ['title', 'body'],
        elements: [statementTitle],
        preview: { background: '#050D10', accents: ['#37FD76'] },
      },
      'layout-media': {
        id: 'layout-media',
        themeId: 'theme-localstudio',
        name: 'Media split',
        background: { type: 'color', color: '#101B12' },
        placeholderRoles: ['title', 'media'],
        elements: [mediaTitle, mediaBlock],
        preview: { background: '#101B12', accents: ['#36D7FF'] },
      },
    },
    pages: project.pages.map((page) =>
      page.id === 'page-1' ? { ...page, layoutId: 'layout-statement' } : page,
    ),
  };
}

describe('DesignPanel', () => {
  it('shows presentation theme controls and opens the theme gallery', async () => {
    const user = userEvent.setup();
    const onChangeTheme = vi.fn();
    const onApplyTheme = vi.fn();
    const onEditTheme = vi.fn();

    render(
      <DesignPanel
        project={createProjectWithTemplates()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [], target: 'presentation' }}
        onChangeTheme={onChangeTheme}
        onApplyTheme={onApplyTheme}
        onEditTheme={onEditTheme}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByText('LocalStudio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change Theme' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change Theme' }));

    expect(onChangeTheme).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region', { name: 'Theme gallery' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose Ice Room theme' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit theme' }));
    await user.click(screen.getByRole('button', { name: 'Apply Theme' }));

    expect(onEditTheme).toHaveBeenCalledWith('theme-localstudio');
    expect(onApplyTheme).toHaveBeenCalledWith('theme-localstudio');
  });

  it('shows slide layout and background controls for slide selection', async () => {
    const user = userEvent.setup();
    const onApplySlideLayout = vi.fn();
    const onEditSlideLayout = vi.fn();
    const onUpdatePageBackground = vi.fn();

    render(
      <DesignPanel
        project={createProjectWithTemplates()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: [], target: 'slide' }}
        onApplySlideLayout={onApplySlideLayout}
        onEditSlideLayout={onEditSlideLayout}
        onUpdatePageBackground={onUpdatePageBackground}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Slide' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Slide layout: Statement' })).toBeInTheDocument();
    expect(screen.getByLabelText('Slide title placeholder')).toBeChecked();
    expect(screen.getByLabelText('Slide body placeholder')).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Slide layout: Statement' }));
    expect(screen.getByRole('region', { name: 'Slide layout gallery' })).toBeInTheDocument();
    expect(screen.getAllByText('Statement Title')).toHaveLength(2);
    expect(screen.getByText('Media Title')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Media split/ }));
    expect(onApplySlideLayout).toHaveBeenCalledWith('page-1', 'layout-media');

    await user.click(screen.getByRole('button', { name: 'Edit Slide Layout' }));
    expect(onEditSlideLayout).toHaveBeenCalledWith('layout-statement');

    fireEvent.change(screen.getByLabelText('Slide background color'), {
      target: { value: '#123456' },
    });
    expect(onUpdatePageBackground).toHaveBeenCalledWith({ type: 'color', color: '#123456' });
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
