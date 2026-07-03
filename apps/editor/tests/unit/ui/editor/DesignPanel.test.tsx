import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { ProjectDocument, ShapeElement } from '../../../../src/domain/documents/model';
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
});
