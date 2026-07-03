import type { AnimationEffect } from '../../../domain/documents/model';
import { pptxFileUtils } from './pptxFileUtils';
import type { PptxPackageFile } from './pptxPackageTypes';
import { pptxXml } from './pptxXml';

export interface PptxRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface PptxTextStyle {
  align: 'left' | 'center' | 'right';
  fill: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
}

export type PptxSlideObject =
  | {
      frame: PptxRect;
      id: string;
      kind: 'text';
      style: PptxTextStyle;
      text: string;
      zIndex: number;
    }
  | {
      assetPath: string;
      frame: PptxRect;
      id: string;
      kind: 'image' | 'gif' | 'video';
      zIndex: number;
    };

export interface PptxSlide {
  backgroundColor: string;
  id: string;
  name: string;
  objects: PptxSlideObject[];
  transitionEffect: AnimationEffect;
}

export interface PptxDeck {
  height: number;
  name: string;
  slides: PptxSlide[];
  width: number;
}

interface Relationship {
  id: string;
  target: string;
  type: string;
}

const DEFAULT_PAGE_WIDTH = 1920;
const DEFAULT_PAGE_HEIGHT = 1080;
const DEFAULT_TEXT_STYLE: PptxTextStyle = {
  align: 'left',
  fill: '#ffffff',
  fontFamily: 'Open Sans',
  fontSize: 32,
  fontWeight: 400,
};

async function readText(file: PptxPackageFile | undefined) {
  if (!file) return undefined;
  return file.blob.text();
}

function findFile(files: PptxPackageFile[], path: string) {
  return files.find((file) => file.path === path);
}

function relsPathFor(sourcePath: string) {
  const parts = sourcePath.split('/');
  const fileName = parts.pop() ?? '';
  return `${parts.join('/')}/_rels/${fileName}.rels`;
}

function parseRelationships(xml: string | undefined, sourcePath: string) {
  if (!xml) return new Map<string, Relationship>();
  const document = pptxXml.parseXml(xml);
  const relationships = new Map<string, Relationship>();
  for (const element of pptxXml.descendants(document, 'Relationship')) {
    const id = element.getAttribute('Id');
    const type = element.getAttribute('Type');
    const target = element.getAttribute('Target');
    if (!id || !type || !target) continue;
    relationships.set(id, {
      id,
      type,
      target: target.startsWith('http') ? target : pptxFileUtils.resolveRelativePath(sourcePath, target),
    });
  }
  return relationships;
}

function getPresentationSize(document: Document) {
  const size = pptxXml.firstDescendant(document, 'sldSz');
  const cx = Number(size?.getAttribute('cx'));
  const cy = Number(size?.getAttribute('cy'));
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || cx <= 0 || cy <= 0) {
    return { width: DEFAULT_PAGE_WIDTH, height: DEFAULT_PAGE_HEIGHT, scaleX: 1, scaleY: 1 };
  }
  const width = DEFAULT_PAGE_WIDTH;
  const height = Math.round((cy / cx) * width);
  return {
    width,
    height,
    scaleX: width / cx,
    scaleY: height / cy,
  };
}

function localShapeId(element: Element, fallback: string) {
  const nonVisual = pptxXml.firstDescendant(element, 'cNvPr');
  return nonVisual?.getAttribute('id') ?? fallback;
}

function parseFrame(element: Element, scaleX: number, scaleY: number): PptxRect | undefined {
  const transform = pptxXml.firstDescendant(element, 'xfrm');
  const offset = transform ? pptxXml.firstDescendant(transform, 'off') : undefined;
  const extent = transform ? pptxXml.firstDescendant(transform, 'ext') : undefined;
  const x = Number(offset?.getAttribute('x'));
  const y = Number(offset?.getAttribute('y'));
  const width = Number(extent?.getAttribute('cx'));
  const height = Number(extent?.getAttribute('cy'));
  if (![x, y, width, height].every(Number.isFinite)) return undefined;
  return {
    x: Math.round(x * scaleX),
    y: Math.round(y * scaleY),
    width: Math.max(1, Math.round(width * scaleX)),
    height: Math.max(1, Math.round(height * scaleY)),
  };
}

function getHexColor(element: ParentNode | undefined, fallback: string) {
  if (!element) return fallback;
  const color = pptxXml.firstDescendant(element, 'srgbClr')?.getAttribute('val');
  return color ? `#${color}` : fallback;
}

function hasPlaceholder(shape: Element) {
  return Boolean(pptxXml.firstDescendant(shape, 'ph'));
}

