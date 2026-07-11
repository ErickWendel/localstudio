import { describe, expect, it } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type { ProjectFont } from '../../../../src/domain/documents/model';
import { editorViewModelText } from '../../../../src/ui/editor/state/editorViewModelText';

function createProjectWithShortTitleFrame() {
  const project = sampleProject.createSampleProject();
  return {
    ...project,
    elements: {
      ...project.elements,
      'text-title': {
        ...project.elements['text-title']!,
        height: 1,
      },
    },
  };
}

describe('editor view model text helpers', () => {
  it('clamps text frame height patches to the minimum readable height', () => {
    const project = sampleProject.createSampleProject();

    const patch = editorViewModelText.getFramePatchWithTextMinimum(project, 'text-title', {
      height: 1,
      width: 400,
    });

    expect(patch.width).toBe(400);
    expect(patch.height).toBeGreaterThan(1);
  });

  it('expands a text element after multiline content updates', () => {
    const project = createProjectWithShortTitleFrame();

    const nextProject = editorViewModelText.updateTextContent(
      project,
      'text-title',
      'Line one\nLine two\nLine three',
    );

    expect(nextProject.elements['text-title']).toMatchObject({
      text: 'Line one\nLine two\nLine three',
    });
    expect(nextProject.elements['text-title']?.height).toBeGreaterThan(1);
  });

  it('expands a text element after style updates increase font size', () => {
    const project = createProjectWithShortTitleFrame();

    const nextProject = editorViewModelText.updateElementStyle(project, 'text-title', {
      fontSize: 120,
    });

    expect(nextProject.elements['text-title']).toMatchObject({ fontSize: 120 });
    expect(nextProject.elements['text-title']?.height).toBeGreaterThan(120);
  });

  it('merges downloaded fonts before applying the selected family', () => {
    const project = sampleProject.createSampleProject();
    const font: ProjectFont = {
      id: 'font-inter',
      family: 'Inter',
      source: 'google-fonts',
      requestedFamily: 'Inter',
      fontStyle: 'normal',
      fontWeight: 700,
      mimeType: 'font/woff2',
      fileName: 'inter.woff2',
      storage: 'file',
    };

    const nextProject = editorViewModelText.applyFontFamilyWithFonts({
      elementId: 'text-title',
      font,
      fonts: { [font.id]: font },
      project,
    });

    expect(nextProject.fonts?.[font.id]).toEqual(font);
    expect(nextProject.elements['text-title']).toMatchObject({ fontFamily: 'Inter' });
  });
});
