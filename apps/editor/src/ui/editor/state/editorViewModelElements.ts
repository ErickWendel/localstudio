import type {
  Asset,
  DesignElement,
  ImageElement,
  Page,
  ProjectDocument,
  ShapeElement,
  ShapeKind,
  TextElement,
} from '../../../domain/documents/model';
import { placeholderImage } from '../../../domain/assets/placeholderImage';
import type { TextPreset } from './useEditorViewModel';

const PASTED_ELEMENT_OFFSET = 32;
const GRID_SPLIT_GAP = 16;
const IMAGE_GRID_MARGIN_X = 96;
const IMAGE_GRID_MARGIN_Y = 72;
const PLACEHOLDER_IMAGE_ASPECT_RATIO = 433 / 287;
const IMAGE_GRID_CONTENT_GAP = 72;

export type GridSplitLayout = 'auto' | 'one-two' | 'two-by-two' | 'two-one';
export type ImageGridFit = 'contain' | 'cover' | 'stretch';
export type ImageGridPreset = 'one' | 'two-columns' | 'three-two-one' | 'four-square';
export type ImageGridMediaPosition = 'bottom' | 'left' | 'right' | 'top';
export type ImageGridRequest =
  | ImageGridPreset
  | {
      columns: number;
      imageFit?: ImageGridFit;
      mediaPosition?: ImageGridMediaPosition;
      rows: number;
      textCount?: number;
    };
export interface SelectionGridRequest {
  columns: number;
  imageFit?: ImageGridFit;
  mediaPosition?: ImageGridMediaPosition;
  rows: number;
}

export interface ElementClipboardState {
  assets: ProjectDocument['assets'];
  elements: DesignElement[];
}

const placeholderImageAsset: Asset = {
  id: placeholderImage.PLACEHOLDER_IMAGE_ASSET_ID,
  type: 'image',
  name: placeholderImage.PLACEHOLDER_IMAGE_NAME,
  mimeType: placeholderImage.PLACEHOLDER_IMAGE_MIME_TYPE,
  objectUrl: placeholderImage.PLACEHOLDER_IMAGE_URL,
  storage: 'inline',
};

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

function getImageGridFrameBounds(page: Page) {
  return {
    height: Math.max(1, page.height - IMAGE_GRID_MARGIN_Y * 2),
    width: Math.max(1, page.width - IMAGE_GRID_MARGIN_X * 2),
    x: IMAGE_GRID_MARGIN_X,
    y: IMAGE_GRID_MARGIN_Y,
  };
}

function splitImageGridContentBounds(input: {
  bounds: { height: number; width: number; x: number; y: number };
  mediaPosition: ImageGridMediaPosition;
  textCount: number;
}) {
  if (input.textCount < 1) return { imageBounds: input.bounds, textBounds: [] };

  const horizontal = input.mediaPosition === 'left' || input.mediaPosition === 'right';
  if (horizontal) {
    const availableWidth = Math.max(1, input.bounds.width - IMAGE_GRID_CONTENT_GAP);
    const imageWidth = Math.max(1, availableWidth * 0.56);
    const textWidth = Math.max(1, availableWidth - imageWidth);
    const leftPane = {
      ...input.bounds,
      width: input.mediaPosition === 'left' ? imageWidth : textWidth,
    };
    const rightPane = {
      ...input.bounds,
      width: input.mediaPosition === 'left' ? textWidth : imageWidth,
      x: input.bounds.x + leftPane.width + IMAGE_GRID_CONTENT_GAP,
    };
    return input.mediaPosition === 'left'
      ? { imageBounds: leftPane, textBounds: createTextFrameStack(rightPane, input.textCount) }
      : { imageBounds: rightPane, textBounds: createTextFrameStack(leftPane, input.textCount) };
  }

  const textPaneHeight = getTextPaneHeight(input.bounds.height, input.textCount);
  const imagePaneHeight = Math.max(1, input.bounds.height - textPaneHeight - IMAGE_GRID_CONTENT_GAP);
  const topPane = {
    ...input.bounds,
    height: input.mediaPosition === 'top' ? imagePaneHeight : textPaneHeight,
  };
  const bottomPane = {
    ...input.bounds,
    height: input.mediaPosition === 'top' ? textPaneHeight : imagePaneHeight,
    y: input.bounds.y + topPane.height + IMAGE_GRID_CONTENT_GAP,
  };
  return input.mediaPosition === 'top'
    ? { imageBounds: topPane, textBounds: createTextFrameStack(bottomPane, input.textCount) }
    : { imageBounds: bottomPane, textBounds: createTextFrameStack(topPane, input.textCount) };
}

