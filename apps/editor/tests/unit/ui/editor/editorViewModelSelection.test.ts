import { describe, expect, it } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { editorViewModelSelection } from '../../../../src/ui/editor/state/editorViewModelSelection';

describe('editor view model selection helpers', () => {
  it('derives slide or element target from selected element ids', () => {
    expect(editorViewModelSelection.getSelectionTargetForElements([])).toBe('slide');
    expect(editorViewModelSelection.getSelectionTargetForElements(['text-title'])).toBe('elements');
  });

  it('replaces or toggles element selection based on additive mode', () => {
    expect(
      editorViewModelSelection.getNextElementSelection({
        currentSelection: ['image-hero'],
        elementId: 'text-title',
      }),
    ).toEqual(['text-title']);
    expect(
      editorViewModelSelection.getNextElementSelection({
        additive: true,
        currentSelection: ['image-hero'],
        elementId: 'text-title',
      }),
    ).toEqual(['image-hero', 'text-title']);
    expect(
      editorViewModelSelection.getNextElementSelection({
        additive: true,
        currentSelection: ['image-hero', 'text-title'],
        elementId: 'text-title',
      }),
    ).toEqual(['image-hero']);
  });

  it('selects visible page elements that are not processing', () => {
    const project = sampleProject.createSampleProject();
    const firstElementId = project.pages[0]?.elementIds[0];
    const secondElementId = project.pages[0]?.elementIds[1];
    if (!firstElementId || !secondElementId) {
      throw new Error('Sample project must include at least two page elements.');
    }

    const nextProject = {
      ...project,
      elements: {
        ...project.elements,
        [firstElementId]: {
          ...project.elements[firstElementId]!,
          visible: false,
        },
      },
    };

    const selectableElementIds = editorViewModelSelection.getSelectableElementIdsOnPage({
      pageId: project.pages[0]!.id,
      processingElementIds: [secondElementId],
      project: nextProject,
    });

    expect(selectableElementIds).not.toContain(firstElementId);
    expect(selectableElementIds).not.toContain(secondElementId);
    expect(selectableElementIds.length).toBeGreaterThan(0);
  });
});
