import { describe, expect, it } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { editorViewModelPages } from '../../../../src/ui/editor/state/editorViewModelPages';

describe('editor view model page helpers', () => {
  it('creates a blank page after the requested source page dimensions', () => {
    const project = sampleProject.createSampleProject();

    const page = editorViewModelPages.createInsertedPage({
      activePageId: 'page-1',
      afterPageId: 'page-1',
      pageId: 'page-new',
      project,
    });

    expect(page).toMatchObject({
      id: 'page-new',
      name: `Slide ${project.pages.length + 1}`,
      width: project.pages[0]?.width,
      height: project.pages[0]?.height,
      background: project.pages[0]?.background,
      elementIds: [],
    });
  });

  it('inserts a page after a known target and appends after an unknown target', () => {
    const baseProject = sampleProject.createSampleProject();
    const project = {
      ...baseProject,
      pages: [
        ...baseProject.pages,
        {
          ...baseProject.pages[0]!,
          id: 'page-2',
          name: 'Slide 2',
          elementIds: [],
        },
      ],
    };
    const insertedPage = {
      ...project.pages[0]!,
      id: 'page-new',
      name: 'Slide new',
      elementIds: [],
    };

    const afterKnownTarget = editorViewModelPages.insertPageAfter(project, 'page-1', insertedPage);
    const afterUnknownTarget = editorViewModelPages.insertPageAfter(project, 'missing', insertedPage);

    expect(afterKnownTarget.pages.map((page) => page.id)).toEqual([
      'page-1',
      'page-new',
      'page-2',
    ]);
    expect(afterUnknownTarget.pages.map((page) => page.id)).toEqual([
      'page-1',
      'page-2',
      'page-new',
    ]);
  });

  it('chooses the next neighboring page after deletion', () => {
    const baseProject = sampleProject.createSampleProject();
    const project = {
      ...baseProject,
      pages: [
        baseProject.pages[0]!,
        { ...baseProject.pages[0]!, id: 'page-2', name: 'Slide 2' },
        { ...baseProject.pages[0]!, id: 'page-3', name: 'Slide 3' },
      ],
    };

    expect(editorViewModelPages.getNextPageIdAfterDelete(project, 'page-2')).toBe('page-3');
    expect(editorViewModelPages.getNextPageIdAfterDelete(project, 'page-3')).toBe('page-2');
    expect(editorViewModelPages.getNextPageIdAfterDelete(project, 'missing')).toBeUndefined();
    expect(
      editorViewModelPages.getNextPageIdAfterDelete(
        { ...project, pages: [project.pages[0]!] },
        'page-1',
      ),
    ).toBeUndefined();
  });
});