function getTextPaneHeight(totalHeight: number, textCount: number) {
  const preferredHeight = textCount <= 1 ? 260 : 156 * textCount + GRID_SPLIT_GAP * (textCount - 1);
  return Math.max(148, Math.min(totalHeight * 0.44, preferredHeight));
}

function createTextFrameStack(
  bounds: { height: number; width: number; x: number; y: number },
  count: number,
) {
  const gap = count > 1 ? GRID_SPLIT_GAP : 0;
  const maxItemHeight = count <= 1 ? Math.min(bounds.height, 260) : 156;
  const height = Math.max(1, Math.min(maxItemHeight, (bounds.height - gap * (count - 1)) / count));
  const stackHeight = height * count + gap * (count - 1);
  const top = bounds.y + Math.max(0, (bounds.height - stackHeight) / 2);
  return Array.from({ length: count }, (_, index) => ({
    height,
    width: bounds.width,
    x: bounds.x,
    y: top + index * (height + gap),
  }));
}

function getImageGridLayout(request: ImageGridRequest) {
  if (typeof request !== 'string') {
    return {
      columns: Math.max(1, request.columns),
      count: Math.max(1, request.columns) * Math.max(1, request.rows),
      rows: Math.max(1, request.rows),
    };
  }
  if (request === 'one') return { columns: 1, count: 1, rows: 1 };
  if (request === 'two-columns') return { columns: 2, count: 2, rows: 1 };
  if (request === 'three-two-one') return { columns: 2, count: 3, rows: 2 };
  return { columns: 2, count: 4, rows: 2 };
}

function createImageGridFrames(input: {
  bounds?: { height: number; width: number; x: number; y: number };
  page: Page;
  request: ImageGridRequest;
}) {
  const bounds = input.bounds ?? getImageGridFrameBounds(input.page);
  const layout = getImageGridLayout(input.request);
  const cellWidth = Math.max(
    1,
    (bounds.width - GRID_SPLIT_GAP * (layout.columns - 1)) / layout.columns,
  );
  const cellHeight = Math.max(
    1,
    (bounds.height - GRID_SPLIT_GAP * (layout.rows - 1)) / layout.rows,
  );
  const placements =
    input.request === 'three-two-one'
      ? [
          { column: 0, row: 0 },
          { column: 1, row: 0 },
          { column: 0.5, row: 1 },
        ]
      : undefined;

  return Array.from({ length: layout.count }, (_, index) => {
    const placement = placements?.[index];
    const column = placement?.column ?? index % layout.columns;
    const row = placement?.row ?? Math.floor(index / layout.columns);
    return {
      height: cellHeight,
      width: cellWidth,
      x: bounds.x + column * (cellWidth + GRID_SPLIT_GAP),
      y: bounds.y + row * (cellHeight + GRID_SPLIT_GAP),
    };
  });
}

function createImageGridPlaceholderElements(input: {
  createElementId: (index: number, type: 'image' | 'text') => string;
  page: Page;
  request: ImageGridRequest;
}) {
  const textCount =
    typeof input.request === 'string' ? 0 : Math.max(0, Math.floor(input.request.textCount ?? 0));
  const mediaPosition =
    typeof input.request === 'string' ? 'left' : (input.request.mediaPosition ?? 'left');
  const imageFit = typeof input.request === 'string' ? 'cover' : (input.request.imageFit ?? 'cover');
  const contentBounds = splitImageGridContentBounds({
    bounds: getImageGridFrameBounds(input.page),
    mediaPosition,
    textCount,
  });
  const frames = createImageGridFrames({
    bounds: contentBounds.imageBounds,
    page: input.page,
    request: input.request,
  });
  const elements: ImageElement[] = frames.map((frame, index) =>
    createImageGridImagePlaceholder({
      elementId: input.createElementId(index, 'image'),
      fit: imageFit,
      frame,
    }),
  );
  const textElements: TextElement[] = contentBounds.textBounds.map((frame, index) =>
    createImageGridTextPlaceholder({
      elementId: input.createElementId(index, 'text'),
      frame,
    }),
  );
  return {
    assets: { [placeholderImage.PLACEHOLDER_IMAGE_ASSET_ID]: placeholderImageAsset },
    elements: [...elements, ...textElements],
  };
}