function getTypeface(runProperties: Element | undefined, defaultRunProperties: Element | undefined) {
  return (
    (runProperties ? pptxXml.firstDescendant(runProperties, 'latin')?.getAttribute('typeface') : undefined) ??
    (defaultRunProperties
      ? pptxXml.firstDescendant(defaultRunProperties, 'latin')?.getAttribute('typeface')
      : undefined)
  );
}

function getTextStyle(shape: Element): PptxTextStyle {
  const paragraphProperties = pptxXml.firstDescendant(shape, 'pPr');
  const runProperties = pptxXml.firstDescendant(shape, 'rPr');
  const defaultRunProperties = pptxXml.firstDescendant(shape, 'defRPr');
  const align = paragraphProperties?.getAttribute('algn');
  const size = Number(
    runProperties?.getAttribute('sz') ??
      (!runProperties ? defaultRunProperties?.getAttribute('sz') : undefined),
  );
  const font = getTypeface(runProperties, defaultRunProperties);
  const bold =
    runProperties?.getAttribute('b') === '1' || defaultRunProperties?.getAttribute('b') === '1';
  return {
    align: align === 'ctr' ? 'center' : align === 'r' ? 'right' : 'left',
    fill: getHexColor(runProperties ?? defaultRunProperties ?? shape, DEFAULT_TEXT_STYLE.fill),
    fontFamily: font && !font.startsWith('+') ? font : DEFAULT_TEXT_STYLE.fontFamily,
    fontSize: Number.isFinite(size) && size > 0 ? Math.max(8, Math.round((size / 100) * 1.333)) : DEFAULT_TEXT_STYLE.fontSize,
    fontWeight: bold ? 700 : DEFAULT_TEXT_STYLE.fontWeight,
  };
}

