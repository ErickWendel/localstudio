import type {
  DesignElement,
  Page,
  ProjectDocument,
  ShapeElement,
  ShapeKind,
} from '../../../domain/documents/model';
import type { TextPreset } from './useEditorViewModel';

const PASTED_ELEMENT_OFFSET = 32;

export interface ElementClipboardState {
  assets: ProjectDocument['assets'];
  elements: DesignElement[];
}

function getSelectedElementsForClipboard(input: {
  activePageId: string;
  project: ProjectDocument;
  selectedElementIds: string[];
}) {
  const page = input.project.pages.find((item) => item.id === input.activePageId);
  if (!page) return [];
  return page.elementIds
    .filter((elementId) => input.selectedElementIds.includes(elementId))
    .map((elementId) => input.project.elements[elementId])
    .filter((element): element is DesignElement => Boolean(element));
}

function collectClipboardAssets(project: ProjectDocument, selectedElements: DesignElement[]) {
  const copiedAssets: ProjectDocument['assets'] = {};
  for (const element of selectedElements) {
    if (element.type !== 'image' && element.type !== 'gif' && element.type !== 'video') continue;
    const asset = project.assets[element.assetId];
    if (asset) copiedAssets[element.assetId] = asset;
  }
  return copiedAssets;
}

function createPastedElements(input: {
  createElementId: (sourceElementId: string) => string;
  elements: DesignElement[];
}) {
  return input.elements.map((element) => ({
    ...element,
    id: input.createElementId(element.id),
    x: element.x + PASTED_ELEMENT_OFFSET,
    y: element.y + PASTED_ELEMENT_OFFSET,
    locked: false,
  }));
}

function getTextPresetStyles(project: ProjectDocument) {
  const titleTemplate = project.elements['text-title'];
  const subtitleTemplate = project.elements['text-subtitle'];
  const styles: Record<
    TextPreset,
    Omit<
      Extract<DesignElement, { type: 'text' }>,
      'id' | 'locked' | 'opacity' | 'rotation' | 'type' | 'visible' | 'x' | 'y'
    >
  > = {
    title:
      titleTemplate?.type === 'text'
        ? {
            text: 'Add a heading',
            width: titleTemplate.width,
            height: titleTemplate.height,
            fontFamily: titleTemplate.fontFamily,
            fontSize: titleTemplate.fontSize,
            fontWeight: titleTemplate.fontWeight,
            fill: titleTemplate.fill,
            align: titleTemplate.align,
          }
        : {
            text: 'Add a heading',
            width: 680,
            height: 220,
            fontFamily: 'Orbitron',
            fontSize: 96,
            fontWeight: 800,
            fill: '#37FD76',
            align: 'center',
          },
    subtitle:
      subtitleTemplate?.type === 'text'
        ? {
            text: 'Add a subheading',
            width: subtitleTemplate.width,
            height: subtitleTemplate.height,
            fontFamily: subtitleTemplate.fontFamily,
            fontSize: subtitleTemplate.fontSize,
            fontWeight: subtitleTemplate.fontWeight,
            fill: subtitleTemplate.fill,
            align: subtitleTemplate.align,
          }
        : {
            text: 'Add a subheading',
            width: 720,
            height: 92,
            fontFamily: 'Open Sans',
            fontSize: 44,
            fontWeight: 700,
            fill: '#FFFFFF',
            align: 'center',
          },
    body: {
      text: 'Add a little bit of body text',
      width: 760,
      height: 120,
      fontFamily: 'Open Sans',
      fontSize: 32,
      fontWeight: 500,
      fill: '#FFFFFF',
      align: 'left',
    },
  };
  return styles;
}

function getInsertedElementPosition(input: {
  height: number;
  page: Page;
  selectedElement: DesignElement | undefined;
  width: number;
}) {
  return {
    x: input.selectedElement
      ? Math.min(input.page.width - input.width, input.selectedElement.x + PASTED_ELEMENT_OFFSET)
      : (input.page.width - input.width) / 2,
    y: input.selectedElement
      ? Math.min(input.page.height - input.height, input.selectedElement.y + PASTED_ELEMENT_OFFSET)
      : (input.page.height - input.height) / 2,
  };
}

function createTextElement(input: {
  elementId: string;
  page: Page;
  preset: TextPreset;
  project: ProjectDocument;
  selectedElement: DesignElement | undefined;
}) {
  const style = getTextPresetStyles(input.project)[input.preset];
  const { width, height } = style;
  const position = getInsertedElementPosition({
    height,
    page: input.page,
    selectedElement: input.selectedElement,
    width,
  });

  return {
    id: input.elementId,
    type: 'text',
    text: style.text,
    ...position,
    width,
    height,
    rotation: 0,
    locked: false,
    visible: true,
    opacity: 1,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fill: style.fill,
    align: style.align,
  } satisfies DesignElement;
}

function createShapeElement(input: {
  elementId: string;
  page: Page;
  selectedElement: DesignElement | undefined;
  shape: ShapeKind;
}) {
  const isLinearShape = input.shape === 'line' || input.shape === 'arc';
  const defaultFrame: Record<ShapeKind, { width: number; height: number }> = {
    arc: { width: 260, height: 180 },
    arrow: { width: 260, height: 140 },
    diamond: { width: 180, height: 180 },
    ellipse: { width: 180, height: 180 },
    line: { width: 260, height: 120 },
    parallelogram: { width: 240, height: 150 },
    pentagon: { width: 190, height: 190 },
    rect: { width: 180, height: 180 },
    'rounded-rect': { width: 240, height: 150 },
    triangle: { width: 190, height: 180 },
  };
  const { width, height } = defaultFrame[input.shape];
  const position = getInsertedElementPosition({
    height,
    page: input.page,
    selectedElement: input.selectedElement,
    width,
  });

  return {
    id: input.elementId,
    type: 'shape',
    shape: input.shape,
    ...position,
    width,
    height,
    rotation: 0,
    locked: false,
    visible: true,
    opacity: 1,
    ...(isLinearShape ? { stroke: '#37FD76', strokeWidth: 4 } : { fill: '#37FD76' }),
  } satisfies ShapeElement;
}

export const editorViewModelElements = {
  collectClipboardAssets,
  createPastedElements,
  createShapeElement,
  createTextElement,
  getSelectedElementsForClipboard,
};