function createImageGridImagePlaceholder(input: {
  elementId: string;
  fit: ImageGridFit;
  frame: { height: number; width: number; x: number; y: number };
}) {
  const containedFrame =
    input.fit === 'contain' ? fitPlaceholderImageWithinFrame(input.frame) : input.frame;
  const crop = input.fit === 'cover' ? createCoverCropForFrame(input.frame) : undefined;
  return {
    id: input.elementId,
    type: 'image',
    assetId: placeholderImage.PLACEHOLDER_IMAGE_ASSET_ID,
    ...containedFrame,
    rotation: 0,
    locked: false,
    visible: true,
    opacity: 1,
    ...(crop ? { crop } : {}),
  } satisfies ImageElement;
}

function fitPlaceholderImageWithinFrame(frame: {
  height: number;
  width: number;
  x: number;
  y: number;
}) {
  const width = Math.min(frame.width, frame.height * PLACEHOLDER_IMAGE_ASPECT_RATIO);
  const height = width / PLACEHOLDER_IMAGE_ASPECT_RATIO;
  return {
    height,
    width,
    x: frame.x + (frame.width - width) / 2,
    y: frame.y + (frame.height - height) / 2,
  };
}

function createImageGridTextPlaceholder(input: {
  elementId: string;
  frame: { height: number; width: number; x: number; y: number };
}) {
  return {
    id: input.elementId,
    type: 'text',
    text: 'Add a heading',
    ...input.frame,
    rotation: 0,
    locked: false,
    visible: true,
    opacity: 1,
    fontFamily: 'Orbitron',
    fontSize: 96,
    fontWeight: 800,
    fill: '#37FD76',
    align: 'center',
    lineHeight: 1.04,
    verticalAlign: 'middle',
  } satisfies TextElement;
}

function createCoverCropForFrame(frame: { width: number; height: number }) {
  const frameAspectRatio = frame.width > 0 && frame.height > 0 ? frame.width / frame.height : 1;
  if (frameAspectRatio > PLACEHOLDER_IMAGE_ASPECT_RATIO) {
    const height = PLACEHOLDER_IMAGE_ASPECT_RATIO / frameAspectRatio;
    return {
      height,
      width: 1,
      x: 0,
      y: (1 - height) / 2,
    };
  }

  const width = frameAspectRatio / PLACEHOLDER_IMAGE_ASPECT_RATIO;
  return {
    height: 1,
    width,
    x: (1 - width) / 2,
    y: 0,
  };
}

