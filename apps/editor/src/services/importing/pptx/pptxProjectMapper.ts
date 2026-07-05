import type {
  Asset,
  DesignElement,
  ImportWarning,
  Page,
  PlaceholderRole,
  ProjectDocument,
  SlideLayout,
} from '../../../domain/documents/model';
import { pptxFileUtils } from './pptxFileUtils';
import type { PptxPackage } from './pptxPackage';
import type { PptxDeck, PptxLayout, PptxSlideObject } from './pptxParser';

const TEXT_FRAME_FIT = {
  averageCharacterWidth: 0.9,
  canvasPadding: 6,
  heightPaddingRatio: 0.4,
  horizontalPaddingRatio: 1.2,
  lineHeightRatio: 1.35,
  shrinkOversizedHeightRatio: 1.8,
};

function createAssetId(path: string, index: number) {
  const slug = path
    .toLowerCase()
    .replace(/^ppt\/media\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  return `pptx-asset-${index + 1}-${slug || 'asset'}`;
}

function createAsset(file: NonNullable<ReturnType<PptxPackage['getFile']>>, index: number, pptxPackage: PptxPackage): Asset | undefined {
  const mimeType = pptxPackage.getContentType(file.path) ?? pptxFileUtils.getMimeType(file.path, file.blob.type);
  const type = pptxFileUtils.getAssetType(file.path, mimeType);
  if (!type) return undefined;
  const fileName = file.path.split('/').at(-1);
  const objectUrl = pptxFileUtils.createObjectUrl(file.blob);
  return {
    id: createAssetId(file.path, index),
    type,
    name: fileName ?? file.path,
    mimeType,
    storage: 'inline',
    ...(objectUrl ? { objectUrl } : {}),
    ...(fileName ? { fileName } : {}),
  };
}

function getOrCreateAsset(assetPath: string, pptxPackage: PptxPackage, assets: Record<string, Asset>) {
  const existing = Object.values(assets).find((asset) => asset.fileName === assetPath.split('/').at(-1));
  if (existing) return existing;
  const fileIndex = pptxPackage.files.findIndex((item) => item.path === assetPath);
  const file = pptxPackage.getFile(assetPath);
  if (!file) return undefined;
  const asset = createAsset(file, fileIndex, pptxPackage);
  if (!asset) return undefined;
  assets[asset.id] = asset;
  return asset;
}

function getTextLineUnits(line: string) {
  return Array.from(line).reduce((width, character) => {
    if (/\s/.test(character)) return width + 0.36;
    if (/[ilI.,'|!]/.test(character)) return width + 0.34;
    if (/[MW@#%&]/.test(character)) return width + 0.92;
    if (/[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(character)) return width + 0.74;
    return width + 0.62;
  }, 0);
}

function getTextLines(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd());
  return lines.length > 0 ? lines : [''];
}

function clampFrameStart(start: number, size: number, pageSize: number) {
  if (size >= pageSize) return 0;
  return Math.min(Math.max(0, start), pageSize - size);
}

function getInsetTextFrame(object: Extract<PptxSlideObject, { kind: 'text' }>) {
  const horizontalInsets = object.textBox.insets.left + object.textBox.insets.right;
  const verticalInsets = object.textBox.insets.top + object.textBox.insets.bottom;
  const x = object.frame.x + object.textBox.insets.left - TEXT_FRAME_FIT.canvasPadding;
  const y = object.frame.y + object.textBox.insets.top - TEXT_FRAME_FIT.canvasPadding;
  const width = object.frame.width - horizontalInsets + TEXT_FRAME_FIT.canvasPadding * 2;
  const height = object.frame.height - verticalInsets + TEXT_FRAME_FIT.canvasPadding * 2;
  return {
    x,
    y,
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

function getHorizontallyAnchoredX(
  object: Extract<PptxSlideObject, { kind: 'text' }>,
  frame: ReturnType<typeof getInsetTextFrame>,
  width: number,
  pageWidth: number,
) {
  if (object.style.align === 'center') {
    return clampFrameStart(frame.x + frame.width / 2 - width / 2, width, pageWidth);
  }
  if (object.style.align === 'right') {
    return clampFrameStart(frame.x + frame.width - width, width, pageWidth);
  }
  return clampFrameStart(frame.x, width, pageWidth);
}

function getVerticallyAnchoredY(
  object: Extract<PptxSlideObject, { kind: 'text' }>,
  frame: ReturnType<typeof getInsetTextFrame>,
  height: number,
  pageHeight: number,
) {
  if (object.textBox.verticalAlign === 'middle') {
    return clampFrameStart(frame.y + frame.height / 2 - height / 2, height, pageHeight);
  }
  if (object.textBox.verticalAlign === 'bottom') {
    return clampFrameStart(frame.y + frame.height - height, height, pageHeight);
  }
  return clampFrameStart(frame.y, height, pageHeight);
}

function getFittedTextFrame(
  object: Extract<PptxSlideObject, { kind: 'text' }>,
  pageWidth: number,
  pageHeight: number,
) {
  const frame = getInsetTextFrame(object);
  const lines = getTextLines(object.text);
  const longestLineUnits = Math.max(...lines.map(getTextLineUnits), 1);
  const preferredWidth = Math.ceil(
    longestLineUnits * object.style.fontSize * TEXT_FRAME_FIT.averageCharacterWidth +
      object.style.fontSize * TEXT_FRAME_FIT.horizontalPaddingRatio,
  );
  const width = Math.min(pageWidth, Math.max(frame.width, preferredWidth));
  const x = getHorizontallyAnchoredX(object, frame, width, pageWidth);

  const contentWidth = Math.max(
    object.style.fontSize,
    width - object.style.fontSize * TEXT_FRAME_FIT.horizontalPaddingRatio,
  );
  const lineCapacity = Math.max(
    1,
    contentWidth / (object.style.fontSize * TEXT_FRAME_FIT.averageCharacterWidth),
  );
  const visualLineCount = lines.reduce(
    (count, line) => count + Math.max(1, Math.ceil(getTextLineUnits(line) / lineCapacity)),
    0,
  );
  const fittedHeight = Math.ceil(
    visualLineCount * object.style.fontSize * object.style.lineHeight +
      object.style.fontSize * TEXT_FRAME_FIT.heightPaddingRatio,
  );
  let height =
    frame.height > fittedHeight * TEXT_FRAME_FIT.shrinkOversizedHeightRatio
      ? fittedHeight
      : Math.max(frame.height, fittedHeight);
  height = Math.min(pageHeight, height);
  const y = getVerticallyAnchoredY(object, frame, height, pageHeight);

  return {
    height,
    width,
    x,
    y,
  };
}

function mapObject(
  object: PptxSlideObject,
  pptxPackage: PptxPackage,
  assets: Record<string, Asset>,
  warnings: ImportWarning[],
  pageId: string,
  pageWidth: number,
  pageHeight: number,
  layoutId?: string,
): DesignElement | undefined {
  if (object.kind === 'text') {
    const frame = getFittedTextFrame(object, pageWidth, pageHeight);
    return {
      id: object.id,
      type: 'text',
      text: object.text,
      ...frame,
      rotation: object.rotation ?? 0,
      locked: false,
      visible: true,
      opacity: object.opacity ?? 1,
      ...(layoutId ? { templateSource: { layoutId, type: 'layout' as const } } : {}),
      ...(object.placeholderRole ? { placeholderRole: object.placeholderRole } : {}),
      ...object.style,
    };
  }
  if (object.kind === 'shape') {
    return {
      id: object.id,
      type: 'shape',
      ...object.frame,
      rotation: object.rotation ?? 0,
      locked: false,
      visible: true,
      opacity: object.opacity ?? 1,
      ...(layoutId ? { templateSource: { layoutId, type: 'layout' as const } } : {}),
      ...(object.placeholderRole ? { placeholderRole: object.placeholderRole } : {}),
      shape: object.shape,
      ...(object.fill ? { fill: object.fill } : {}),
      ...(object.stroke ? { stroke: object.stroke } : {}),
      ...(object.strokeWidth !== undefined ? { strokeWidth: object.strokeWidth } : {}),
      ...(object.startEndpoint ? { startEndpoint: object.startEndpoint } : {}),
      ...(object.endEndpoint ? { endEndpoint: object.endEndpoint } : {}),
    };
  }
  const asset = getOrCreateAsset(object.assetPath, pptxPackage, assets);
  if (!asset) {
    warnings.push({
      code: 'pptx-missing-asset',
      message: `Referenced PowerPoint asset was not found: ${object.assetPath}`,
      pageId,
      severity: 'warning',
    });
    return undefined;
  }
  const base = {
    id: object.id,
    assetId: asset.id,
    ...object.frame,
    rotation: object.rotation ?? 0,
    locked: false,
    visible: true,
    opacity: object.opacity ?? 1,
    ...(layoutId ? { templateSource: { layoutId, type: 'layout' as const } } : {}),
    ...(object.placeholderRole ? { placeholderRole: object.placeholderRole } : {}),
  };
  if (object.kind === 'video') {
    return {
      ...base,
      type: 'video',
      loop: false,
      controls: true,
      muted: false,
      autoplayInPreview: true,
      startOnClick: object.startTrigger === 'on-click',
      trimStartSeconds: 0,
    };
  }
  if (object.kind === 'gif') return { ...base, type: 'gif', playing: true };
  return { ...base, type: 'image' };
}

const defaultPlaceholderVisibility: Record<PlaceholderRole, boolean> = {
  body: true,
  footer: true,
  slideNumber: true,
  title: true,
};

function createLayout(
  layout: PptxLayout,
  pptxPackage: PptxPackage,
  assets: Record<string, Asset>,
  warnings: ImportWarning[],
  pageWidth: number,
  pageHeight: number,
): SlideLayout | undefined {
  const elementIds: string[] = [];
  const elements: Record<string, DesignElement> = {};
  for (const object of layout.objects.sort((left, right) => left.zIndex - right.zIndex)) {
    const element = mapObject(
      object,
      pptxPackage,
      assets,
      warnings,
      layout.id,
      pageWidth,
      pageHeight,
      layout.id,
    );
    if (!element) continue;
    elements[element.id] = element;
    elementIds.push(element.id);
  }
  return {
    id: layout.id,
    name: layout.name,
    background: { type: 'color', color: layout.backgroundColor },
    elementIds,
    elements,
    placeholderRoles: layout.placeholderRoles,
    placeholderVisibility: defaultPlaceholderVisibility,
  };
}

function createSlideFallbackLayout(
  slide: PptxDeck['slides'][number],
  pptxPackage: PptxPackage,
  assets: Record<string, Asset>,
  warnings: ImportWarning[],
  pageWidth: number,
  pageHeight: number,
): SlideLayout | undefined {
  if (!slide.layoutId) return undefined;
  return createLayout(
    {
      backgroundColor: slide.backgroundColor,
      id: slide.layoutId,
      name: slide.layoutName ?? slide.layoutId,
      objects: slide.layoutObjects,
      placeholderRoles: slide.placeholderRoles,
      sourcePath: slide.layoutId,
    },
    pptxPackage,
    assets,
    warnings,
    pageWidth,
    pageHeight,
  );
}

function map(deck: PptxDeck, pptxPackage: PptxPackage): ProjectDocument {
  const now = new Date().toISOString();
  const assets: Record<string, Asset> = {};
  const elements: Record<string, DesignElement> = {};
  const warnings: ImportWarning[] = [...deck.warnings];
  const slideLayouts: Record<string, SlideLayout> = {};
  for (const layout of deck.layouts) {
    const mappedLayout = createLayout(layout, pptxPackage, assets, warnings, deck.width, deck.height);
    if (mappedLayout) slideLayouts[mappedLayout.id] = mappedLayout;
  }
  const pages: Page[] = deck.slides.map((slide) => {
    const elementIds: string[] = [];
    const layout = slide.layoutId && slideLayouts[slide.layoutId]
      ? undefined
      : createSlideFallbackLayout(slide, pptxPackage, assets, warnings, deck.width, deck.height);
    if (layout) slideLayouts[layout.id] = layout;
    for (const object of slide.objects.sort((left, right) => left.zIndex - right.zIndex)) {
      const element = mapObject(object, pptxPackage, assets, warnings, slide.id, deck.width, deck.height);
      if (!element) continue;
      elements[element.id] = element;
      elementIds.push(element.id);
    }
    return {
      id: slide.id,
      name: slide.name,
      width: deck.width,
      height: deck.height,
      background: { type: 'color', color: slide.backgroundColor },
      elementIds,
      transition: { effect: slide.transitionEffect, delayMs: 0, durationMs: 500 },
      ...(slide.layoutId ? { layoutId: slide.layoutId } : {}),
      ...(slide.animationBuilds.length > 0
        ? {
            animationBuilds: slide.animationBuilds.filter((build) =>
              elementIds.includes(build.elementId),
            ),
          }
        : {}),
      ...(slide.speakerNotes ? { speakerNotes: slide.speakerNotes } : {}),
      visible: true,
    };
  });
  return {
    id: `pptx-project-${Date.now().toString(36)}`,
    name: deck.name,
    createdAt: now,
    updatedAt: now,
    assets,
    elements,
    pages,
    ...(Object.keys(slideLayouts).length > 0 ? { slideLayouts } : {}),
    ...(warnings.length > 0 ? { importWarnings: warnings } : {}),
  };
}

export const pptxProjectMapper = {
  map,
};