function getTextParagraphs(shape: Element) {
  const body = pptxXml.firstDescendant(shape, 'txBody');
  const paragraphs = body ? pptxXml.descendants(body, 'p') : [];
  return paragraphs
    .map((paragraph) => pptxXml.textContent(paragraph, 't').replace(/[ \t\r\f\v]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function parseTextObject(
  shape: Element,
  slideId: string,
  zIndex: number,
  scaleX: number,
  scaleY: number,
  idScope = 'slide',
): PptxSlideObject | undefined {
  const text = getTextParagraphs(shape);
  if (!text) return undefined;
  const frame = parseFrame(shape, scaleX, scaleY);
  if (!frame) return undefined;
  return {
    frame,
    id: `${slideId}-${idScope}-text-${localShapeId(shape, String(zIndex))}`,
    kind: 'text',
    style: getTextStyle(shape),
    text,
    zIndex,
  };
}

function getRelationshipTarget(
  relationships: Map<string, Relationship>,
  id: string | null | undefined,
) {
  return id ? relationships.get(id)?.target : undefined;
}

function parsePictureObject(
  picture: Element,
  slideId: string,
  zIndex: number,
  scaleX: number,
  scaleY: number,
  relationships: Map<string, Relationship>,
  idScope = 'slide',
): PptxSlideObject | undefined {
  const frame = parseFrame(picture, scaleX, scaleY);
  if (!frame) return undefined;
  const videoRelId =
    pptxXml.firstDescendant(picture, 'videoFile')?.getAttribute('r:link') ??
    pptxXml.firstDescendant(picture, 'media')?.getAttribute('r:embed');
  const imageRelId = pptxXml.firstDescendant(picture, 'blip')?.getAttribute('r:embed');
  const assetPath = getRelationshipTarget(relationships, videoRelId) ?? getRelationshipTarget(relationships, imageRelId);
  if (!assetPath) return undefined;
  const mimeType = pptxFileUtils.getMimeType(assetPath);
  const assetType = pptxFileUtils.getAssetType(assetPath, mimeType);
  if (!assetType) return undefined;
  return {
    assetPath,
    frame,
    id: `${slideId}-${idScope}-${assetType}-${localShapeId(picture, String(zIndex))}`,
    kind: assetType,
    zIndex,
  };
}

function getBackgroundColor(document: Document, fallback = '#000000') {
  const background = pptxXml.firstDescendant(document, 'bgPr');
  return getHexColor(background, fallback);
}

function getTransitionEffect(document: Document): AnimationEffect {
  const transition = pptxXml.firstDescendant(document, 'transition');
  if (!transition) return 'dissolve';
  if (pptxXml.firstDescendant(transition, 'fade')) return 'fade';
  if (pptxXml.firstDescendant(transition, 'push')) return 'push';
  if (pptxXml.firstDescendant(transition, 'wipe')) return 'wipe';
  return 'dissolve';
}

async function parseInheritedObjects(
  files: PptxPackageFile[],
  sourcePath: string | undefined,
  slideId: string,
  scaleX: number,
  scaleY: number,
  idScope: 'layout' | 'master',
) {
  if (!sourcePath) return [];
  const xml = await readText(findFile(files, sourcePath));
  if (!xml) return [];
  const document = pptxXml.parseXml(xml);
  const rels = parseRelationships(await readText(findFile(files, relsPathFor(sourcePath))), sourcePath);
  const tree = pptxXml.firstDescendant(document, 'spTree');
  const objects: PptxSlideObject[] = [];
  if (tree) {
    for (const child of pptxXml.childElements(tree)) {
      if (child.localName === 'sp' && !hasPlaceholder(child)) {
        const object = parseTextObject(child, slideId, objects.length, scaleX, scaleY, idScope);
        if (object) objects.push(object);
      }
      if (child.localName === 'pic') {
        const object = parsePictureObject(child, slideId, objects.length, scaleX, scaleY, rels, idScope);
        if (object) objects.push(object);
      }
    }
  }
  return objects;
}

function findRelationshipByType(relationships: Map<string, Relationship>, typeSuffix: string) {
  return Array.from(relationships.values()).find((relationship) =>
    relationship.type.endsWith(typeSuffix),
  );
}

async function parseSlide(
  files: PptxPackageFile[],
  slidePath: string,
  slideIndex: number,
  scaleX: number,
  scaleY: number,
) {
  const xml = await readText(findFile(files, slidePath));
  if (!xml) throw new Error(`PowerPoint slide is missing: ${slidePath}`);
  const document = pptxXml.parseXml(xml);
  const rels = parseRelationships(await readText(findFile(files, relsPathFor(slidePath))), slidePath);
  const slideId = `pptx-page-${slideIndex + 1}`;
  const layoutPath = findRelationshipByType(rels, '/slideLayout')?.target;
  const layoutRels = parseRelationships(
    await readText(findFile(files, layoutPath ? relsPathFor(layoutPath) : '')),
    layoutPath ?? slidePath,
  );
  const masterPath = findRelationshipByType(layoutRels, '/slideMaster')?.target;
  const masterObjects = await parseInheritedObjects(files, masterPath, slideId, scaleX, scaleY, 'master');
  const layoutObjects = await parseInheritedObjects(files, layoutPath, slideId, scaleX, scaleY, 'layout');
  const tree = pptxXml.firstDescendant(document, 'spTree');
  const inheritedObjects = [...masterObjects, ...layoutObjects];
  const objects: PptxSlideObject[] = inheritedObjects.map((object, index) => ({
    ...object,
    zIndex: index,
  }));
  if (tree) {
    for (const child of pptxXml.childElements(tree)) {
      if (child.localName === 'sp') {
        const object = parseTextObject(child, slideId, objects.length, scaleX, scaleY);
        if (object) objects.push(object);
      }
      if (child.localName === 'pic') {
        const object = parsePictureObject(child, slideId, objects.length, scaleX, scaleY, rels);
        if (object) objects.push(object);
      }
    }
  }
  return {
    backgroundColor: getBackgroundColor(document),
    id: slideId,
    name: `Slide ${slideIndex + 1}`,
    objects,
    transitionEffect: getTransitionEffect(document),
  };
}

function normalizeName(name: string) {
  return name.replace(/\.pptx$/i, '').trim() || 'Imported PowerPoint';
}

async function parse(files: PptxPackageFile[], name: string): Promise<PptxDeck> {
  const presentationXml = await readText(findFile(files, 'ppt/presentation.xml'));
  if (!presentationXml) throw new Error('PowerPoint package is missing ppt/presentation.xml.');
  const presentation = pptxXml.parseXml(presentationXml);
  const presentationRelationships = parseRelationships(
    await readText(findFile(files, 'ppt/_rels/presentation.xml.rels')),
    'ppt/presentation.xml',
  );
  const size = getPresentationSize(presentation);
  const slidePaths = pptxXml
    .descendants(presentation, 'sldId')
    .map((slide) => presentationRelationships.get(slide.getAttribute('r:id') ?? '')?.target)
    .filter((path): path is string => Boolean(path));
  if (slidePaths.length === 0) throw new Error('PowerPoint package does not contain slides.');
  return {
    height: size.height,
    name: normalizeName(name),
    slides: await Promise.all(
      slidePaths.map((slidePath, index) => parseSlide(files, slidePath, index, size.scaleX, size.scaleY)),
    ),
    width: size.width,
  };
}

export const pptxParser = {
  parse,
};
