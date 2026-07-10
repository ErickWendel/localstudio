import { describe, expect, it } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { editorViewModelHistory } from '../../../../src/ui/editor/state/editorViewModelHistory';

describe('editor view model history helpers', () => {
  it('keeps the current page when it still exists and falls back to the first page otherwise', () => {
    const baseProject = sampleProject.createSampleProject();
    const project = {
      ...baseProject,
      pages: [
        baseProject.pages[0]!,
        { ...baseProject.pages[0]!, id: 'page-2', name: 'Slide 2' },
      ],
    };

    expect(editorViewModelHistory.getActivePageIdForProject(project, 'page-2')).toBe('page-2');
    expect(editorViewModelHistory.getActivePageIdForProject(project, 'missing')).toBe('page-1');
  });

  it('retains selected elements that still exist on the restored page', () => {
    const project = sampleProject.createSampleProject();

    const selection = editorViewModelHistory.getSelectionForProject({
      currentSelection: ['missing', 'text-title'],
      pageId: 'page-1',
      project,
    });

    expect(selection).toEqual(['text-title']);
  });

  it('selects the topmost page element when restored selection is gone', () => {
    const project = sampleProject.createSampleProject();

    const selection = editorViewModelHistory.getSelectionForProject({
      currentSelection: ['missing'],
      pageId: 'page-1',
      project,
    });

    expect(selection).toEqual([project.pages[0]?.elementIds.at(-1)]);
  });
});
