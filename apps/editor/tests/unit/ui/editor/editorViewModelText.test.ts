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

  it('expands a text element after long pasted content wraps inside the frame', () => {
    const project = sampleProject.createSampleProject();
    const element = project.elements['text-title']!;

    const nextProject = editorViewModelText.updateTextContent(
      project,
      'text-title',
      '55 Horas, 770M Tokens e Uma Alternativa ao Canva Rodando no Browser',
    );

    expect(nextProject.elements['text-title']).toMatchObject({
      text: '55 Horas, 770M Tokens e Uma Alternativa ao Canva Rodando no Browser',
      width: element.width,
    });
    expect(nextProject.elements['text-title']?.height).toBeGreaterThan(element.height);
  });

  it('keeps wrapped text readable when a frame is resized narrower', () => {
    const baseProject = sampleProject.createSampleProject();
    const project = {
      ...baseProject,
      elements: {
        ...baseProject.elements,
        'text-title': {
          ...baseProject.elements['text-title']!,
          text: '55 Horas, 770M Tokens e Uma Alternativa ao Canva Rodando no Browser',
        },
      },
    };

    const patch = editorViewModelText.getFramePatchWithTextMinimum(project, 'text-title', {
      height: 1,
      width: 240,
    });

    expect(patch.width).toBe(240);
    expect(patch.height).toBeGreaterThan(1);
  });

  it('expands a text element after style updates increase font size', () => {
    const project = createProjectWithShortTitleFrame();

    const nextProject = editorViewModelText.updateElementStyle(project, 'text-title', {
      fontSize: 120,
    });

    expect(nextProject.elements['text-title']).toMatchObject({ fontSize: 120 });
    expect(nextProject.elements['text-title']?.height).toBeGreaterThan(120);
  });

  it('fits the text frame height when only the font family changes', () => {
    const project = sampleProject.createSampleProject();
    const originalHeight = project.elements['text-title']!.height;

    const nextProject = editorViewModelText.updateElementStyle(project, 'text-title', {
      fontFamily: 'Inter',
    });

    expect(nextProject.elements['text-title']).toMatchObject({
      fontFamily: 'Inter',
    });
    expect(nextProject.elements['text-title']?.height).toBeLessThan(originalHeight);
    expect(nextProject.elements['text-title']?.height).toBeGreaterThan(96);
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
