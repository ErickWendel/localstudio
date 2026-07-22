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

  it('creates proportional grid split patches in page order', () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0];
    expect(page).toBeDefined();

    const patches = editorViewModelElements.createGridSplitFramePatches({
      page: page!,
      project,
      selectedElementIds: ['text-title', 'image-hero', 'text-subtitle'],
    });

    expect(Object.keys(patches)).toEqual(['image-hero', 'text-subtitle', 'text-title']);
    const imagePatch = patches['image-hero'];
    const subtitlePatch = patches['text-subtitle'];
    const titlePatch = patches['text-title'];
    expect(imagePatch).toBeDefined();
    expect(subtitlePatch).toBeDefined();
    expect(titlePatch).toBeDefined();
    expect(typeof imagePatch?.width).toBe('number');
    expect(typeof imagePatch?.height).toBe('number');
    expect(subtitlePatch?.x).toBeGreaterThan(imagePatch?.x ?? 0);
    expect(titlePatch?.y).toBeGreaterThan(imagePatch?.y ?? 0);
    expect((imagePatch?.width ?? 1) / (imagePatch?.height ?? 1)).toBeCloseTo(980 / 735);
  });

  it('centers the third item in the second row for a two plus one grid split', () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0];
    expect(page).toBeDefined();

    const patches = editorViewModelElements.createGridSplitFramePatches({
      layout: 'two-one',
      page: page!,
      project,
      selectedElementIds: ['text-title', 'image-hero', 'text-subtitle'],
    });

    const imagePatch = patches['image-hero'];
    const subtitlePatch = patches['text-subtitle'];
    const titlePatch = patches['text-title'];
    expect(titlePatch?.y).toBeGreaterThan(imagePatch?.y ?? 0);
    expect(titlePatch?.x).toBeGreaterThan(imagePatch?.x ?? 0);
    expect(titlePatch?.x).toBeLessThan(subtitlePatch?.x ?? Number.POSITIVE_INFINITY);
  });

  it('centers the first item in the first row for a one plus two grid split', () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0];
    expect(page).toBeDefined();

    const patches = editorViewModelElements.createGridSplitFramePatches({
      layout: 'one-two',
      page: page!,
      project,
      selectedElementIds: ['text-title', 'image-hero', 'text-subtitle'],
    });

    const imagePatch = patches['image-hero'];
    const subtitlePatch = patches['text-subtitle'];
    const titlePatch = patches['text-title'];
    expect(imagePatch?.y).toBeLessThan(subtitlePatch?.y ?? Number.POSITIVE_INFINITY);
    expect(imagePatch?.x).toBeGreaterThan(subtitlePatch?.x ?? 0);
    expect(imagePatch?.x).toBeLessThan(titlePatch?.x ?? Number.POSITIVE_INFINITY);
  });

  it('creates three selected placeholder images in a centered grid layout', () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0];
    expect(page).toBeDefined();

    const grid = editorViewModelElements.createImageGridPlaceholderElements({
      createElementId: (index) => `grid-image-${index + 1}`,
      page: page!,
      request: 'three-two-one',
    });

    const imageElements = grid.elements.filter((element) => element.type === 'image');
    expect(Object.keys(grid.assets)).toEqual(['asset-placeholder-web-ai']);
    expect(grid.elements).toHaveLength(3);
    expect(imageElements.map((element) => element.assetId)).toEqual([
      'asset-placeholder-web-ai',
      'asset-placeholder-web-ai',
      'asset-placeholder-web-ai',
    ]);
    expect(imageElements[2]?.y).toBeGreaterThan(imageElements[0]?.y ?? 0);
    expect(imageElements[2]?.x).toBeGreaterThan(imageElements[0]?.x ?? 0);
    expect(imageElements[2]?.x).toBeLessThan(imageElements[1]?.x ?? Number.POSITIVE_INFINITY);
    for (const element of imageElements) {
      const renderedAspectRatio = element.width / element.height;
      expect(element.crop).toBeDefined();
      const cropAspectRatio =
        (433 * (element.crop?.width ?? 1)) / (287 * (element.crop?.height ?? 1));
      expect(cropAspectRatio).toBeCloseTo(renderedAspectRatio);
    }
  });

  it('creates custom placeholder image grids from explicit columns and rows', () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0];
    expect(page).toBeDefined();

    const grid = editorViewModelElements.createImageGridPlaceholderElements({
      createElementId: (index) => `grid-image-${index + 1}`,
      page: page!,
      request: { columns: 3, rows: 2 },
    });

    expect(grid.elements).toHaveLength(6);
    expect(grid.elements.map((element) => element.id)).toEqual([
      'grid-image-1',
      'grid-image-2',
      'grid-image-3',
      'grid-image-4',
      'grid-image-5',
      'grid-image-6',
    ]);
    expect(grid.elements[1]?.x).toBeGreaterThan(grid.elements[0]?.x ?? 0);
    expect(grid.elements[2]?.x).toBeGreaterThan(grid.elements[1]?.x ?? 0);
    expect(grid.elements[3]?.y).toBeGreaterThan(grid.elements[0]?.y ?? 0);
    expect(grid.elements[3]?.x).toBe(grid.elements[0]?.x);
  });

  it('creates custom image and text placeholder layouts in the requested order', () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0];
    expect(page).toBeDefined();

    const grid = editorViewModelElements.createImageGridPlaceholderElements({
      createElementId: (index, type) => `${type}-${index + 1}`,
      page: page!,
      request: { columns: 1, mediaPosition: 'left', rows: 1, textCount: 1 },
    });

    const image = grid.elements.find((element) => element.type === 'image');
    const text = grid.elements.find((element) => element.type === 'text');
    expect(grid.elements).toHaveLength(2);
    expect(image).toBeDefined();
    expect(text).toMatchObject({
      id: 'text-1',
      fontSize: 96,
      text: 'Add a heading',
      type: 'text',
    });
    expect(image?.x).toBeLessThan(text?.x ?? 0);
    expect(text?.y).toBeGreaterThan(image?.y ?? 0);
    expect(text?.height).toBeGreaterThanOrEqual(240);
    expect(text?.height).toBeLessThan(image?.height ?? 0);
    expect(image?.x).toBeLessThan(120);
    expect(image?.height).toBeGreaterThan(900);
  });

  it('keeps top text compact and gives the image grid the dominant area', () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0];
    expect(page).toBeDefined();

    const grid = editorViewModelElements.createImageGridPlaceholderElements({
      createElementId: (index, type) => `${type}-${index + 1}`,
      page: page!,
      request: { columns: 2, mediaPosition: 'bottom', rows: 2, textCount: 1 },
    });

    const image = grid.elements.find((element) => element.type === 'image');
    const text = grid.elements.find((element) => element.type === 'text');
    expect(text?.height).toBeGreaterThanOrEqual(240);
    expect(image?.height).toBeGreaterThan(text?.height ?? 0);
    expect(text?.y).toBeLessThan(image?.y ?? Number.POSITIVE_INFINITY);
  });

  it('applies custom image fit modes to generated grid placeholders', () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0];
    expect(page).toBeDefined();

    const cover = editorViewModelElements.createImageGridPlaceholderElements({
      createElementId: (index, type) => `${type}-cover-${index + 1}`,
      page: page!,
      request: { columns: 1, imageFit: 'cover', rows: 1 },
    });
    const contain = editorViewModelElements.createImageGridPlaceholderElements({
      createElementId: (index, type) => `${type}-contain-${index + 1}`,
      page: page!,
      request: { columns: 1, imageFit: 'contain', rows: 1 },
    });
    const stretch = editorViewModelElements.createImageGridPlaceholderElements({
      createElementId: (index, type) => `${type}-stretch-${index + 1}`,
      page: page!,
      request: { columns: 1, imageFit: 'stretch', rows: 1 },
    });

    const coverImage = cover.elements.find((element) => element.type === 'image');
    const containImage = contain.elements.find((element) => element.type === 'image');
    const stretchImage = stretch.elements.find((element) => element.type === 'image');
    expect(coverImage?.crop).toBeDefined();
    expect(containImage?.crop).toBeUndefined();
    expect(containImage?.width).toBeLessThan(coverImage?.width ?? 0);
    expect(stretchImage?.crop).toBeUndefined();
    expect(stretchImage?.width).toBe(coverImage?.width);
    expect(stretchImage?.height).toBe(coverImage?.height);
  });

  it('creates custom grid frame patches for the current selection', () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0];
    expect(page).toBeDefined();

    const patches = editorViewModelElements.createSelectionGridFramePatches({
      page: page!,
      project,
      request: { columns: 2, imageFit: 'contain', rows: 2 },
      selectedElementIds: ['text-title', 'image-hero', 'text-subtitle'],
    });

    expect(Object.keys(patches)).toEqual(['image-hero', 'text-subtitle', 'text-title']);
    expect(patches['image-hero']?.x).toBeLessThan(patches['text-subtitle']?.x ?? 0);
    expect(patches['text-title']?.y).toBeGreaterThan(patches['image-hero']?.y ?? 0);
    expect((patches['image-hero']?.width ?? 1) / (patches['image-hero']?.height ?? 1)).toBeCloseTo(
      980 / 735,
    );
  });

  it('honors fewer requested rows by expanding columns for selected visual elements', () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0];
    expect(page).toBeDefined();
    const images = Array.from({ length: 5 }, (_, index) => {
      const element = {
        ...project.elements['image-hero']!,
        id: `image-${index + 1}`,
        x: 100 + index * 24,
        y: 160 + index * 28,
      };
      project.elements[element.id] = element;
      page!.elementIds.push(element.id);
      return element.id;
    });

    const patches = editorViewModelElements.createSelectionGridFramePatches({
      page: page!,
      project,
      request: { columns: 1, imageFit: 'stretch', mediaPosition: 'right', rows: 2 },
      selectedElementIds: ['text-title', ...images],
    });
    const imageRows = new Set(images.map((id) => Math.round(patches[id]?.y ?? 0)));

    expect(imageRows.size).toBe(2);
    expect(patches[images[2]!]?.x).toBeGreaterThan(patches[images[0]!]?.x ?? 0);
  });

  it('does not shrink a single selected visual element when requested rows exceed it', () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0];
    expect(page).toBeDefined();

    const patches = editorViewModelElements.createSelectionGridFramePatches({
      page: page!,
      project,
      request: { columns: 1, imageFit: 'cover', mediaPosition: 'left', rows: 3 },
      selectedElementIds: ['image-hero', 'text-title'],
    });

    expect(patches['image-hero']?.height).toBeGreaterThan(400);
    expect(patches['image-hero']?.x).toBeLessThan(patches['text-title']?.x ?? 0);
  });
});
