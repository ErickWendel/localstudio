import type {
  AnimationEffect,
  AnimationTrigger,
  ElementAnimationBuild,
  ElementAnimationKind,
} from '../../../domain/documents/model';
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

export interface PptxTextInsets {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface PptxTextBox {
  insets: PptxTextInsets;
  verticalAlign: 'bottom' | 'middle' | 'top';
}

export type PptxSlideObject =
  | {
      frame: PptxRect;
      id: string;
      kind: 'text';
      sourceShapeId: string;
      style: PptxTextStyle;
      text: string;
      textBox: PptxTextBox;
      zIndex: number;
    }
  | {
      assetPath: string;
      frame: PptxRect;
      id: string;
      kind: 'image' | 'gif' | 'video';
      sourceShapeId: string;
      zIndex: number;
    };

export interface PptxSlide {
  backgroundColor: string;
  id: string;
  name: string;
  animationBuilds: ElementAnimationBuild[];
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
const EMUS_PER_POINT = 12700;
const DEFAULT_TEXT_INSETS_EMU = {
  bottom: 45720,
  left: 91440,
  right: 91440,
  top: 45720,
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

function getTypeface(...runProperties: Array<Element | undefined>) {
  for (const properties of runProperties) {
    const typeface = properties
      ? pptxXml.firstDescendant(properties, 'latin')?.getAttribute('typeface')
      : undefined;
    if (typeface) return typeface;
  }
  return undefined;
}

function getFirstParagraph(shape: Element) {
  const body = pptxXml.firstDescendant(shape, 'txBody');
  return body ? pptxXml.firstDescendant(body, 'p') : undefined;
}

function getFirstRunProperties(paragraph: Element | undefined) {
  const run = paragraph ? pptxXml.firstDescendant(paragraph, 'r') : undefined;
  return run ? pptxXml.firstDescendant(run, 'rPr') : undefined;
}

function getParagraphDefaultRunProperties(paragraphProperties: Element | undefined) {
  return paragraphProperties ? pptxXml.firstDescendant(paragraphProperties, 'defRPr') : undefined;
}

function getListDefaultRunProperties(shape: Element) {
  const listStyle = pptxXml.firstDescendant(shape, 'lstStyle');
  return listStyle ? pptxXml.firstDescendant(listStyle, 'defRPr') : undefined;
}

function getFirstAttribute(name: string, ...elements: Array<Element | undefined>) {
  for (const element of elements) {
    const value = element?.getAttribute(name);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function hasEnabledBold(...elements: Array<Element | undefined>) {
  for (const element of elements) {
    const value = element?.getAttribute('b');
    if (value === '1') return true;
    if (value === '0') return false;
  }
  return false;
}

function getFontSize(rawSize: number, scaleY: number) {
  return Number.isFinite(rawSize) && rawSize > 0
    ? Math.max(8, Math.round((rawSize / 100) * EMUS_PER_POINT * scaleY))
    : DEFAULT_TEXT_STYLE.fontSize;
}

function getTextStyle(shape: Element, scaleY: number): PptxTextStyle {
  const paragraph = getFirstParagraph(shape);
  const paragraphProperties = paragraph ? pptxXml.firstDescendant(paragraph, 'pPr') : undefined;
  const runProperties = getFirstRunProperties(paragraph);
  const paragraphDefaultRunProperties = getParagraphDefaultRunProperties(paragraphProperties);
  const listDefaultRunProperties = getListDefaultRunProperties(shape);
  const align = paragraphProperties?.getAttribute('algn');
  const size = Number(
    getFirstAttribute(
      'sz',
      runProperties,
      paragraphDefaultRunProperties,
      listDefaultRunProperties,
    ),
  );
  const font = getTypeface(
    runProperties,
    paragraphDefaultRunProperties,
    listDefaultRunProperties,
  );
  const bold = hasEnabledBold(
    runProperties,
    paragraphDefaultRunProperties,
    listDefaultRunProperties,
  );
  return {
    align: align === 'ctr' ? 'center' : align === 'r' ? 'right' : 'left',
    fill: getHexColor(
      runProperties ?? paragraphDefaultRunProperties ?? listDefaultRunProperties ?? shape,
      DEFAULT_TEXT_STYLE.fill,
    ),
    fontFamily: font && !font.startsWith('+') ? font : DEFAULT_TEXT_STYLE.fontFamily,
    fontSize: getFontSize(size, scaleY),
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

function getTextInset(
  bodyProperties: Element | undefined,
  attributeName: string,
  fallbackEmu: number,
  scale: number,
) {
  const rawValue = bodyProperties?.getAttribute(attributeName);
  const value = rawValue === undefined || rawValue === null ? Number.NaN : Number(rawValue);
  const emu = Number.isFinite(value) ? value : fallbackEmu;
  return Math.max(0, Math.round(emu * scale));
}

function getTextBox(shape: Element, scaleX: number, scaleY: number): PptxTextBox {
  const bodyProperties = pptxXml.firstDescendant(shape, 'bodyPr');
  const anchor = bodyProperties?.getAttribute('anchor');
  return {
    insets: {
      bottom: getTextInset(bodyProperties, 'bIns', DEFAULT_TEXT_INSETS_EMU.bottom, scaleY),
      left: getTextInset(bodyProperties, 'lIns', DEFAULT_TEXT_INSETS_EMU.left, scaleX),
      right: getTextInset(bodyProperties, 'rIns', DEFAULT_TEXT_INSETS_EMU.right, scaleX),
      top: getTextInset(bodyProperties, 'tIns', DEFAULT_TEXT_INSETS_EMU.top, scaleY),
    },
    verticalAlign: anchor === 'b' ? 'bottom' : anchor === 'ctr' ? 'middle' : 'top',
  };
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
  const shapeId = localShapeId(shape, String(zIndex));
  return {
    frame,
    id: `${slideId}-${idScope}-text-${shapeId}`,
    kind: 'text',
    sourceShapeId: shapeId,
    style: getTextStyle(shape, scaleY),
    text,
    textBox: getTextBox(shape, scaleX, scaleY),
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
  const shapeId = localShapeId(picture, String(zIndex));
  return {
    assetPath,
    frame,
    id: `${slideId}-${idScope}-${assetType}-${shapeId}`,
    kind: assetType,
    sourceShapeId: shapeId,
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

function toBuildKind(value: string | null): ElementAnimationKind {
  if (value === 'exit') return 'build-out';
  if (value === 'emph') return 'emphasis';
  return 'build-in';
}

function toBuildTrigger(value: string | null, index: number): AnimationTrigger {
  if (value === 'clickEffect') return 'on-click';
  if (value === 'afterEffect') return index === 0 ? 'after-transition' : 'after-previous';
  return index === 0 ? 'after-transition' : 'on-click';
}

function toMilliseconds(value: string | null, fallback: number) {
  if (!value || value === 'indefinite') return fallback;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : fallback;
}

function findBuildSourceShapeId(behavior: Element) {
  return pptxXml.firstDescendant(behavior, 'spTgt')?.getAttribute('spid');
}

function findNearestAnimationTimingNode(behavior: Element) {
  let current: Element | null = behavior;
  while (current) {
    if (current.localName === 'cTn' && current.hasAttribute('nodeType')) return current;
    current = current.parentElement;
  }
  return undefined;
}

function getBuildDurationMs(timingNode: Element | undefined) {
  const childDuration = timingNode
    ? pptxXml.descendants(timingNode, 'cTn').find((item) => item.hasAttribute('dur'))?.getAttribute('dur')
    : undefined;
  return toMilliseconds(childDuration ?? timingNode?.getAttribute('dur') ?? null, 500);
}

function parseAnimationBuilds(
  document: Document,
  slideId: string,
  objects: PptxSlideObject[],
): ElementAnimationBuild[] {
  const slideObjectsByShapeId = new Map(
    objects
      .filter((object) => object.id.includes('-slide-'))
      .map((object) => [object.sourceShapeId, object]),
  );
  const builds: ElementAnimationBuild[] = [];
  const seenShapeIds = new Set<string>();
  pptxXml.descendants(document, 'cBhvr').forEach((behavior) => {
    const sourceShapeId = findBuildSourceShapeId(behavior);
    if (!sourceShapeId) return;
    if (seenShapeIds.has(sourceShapeId)) return;
    const object = slideObjectsByShapeId.get(sourceShapeId);
    if (!object) return;
    const timingNode = findNearestAnimationTimingNode(behavior);
    const buildIndex = builds.length;
    builds.push({
      id: `${slideId}-build-${buildIndex + 1}-${object.id}`,
      elementId: object.id,
      effect: 'reveal',
      trigger: toBuildTrigger(timingNode?.getAttribute('nodeType') ?? null, buildIndex),
      delayMs: 0,
      durationMs: getBuildDurationMs(timingNode),
      kind: toBuildKind(timingNode?.getAttribute('presetClass') ?? null),
    });
    seenShapeIds.add(sourceShapeId);
  });
  pptxXml.descendants(document, 'bldP').forEach((build) => {
    const sourceShapeId = build.getAttribute('spid');
    if (!sourceShapeId || seenShapeIds.has(sourceShapeId)) return;
    const object = slideObjectsByShapeId.get(sourceShapeId);
    if (!object) return;
    const buildIndex = builds.length;
    builds.push({
      id: `${slideId}-build-${buildIndex + 1}-${object.id}`,
      elementId: object.id,
      effect: 'reveal',
      trigger: toBuildTrigger(null, buildIndex),
      delayMs: 0,
      durationMs: 500,
      kind: 'build-in',
    });
    seenShapeIds.add(sourceShapeId);
  });
  return builds;
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
    animationBuilds: parseAnimationBuilds(document, slideId, objects),
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
