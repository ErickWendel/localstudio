import { render, screen, waitFor } from '@testing-library/react';
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

describe('DesignPanel', () => {
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

  it('shows font controls before selection controls for selected text', () => {
    render(
      <DesignPanel
        project={createProjectWithSelectedText()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-test'] }}
      />,
    );

    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
    expect(headings.indexOf('Font')).toBeLessThan(headings.indexOf('Selection'));
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
