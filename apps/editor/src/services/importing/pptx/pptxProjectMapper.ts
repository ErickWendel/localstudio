import type { Asset, DesignElement, ImportWarning, Page, ProjectDocument } from '../../../domain/documents/model';
import { pptxFileUtils } from './pptxFileUtils';
import type { PptxPackageFile } from './pptxPackageTypes';
import type { PptxDeck, PptxSlideObject } from './pptxParser';

const TEXT_FRAME_FIT = {
  averageCharacterWidth: 0.9,
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

function getFittedTextFrame(
  object: Extract<PptxSlideObject, { kind: 'text' }>,
  pageWidth: number,
  pageHeight: number,
) {
  const lines = getTextLines(object.text);
  const longestLineUnits = Math.max(...lines.map(getTextLineUnits), 1);
  const preferredWidth = Math.ceil(
    longestLineUnits * object.style.fontSize * TEXT_FRAME_FIT.averageCharacterWidth +
      object.style.fontSize * TEXT_FRAME_FIT.horizontalPaddingRatio,
  );
  let width = Math.max(object.frame.width, preferredWidth);
  let x = object.frame.x;
  if (width > pageWidth) {
    width = pageWidth;
    x = 0;
  } else if (x + width > pageWidth) {
    x = Math.max(0, pageWidth - width);
  }

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
    visualLineCount * object.style.fontSize * TEXT_FRAME_FIT.lineHeightRatio +
      object.style.fontSize * TEXT_FRAME_FIT.heightPaddingRatio,
  );
  let height =
    object.frame.height > fittedHeight * TEXT_FRAME_FIT.shrinkOversizedHeightRatio
      ? fittedHeight
      : Math.max(object.frame.height, fittedHeight);
  let y = object.frame.y;
  if (height > pageHeight) {
    height = pageHeight;
    y = 0;
  } else if (y + height > pageHeight) {
    y = Math.max(0, pageHeight - height);
  }

  return {
    ...object.frame,
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
      ...object.style,
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
  };
  if (object.kind === 'video') {
    return {
      ...base,
      type: 'video',
      loop: false,
      controls: true,
      muted: false,
      autoplayInPreview: false,
      trimStartSeconds: 0,
    };
  }
  if (object.kind === 'gif') return { ...base, type: 'gif', playing: true };
  return { ...base, type: 'image' };
}

function map(deck: PptxDeck, files: PptxPackageFile[]): ProjectDocument {
  const now = new Date().toISOString();
  const assets: Record<string, Asset> = {};
  const elements: Record<string, DesignElement> = {};
  const warnings: ImportWarning[] = [];
  const pages: Page[] = deck.slides.map((slide) => {
    const elementIds: string[] = [];
    for (const object of slide.objects.sort((left, right) => left.zIndex - right.zIndex)) {
      const element = mapObject(object, files, assets, warnings, slide.id, deck.width, deck.height);
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
    ...(warnings.length > 0 ? { importWarnings: warnings } : {}),
  };
}

export const pptxProjectMapper = {
  map,
};
