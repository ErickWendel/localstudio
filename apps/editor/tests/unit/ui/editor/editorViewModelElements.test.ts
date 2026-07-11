import { describe, expect, it } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { editorViewModelElements } from '../../../../src/ui/editor/state/editorViewModelElements';

describe('editor view model element helpers', () => {
  it('collects selected page elements in page order', () => {
    const project = sampleProject.createSampleProject();

    const selectedElements = editorViewModelElements.getSelectedElementsForClipboard({
      activePageId: 'page-1',
      project,
      selectedElementIds: ['text-subtitle', 'image-hero'],
    });

    expect(selectedElements.map((element) => element.id)).toEqual(['image-hero', 'text-subtitle']);
  });

  it('copies only assets referenced by selected media elements', () => {
    const project = sampleProject.createSampleProject();
    const selectedElements = editorViewModelElements.getSelectedElementsForClipboard({
      activePageId: 'page-1',
      project,
      selectedElementIds: ['text-title', 'image-hero'],
    });

    const assets = editorViewModelElements.collectClipboardAssets(project, selectedElements);

    expect(Object.keys(assets)).toEqual(['asset-hero']);
  });

  it('creates pasted element copies offset from the source and unlocked', () => {
    const project = sampleProject.createSampleProject();
    const sourceElement = project.elements['text-title'];
    expect(sourceElement).toBeDefined();

    const [pastedElement] = editorViewModelElements.createPastedElements({
      createElementId: (sourceElementId) => `${sourceElementId}-copy-1`,
      elements: sourceElement ? [{ ...sourceElement, locked: true }] : [],
    });

    expect(pastedElement).toMatchObject({
      id: 'text-title-copy-1',
      x: (sourceElement?.x ?? 0) + 32,
      y: (sourceElement?.y ?? 0) + 32,
      locked: false,
    });
  });

  it('creates text elements from the matching project preset template', () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0];
    const selectedElement = project.elements['text-title'];
    expect(page).toBeDefined();

    const textElement = editorViewModelElements.createTextElement({
      elementId: 'text-new',
      page: page!,
      preset: 'subtitle',
      project,
      selectedElement,
    });

    expect(textElement).toMatchObject({
      id: 'text-new',
      type: 'text',
      text: 'Add a subheading',
      fontFamily: 'Open Sans',
      fill: '#FFFFFF',
      locked: false,
      visible: true,
    });
    expect(textElement.x).toBe((selectedElement?.x ?? 0) + 32);
    expect(textElement.y).toBe((selectedElement?.y ?? 0) + 32);
  });

  it('creates line-like shape elements with stroke defaults', () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0];
    expect(page).toBeDefined();

    const shapeElement = editorViewModelElements.createShapeElement({
      elementId: 'shape-line',
      page: page!,
      selectedElement: undefined,
      shape: 'line',
    });

    expect(shapeElement).toMatchObject({
      id: 'shape-line',
      type: 'shape',
      shape: 'line',
      width: 260,
      height: 120,
      stroke: '#37FD76',
      strokeWidth: 4,
      locked: false,
      visible: true,
    });
  });
});
