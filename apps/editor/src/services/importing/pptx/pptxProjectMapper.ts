import type {
  Asset,
  DesignElement,
  ImportWarning,
  Page,
  PresentationTheme,
  ProjectDocument,
  SlideLayout,
} from '../../../domain/documents/model';
import { pptxFileUtils } from './pptxFileUtils';
import type { PptxPackageFile } from './pptxPackageTypes';
import type { PptxDeck, PptxSlideObject } from './pptxParser';

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

function createAsset(file: PptxPackageFile, index: number): Asset | undefined {
  const mimeType = pptxFileUtils.getMimeType(file.path, file.blob.type);
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

function getOrCreateAsset(assetPath: string, files: PptxPackageFile[], assets: Record<string, Asset>) {
  const existing = Object.values(assets).find((asset) => asset.fileName === assetPath.split('/').at(-1));
  if (existing) return existing;
  const fileIndex = files.findIndex((file) => file.path === assetPath);
  const file = files[fileIndex];
  if (!file) return undefined;
  const asset = createAsset(file, fileIndex);
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
  files: PptxPackageFile[],
  assets: Record<string, Asset>,
  warnings: ImportWarning[],
  pageId: string,
  pageWidth: number,
  pageHeight: number,
): DesignElement | undefined {
  if (object.kind === 'text') {
    const frame = getFittedTextFrame(object, pageWidth, pageHeight);
    return {
      id: object.id,
      type: 'text',
      text: object.text,
      ...frame,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      ...(object.source === 'layout' || object.source === 'master'
        ? { templateSource: { type: 'layout' as const, layoutId: pageId } }
        : {}),
      ...object.style,
    };
  }
  if (object.kind === 'placeholder') {
    return {
      id: object.id,
      type: 'shape',
      shape: 'rect',
      ...object.frame,
      rotation: 0,
      locked: true,
      visible: true,
      opacity: 0.95,
      stroke: object.placeholderType === 'pic' || object.placeholderType === 'obj' ? '#36D7FF' : '#40493F',
      strokeWidth: 2,
      templateSource: { type: 'layout' as const, layoutId: pageId },
    };
  }
  const asset = getOrCreateAsset(object.assetPath, files, assets);
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
    rotation: 0,
    locked: false,
    visible: true,
    opacity: 1,
    ...(object.source === 'layout' || object.source === 'master'
      ? { templateSource: { type: 'layout' as const, layoutId: pageId } }
      : {}),
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

function createTheme(deck: PptxDeck): PresentationTheme {
  const firstSlide = deck.slides[0];
  const background = firstSlide?.backgroundColor ?? '#050D10';
  return {
    id: 'pptx-theme-1',
    name: `${deck.name} Theme`,
    palette: {
      background,
      text: '#FFFFFF',
      primary: '#37FD76',
      secondary: '#36D7FF',
      muted: '#91999D',
    },
    typography: {
      bodyFontFamily: 'Open Sans',
      displayFontFamily: 'Orbitron',
    },
    preview: { background, accents: ['#37FD76', '#36D7FF'] },
    source: 'pptx',
  };
}

function createLayoutPreview(elements: DesignElement[], background: string) {
  const accent = elements.find((element) => element.type === 'text')?.type === 'text'
    ? '#37FD76'
    : '#36D7FF';
  return { background, accents: [accent] };
}

function map(deck: PptxDeck, files: PptxPackageFile[]): ProjectDocument {
  const now = new Date().toISOString();
  const assets: Record<string, Asset> = {};
  const elements: Record<string, DesignElement> = {};
  const warnings: ImportWarning[] = [];
  const theme = createTheme(deck);
  const slideLayouts: Record<string, SlideLayout> = {};
  const pages: Page[] = deck.slides.map((slide) => {
    const elementIds: string[] = [];
    const layoutId = slide.layoutId ?? `${slide.id}-layout`;
    for (const object of slide.objects.sort((left, right) => left.zIndex - right.zIndex)) {
      const element = mapObject(object, files, assets, warnings, layoutId, deck.width, deck.height);
      if (!element) continue;
      elements[element.id] = element;
      elementIds.push(element.id);
    }
    const layoutElements = slide.layoutObjects
      .sort((left, right) => left.zIndex - right.zIndex)
      .map((object) => mapObject(object, files, assets, warnings, layoutId, deck.width, deck.height))
      .filter((element): element is DesignElement => Boolean(element));
    if (layoutElements.length > 0 || slide.layoutId) {
      slideLayouts[layoutId] = {
        id: layoutId,
        themeId: theme.id,
        name: slide.layoutName ?? slide.name,
        background: { type: 'color', color: slide.backgroundColor },
        elements: layoutElements,
        placeholderRoles: slide.placeholderRoles,
        preview: createLayoutPreview(layoutElements, slide.backgroundColor),
      };
    }
    return {
      id: slide.id,
      name: slide.name,
      ...(slide.layoutId ? { layoutId } : {}),
      width: deck.width,
      height: deck.height,
      background: { type: 'color', color: slide.backgroundColor },
      elementIds,
      transition: { effect: slide.transitionEffect, delayMs: 0, durationMs: 500 },
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
    themeId: theme.id,
    themeGallery: [theme.id],
    themes: { [theme.id]: theme },
    ...(Object.keys(slideLayouts).length > 0 ? { slideLayouts } : {}),
    createdAt: now,
    updatedAt: now,
    assets,
    elements,
    pages,
    ...(warnings.length > 0 ? { importWarnings: warnings } : {}),
  };
}

export const pptxProjectMapper = {
  map,
};
