import { describe, expect, it } from 'vitest';
import type { ProjectDocument } from '../../../../src/domain/documents/model';
import { pageElementResolver } from '../../../../src/domain/documents/pageElementResolver';
import { editorViewModelProject } from '../../../../src/ui/editor/state/editorViewModelProject';

function createLegacyLayoutProject(): ProjectDocument {
  return {
    assets: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    elements: {},
    id: 'legacy-layout-project',
    name: 'Legacy layout project',
    pages: [
      {
        background: { color: '#000000', type: 'color' },
        elementIds: [],
        height: 1080,
        id: 'page-1',
        layoutId: 'layout-1',
        name: 'Slide 1',
        width: 1920,
      },
    ],
    slideLayouts: {
      'layout-1': {
        background: { color: '#000000', type: 'color' },
        elementIds: ['layout-header'],
        elements: {
          'layout-header': {
            align: 'left',
            fill: '#FFFFFF',
            fontFamily: 'Arial',
            fontSize: 48,
            fontWeight: 700,
            height: 80,
            id: 'layout-header',
            locked: false,
            opacity: 1,
            rotation: 0,
            text: 'Header',
            type: 'text',
            visible: true,
            width: 600,
            x: 40,
            y: 40,
          },
        },
        id: 'layout-1',
        name: 'Legacy layout',
        placeholderRoles: [],
        placeholderVisibility: {
          body: true,
          footer: true,
          slideNumber: true,
          title: true,
        },
      },
    },
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('editorViewModelProject', () => {
  it('materializes legacy layout elements as editable page elements once', () => {
    const legacyProject = createLegacyLayoutProject();
    const normalizedProject = editorViewModelProject.normalizeProjectDocument(legacyProject);
    const normalizedAgain = editorViewModelProject.normalizeProjectDocument(normalizedProject);
    const materializedElement = normalizedProject.elements['page-1-layout-layout-header'];

    expect(normalizedProject.pages[0]?.elementIds).toEqual(['page-1-layout-layout-header']);
    expect(materializedElement).toMatchObject({
      id: 'page-1-layout-layout-header',
      locked: false,
      text: 'Header',
      type: 'text',
    });
    expect(materializedElement).not.toHaveProperty('templateSource');
    expect(normalizedAgain.pages[0]?.elementIds).toEqual(['page-1-layout-layout-header']);
    expect(normalizedProject.slideLayouts?.['layout-1']?.elements['layout-header']).toBeDefined();
    expect(
      pageElementResolver.getLayoutElements(normalizedProject, normalizedProject.pages[0]!),
    ).toEqual([]);
    expect(
      pageElementResolver.getVisibleElements(normalizedProject, normalizedProject.pages[0]!),
    ).toHaveLength(1);
  });
});