function getElementBounds(elements: DesignElement[]) {
  if (elements.length === 0) return undefined;
  const left = Math.min(...elements.map((element) => element.x));
  const top = Math.min(...elements.map((element) => element.y));
  const right = Math.max(...elements.map((element) => element.x + element.width));
  const bottom = Math.max(...elements.map((element) => element.y + element.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function createGridSplitFramePatches(input: {
  layout?: GridSplitLayout;
  page: Page;
  project: ProjectDocument;
  selectedElementIds: string[];
}) {
  const selectedElementIdSet = new Set(input.selectedElementIds);
  const selectedElements = input.page.elementIds
    .filter((elementId) => selectedElementIdSet.has(elementId))
    .map((elementId) => input.project.elements[elementId])
    .filter((element): element is DesignElement => Boolean(element));
  if (selectedElements.length < 2) return {};

  const bounds = getElementBounds(selectedElements);
  if (!bounds) return {};

  const layout = input.layout ?? 'auto';
  const columns =
    selectedElements.length === 3 && layout !== 'auto'
      ? 2
      : Math.ceil(Math.sqrt(selectedElements.length));
  const rows = Math.ceil(selectedElements.length / columns);
  const cellWidth = Math.max(1, (bounds.width - GRID_SPLIT_GAP * (columns - 1)) / columns);
  const cellHeight = Math.max(1, (bounds.height - GRID_SPLIT_GAP * (rows - 1)) / rows);
  const placements =
    selectedElements.length === 3 && layout === 'one-two'
      ? [
          { column: 0.5, row: 0 },
          { column: 0, row: 1 },
          { column: 1, row: 1 },
        ]
      : selectedElements.length === 3 && layout === 'two-one'
        ? [
            { column: 0, row: 0 },
            { column: 1, row: 0 },
            { column: 0.5, row: 1 },
          ]
        : undefined;

  return Object.fromEntries(
    selectedElements.map((element, index) => {
      const placement = placements?.[index];
      const column = placement?.column ?? index % columns;
      const row = placement?.row ?? Math.floor(index / columns);
      const aspectRatio =
        element.width > 0 && element.height > 0 ? element.width / element.height : 1;
      const width = Math.min(cellWidth, cellHeight * aspectRatio);
      const height = width / aspectRatio;
      const cellX = bounds.x + column * (cellWidth + GRID_SPLIT_GAP);
      const cellY = bounds.y + row * (cellHeight + GRID_SPLIT_GAP);
      return [
        element.id,
        {
          height,
          width,
          x: cellX + (cellWidth - width) / 2,
          y: cellY + (cellHeight - height) / 2,
        },
      ];
    }),
  );
}

function createSelectionGridFramePatches(input: {
  page: Page;
  project: ProjectDocument;
  request: SelectionGridRequest;
  selectedElementIds: string[];
}) {
  const selectedElementIdSet = new Set(input.selectedElementIds);
  const selectedElements = input.page.elementIds
    .filter((elementId) => selectedElementIdSet.has(elementId))
    .map((elementId) => input.project.elements[elementId])
    .filter((element): element is DesignElement => Boolean(element));
  if (selectedElements.length < 2) return {};

  const bounds = getElementBounds(selectedElements);
  if (!bounds) return {};

  const textElements = selectedElements.filter((element) => element.type === 'text');
  const visualElements = selectedElements.filter((element) => element.type !== 'text');
  if (textElements.length === 0 || visualElements.length === 0) {
    return createSelectionGridPatchesForElements({
      bounds,
      columns: input.request.columns,
      elements: selectedElements,
      fit: input.request.imageFit ?? 'contain',
      rows: input.request.rows,
    });
  }

  const splitBounds = splitImageGridContentBounds({
    bounds,
    mediaPosition: input.request.mediaPosition ?? 'left',
    textCount: textElements.length,
  });
  return {
    ...createSelectionGridPatchesForElements({
      bounds: splitBounds.imageBounds,
      columns: input.request.columns,
      elements: visualElements,
      fit: input.request.imageFit ?? 'contain',
      rows: input.request.rows,
    }),
    ...createSelectionTextStackPatches(textElements, splitBounds.textBounds),
  };
}

function createSelectionGridPatchesForElements(input: {
  bounds: { height: number; width: number; x: number; y: number };
  columns: number;
  elements: DesignElement[];
  fit: ImageGridFit;
  rows: number;
}) {
  if (input.elements.length === 0) return {};
  const requestedColumns = Math.max(1, Math.floor(input.columns));
  const rows = Math.min(input.elements.length, Math.max(1, Math.floor(input.rows)));
  const columns = Math.max(requestedColumns, Math.ceil(input.elements.length / rows));
  const cellWidth = Math.max(1, (input.bounds.width - GRID_SPLIT_GAP * (columns - 1)) / columns);
  const cellHeight = Math.max(1, (input.bounds.height - GRID_SPLIT_GAP * (rows - 1)) / rows);

  return Object.fromEntries(
    input.elements.map((element, index) => {
      const column = Math.floor(index / rows);
      const row = index % rows;
      const cell = {
        height: cellHeight,
        width: cellWidth,
        x: input.bounds.x + column * (cellWidth + GRID_SPLIT_GAP),
        y: input.bounds.y + row * (cellHeight + GRID_SPLIT_GAP),
      };
      return [
        element.id,
        input.fit === 'cover' || input.fit === 'stretch'
          ? cell
          : fitElementInsideFrame({
              frame: cell,
              sourceHeight: element.height,
              sourceWidth: element.width,
            }),
      ];
    }),
  );
}

function createSelectionTextStackPatches(
  elements: DesignElement[],
  frames: Array<{ height: number; width: number; x: number; y: number }>,
) {
  return Object.fromEntries(
    elements.map((element, index) => {
      const frame = frames[index] ?? frames[frames.length - 1];
      return [
        element.id,
        frame
          ? { height: frame.height, width: frame.width, x: frame.x, y: frame.y }
          : { height: element.height, width: element.width, x: element.x, y: element.y },
      ];
    }),
  );
}

function fitElementInsideFrame(input: {
  frame: { height: number; width: number; x: number; y: number };
  sourceHeight: number;
  sourceWidth: number;
}) {
  if (input.sourceWidth <= 0 || input.sourceHeight <= 0) return input.frame;
  const scale = Math.min(
    input.frame.width / input.sourceWidth,
    input.frame.height / input.sourceHeight,
  );
  const width = Math.max(1, input.sourceWidth * scale);
  const height = Math.max(1, input.sourceHeight * scale);
  return {
    height,
    width,
    x: input.frame.x + (input.frame.width - width) / 2,
    y: input.frame.y + (input.frame.height - height) / 2,
  };
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
  createGridSplitFramePatches,
  createImageGridPlaceholderElements,
  createPastedElements,
  createSelectionGridFramePatches,
  createShapeElement,
  createTextElement,
  getSelectedElementsForClipboard,
};
