import type {
  Asset,
  CropRect,
  DesignElement,
  ImportWarning,
  Page,
  PlaceholderRole,
  ProjectDocument,
  SlideLayout,
} from '../../../domain/documents/model';
import { pptxFileUtils } from './pptxFileUtils';
import type { PptxPackage } from './pptxPackage';
import type { PptxDeck, PptxLayout, PptxSlideObject } from './pptx-parser-model';

const TEXT_FRAME_FIT = {
  averageCharacterWidth: 0.9,
  canvasPadding: 6,
  heightPaddingRatio: 0.4,
  horizontalPaddingRatio: 1.2,
  lineHeightRatio: 1.35,
  minimumAutoFitFontSize: 8,
  shrinkOversizedHeightRatio: 1.8,
};

const IMAGE_FIT = {
  aspectRatioTolerance: 0.03,
};

const TEXT_CONTRAST = {
  minimumRatio: 2,
};

function parseHexChannel(value: string, start: number) {
  return Number.parseInt(value.slice(start, start + 2), 16);
}

function getRelativeLuminance(color: string) {
  const normalized = color.replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return undefined;
  const channels = [
    parseHexChannel(normalized, 0),
    parseHexChannel(normalized, 2),
    parseHexChannel(normalized, 4),
  ] as const;
  const [red, green, blue] = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function getContrastRatio(firstColor: string, secondColor: string) {
  const firstLuminance = getRelativeLuminance(firstColor);
  const secondLuminance = getRelativeLuminance(secondColor);
  if (firstLuminance === undefined || secondLuminance === undefined) return Number.POSITIVE_INFINITY;
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function getReadableTextFill(fill: string, backgroundColor: string) {
  if (getContrastRatio(fill, backgroundColor) >= TEXT_CONTRAST.minimumRatio) return fill;
  return getContrastRatio('#FFFFFF', backgroundColor) >= getContrastRatio('#000000', backgroundColor)
    ? '#FFFFFF'
    : '#000000';
}

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

function getAutoFitTextFrame(
  object: Extract<PptxSlideObject, { kind: 'text' }>,
  pageWidth: number,
  pageHeight: number,
) {
  const frame = getInsetTextFrame(object);
  return {
    height: Math.min(pageHeight, frame.height),
    width: Math.min(pageWidth, frame.width),
    x: clampFrameStart(frame.x, frame.width, pageWidth),
    y: getVerticallyAnchoredY(object, frame, Math.min(pageHeight, frame.height), pageHeight),
  };
}

function getBoundedTextFrame(
  object: Extract<PptxSlideObject, { kind: 'text' }>,
  pageWidth: number,
  pageHeight: number,
  fontSize = object.style.fontSize,
) {
  const frame = getFixedTextFrame(object, pageWidth, pageHeight);
  const visualLineCount = getVisualLineCount(object.text, frame.width, fontSize);
  const fittedHeight = Math.ceil(
    visualLineCount * fontSize * object.style.lineHeight +
      fontSize * TEXT_FRAME_FIT.heightPaddingRatio,
  );
  const height =
    frame.height > fittedHeight * TEXT_FRAME_FIT.shrinkOversizedHeightRatio
      ? fittedHeight
      : frame.height;
  const insetFrame = getInsetTextFrame(object);
  return {
    ...frame,
    height,
    y: getVerticallyAnchoredY(object, insetFrame, height, pageHeight),
  };
}

function getFixedTextFrame(
  object: Extract<PptxSlideObject, { kind: 'text' }>,
  pageWidth: number,
  pageHeight: number,
) {
  const frame = getInsetTextFrame(object);
  const width = Math.min(pageWidth, frame.width);
  const height = Math.min(pageHeight, frame.height);
  return {
    height,
    width,
    x: clampFrameStart(frame.x, width, pageWidth),
    y: clampFrameStart(frame.y, height, pageHeight),
  };
}

function getVisualLineCount(text: string, width: number, fontSize: number) {
  const contentWidth = Math.max(
    fontSize,
    width - fontSize * TEXT_FRAME_FIT.horizontalPaddingRatio,
  );
  const lineCapacity = Math.max(
    1,
    contentWidth / (fontSize * TEXT_FRAME_FIT.averageCharacterWidth),
  );
  return getTextLines(text).reduce(
    (count, line) => count + Math.max(1, Math.ceil(getTextLineUnits(line) / lineCapacity)),
    0,
  );
}

function textFitsFrame(
  object: Extract<PptxSlideObject, { kind: 'text' }>,
  frame: ReturnType<typeof getAutoFitTextFrame>,
  fontSize: number,
) {
  const visualLineCount = getVisualLineCount(object.text, frame.width, fontSize);
  const fittedHeight = Math.ceil(
    visualLineCount * fontSize * object.style.lineHeight +
      fontSize * TEXT_FRAME_FIT.heightPaddingRatio,
  );
  return fittedHeight <= frame.height;
}

function getAutoFitFontSize(
  object: Extract<PptxSlideObject, { kind: 'text' }>,
  pageWidth: number,
  pageHeight: number,
) {
  const shouldFitText =
    object.textBox.autoFit === 'shrink-text' ||
    (object.placeholderRole !== undefined && object.style.fontSize >= 128);
  if (!shouldFitText) return object.style.fontSize;
  const frame =
    object.textBox.autoFit === 'shrink-text'
      ? getAutoFitTextFrame(object, pageWidth, pageHeight)
      : getFixedTextFrame(object, pageWidth, pageHeight);
  if (textFitsFrame(object, frame, object.style.fontSize)) return object.style.fontSize;
  let lower = TEXT_FRAME_FIT.minimumAutoFitFontSize;
  let upper = object.style.fontSize;
  while (lower < upper) {
    const candidate = Math.ceil((lower + upper) / 2);
    if (textFitsFrame(object, frame, candidate)) {
      lower = candidate;
    } else {
      upper = candidate - 1;
    }
  }
  return lower;
}

function roundCrop(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function getCoverCrop(
  object: Extract<PptxSlideObject, { kind: 'image' | 'gif' | 'video' }>,
  pptxPackage: PptxPackage,
): CropRect | undefined {
  if (object.kind !== 'image') return undefined;
  if (object.crop) return object.crop;
  const imageSize = pptxPackage.getFile(object.assetPath)?.imageSize;
  if (!imageSize) return undefined;
  const sourceRatio = imageSize.width / imageSize.height;
  const frameRatio = object.frame.width / object.frame.height;
  if (
    !Number.isFinite(sourceRatio) ||
    !Number.isFinite(frameRatio) ||
    Math.abs(sourceRatio - frameRatio) <= IMAGE_FIT.aspectRatioTolerance
  ) {
    return undefined;
  }
  if (sourceRatio > frameRatio) {
    const width = frameRatio / sourceRatio;
    return {
      x: roundCrop((1 - width) / 2),
      y: 0,
      width: roundCrop(width),
      height: 1,
    };
  }
  const height = sourceRatio / frameRatio;
  return {
    x: 0,
    y: roundCrop((1 - height) / 2),
    width: 1,
    height: roundCrop(height),
  };
}

function getImportSource(object: PptxSlideObject, pageId: string, layoutId?: string) {
  return {
    format: 'pptx' as const,
    pageId,
    shapeId: object.sourceShapeId,
    source: object.source,
    ...(layoutId ? { layoutId } : {}),
    ...(object.placeholderIndex ? { placeholderIndex: object.placeholderIndex } : {}),
    ...(object.placeholderRole ? { placeholderRole: object.placeholderRole } : {}),
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
  backgroundColor: string,
  layoutId?: string,
): DesignElement | undefined {
  if (object.kind === 'text') {
    const { capitalization, ...style } = object.style;
    void capitalization;
    const fontSize = getAutoFitFontSize(object, pageWidth, pageHeight);
    const frame =
      object.textBox.autoFit === 'shrink-text'
        ? getAutoFitTextFrame(object, pageWidth, pageHeight)
        : object.placeholderRole
          ? getFixedTextFrame(object, pageWidth, pageHeight)
          : getBoundedTextFrame(object, pageWidth, pageHeight, fontSize);
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
      importSource: getImportSource(object, pageId, layoutId),
      ...style,
      fill: getReadableTextFill(style.fill, backgroundColor),
      fontSize,
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
      importSource: getImportSource(object, pageId, layoutId),
      shape: object.shape,
      ...(object.fill ? { fill: object.fill } : {}),
      ...(object.stroke ? { stroke: object.stroke } : {}),
      ...(object.strokeWidth !== undefined ? { strokeWidth: object.strokeWidth } : {}),
      ...(object.startEndpoint ? { startEndpoint: object.startEndpoint } : {}),
      ...(object.endEndpoint ? { endEndpoint: object.endEndpoint } : {}),
    };
  }
  if (object.placeholderOnly) return undefined;
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
    importSource: getImportSource(object, pageId, layoutId),
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
  const crop = getCoverCrop(object, pptxPackage);
  return {
    ...base,
    type: 'image',
    ...(crop ? { crop } : {}),
  };
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
      layout.backgroundColor,
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
      const element = mapObject(
        object,
        pptxPackage,
        assets,
        warnings,
        slide.id,
        deck.width,
        deck.height,
        slide.backgroundColor,
      );
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
      visible: slide.visible,
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
