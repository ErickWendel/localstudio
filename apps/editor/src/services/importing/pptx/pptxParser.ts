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
  lineHeight: number;
  verticalAlign: 'bottom' | 'middle' | 'top';
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
  speakerNotes?: string;
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

interface PptxTextDefaults {
  defaultParagraphProperties: Element | undefined;
  defaultRunProperties: Element | undefined;
  listParagraphProperties: Element | undefined;
  listRunProperties: Element | undefined;
}

const DEFAULT_PAGE_WIDTH = 1920;
const DEFAULT_PAGE_HEIGHT = 1080;
const DEFAULT_TEXT_STYLE: PptxTextStyle = {
  align: 'left',
  fill: '#ffffff',
  fontFamily: 'Open Sans',
  fontSize: 32,
  fontWeight: 400,
  lineHeight: 1.05,
  verticalAlign: 'top',
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

function getPresentationTextDefaults(document: Document): PptxTextDefaults {
  const defaultTextStyle = pptxXml.firstDescendant(document, 'defaultTextStyle');
  const defaultParagraphProperties = defaultTextStyle
    ? pptxXml.firstDescendant(defaultTextStyle, 'defPPr')
    : undefined;
  const listParagraphProperties = defaultTextStyle
    ? pptxXml.firstDescendant(defaultTextStyle, 'lvl1pPr')
    : undefined;
  return {
    defaultParagraphProperties,
    defaultRunProperties: getParagraphDefaultRunProperties(defaultParagraphProperties),
    listParagraphProperties,
    listRunProperties: getParagraphDefaultRunProperties(listParagraphProperties),
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

function getPlaceholderType(shape: Element) {
  return pptxXml.firstDescendant(shape, 'ph')?.getAttribute('type');
}

function hasPlaceholder(shape: Element) {
  return Boolean(getPlaceholderType(shape));
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

function getListParagraphProperties(shape: Element) {
  const listStyle = pptxXml.firstDescendant(shape, 'lstStyle');
  return listStyle ? pptxXml.firstDescendant(listStyle, 'lvl1pPr') : undefined;
}

function getListDefaultRunProperties(shape: Element) {
  const listParagraphProperties = getListParagraphProperties(shape);
  return listParagraphProperties ? pptxXml.firstDescendant(listParagraphProperties, 'defRPr') : undefined;
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

function getVerticalAlign(shape: Element): PptxTextStyle['verticalAlign'] {
  const bodyProperties = pptxXml.firstDescendant(shape, 'bodyPr');
  const anchor = bodyProperties?.getAttribute('anchor');
  if (anchor === 'b') return 'bottom';
  if (anchor === 'ctr') return 'middle';
  return 'top';
}

function getLineHeight(...paragraphProperties: Array<Element | undefined>) {
  for (const properties of paragraphProperties) {
    const lineSpacing = properties ? pptxXml.firstDescendant(properties, 'lnSpc') : undefined;
    const percentage = Number(
      lineSpacing ? pptxXml.firstDescendant(lineSpacing, 'spcPct')?.getAttribute('val') : undefined,
    );
    if (Number.isFinite(percentage) && percentage > 0) {
      return Math.max(0.7, Math.min(2, percentage / 100000));
    }
  }
  return DEFAULT_TEXT_STYLE.lineHeight;
}

function getTextAlign(
  paragraphProperties: Element | undefined,
  listParagraphProperties: Element | undefined,
  textDefaults: PptxTextDefaults,
  fontSize: number,
  verticalAlign: PptxTextStyle['verticalAlign'],
): PptxTextStyle['align'] {
  const inheritedParagraphProperties =
    verticalAlign === 'middle'
      ? textDefaults.listParagraphProperties
      : textDefaults.defaultParagraphProperties;
  const align = getFirstAttribute(
    'algn',
    paragraphProperties,
    listParagraphProperties,
    inheritedParagraphProperties,
    textDefaults.defaultParagraphProperties,
  );
  if (align === 'ctr') return 'center';
  if (align === 'r') return 'right';
  if (align === 'l') return 'left';
  if (verticalAlign === 'middle' && fontSize >= 80) return 'center';
  return DEFAULT_TEXT_STYLE.align;
}

function getTextStyle(shape: Element, scaleY: number, textDefaults: PptxTextDefaults): PptxTextStyle {
  const paragraph = getFirstParagraph(shape);
  const paragraphProperties = paragraph ? pptxXml.firstDescendant(paragraph, 'pPr') : undefined;
  const runProperties = getFirstRunProperties(paragraph);
  const paragraphDefaultRunProperties = getParagraphDefaultRunProperties(paragraphProperties);
  const listParagraphProperties = getListParagraphProperties(shape);
  const listDefaultRunProperties = getListDefaultRunProperties(shape);
  const verticalAlign = getVerticalAlign(shape);
  const inheritedRunProperties =
    verticalAlign === 'middle' ? textDefaults.listRunProperties : textDefaults.defaultRunProperties;
  const inheritedParagraphProperties =
    verticalAlign === 'middle'
      ? textDefaults.listParagraphProperties
      : textDefaults.defaultParagraphProperties;
  const size = Number(
    getFirstAttribute(
      'sz',
      runProperties,
      paragraphDefaultRunProperties,
      listDefaultRunProperties,
      inheritedRunProperties,
      textDefaults.defaultRunProperties,
    ),
  );
  const font = getTypeface(
    runProperties,
    paragraphDefaultRunProperties,
    listDefaultRunProperties,
    inheritedRunProperties,
    textDefaults.defaultRunProperties,
  );
  const bold = hasEnabledBold(
    runProperties,
    paragraphDefaultRunProperties,
    listDefaultRunProperties,
    inheritedRunProperties,
    textDefaults.defaultRunProperties,
  );
  const fontSize = getFontSize(size, scaleY);
  return {
    align: getTextAlign(paragraphProperties, listParagraphProperties, textDefaults, fontSize, verticalAlign),
    fill: getHexColor(
      runProperties ??
        paragraphDefaultRunProperties ??
        listDefaultRunProperties ??
        inheritedRunProperties ??
        shape,
      DEFAULT_TEXT_STYLE.fill,
    ),
    fontFamily: font && !font.startsWith('+') ? font : DEFAULT_TEXT_STYLE.fontFamily,
    fontSize,
    fontWeight: bold ? 700 : DEFAULT_TEXT_STYLE.fontWeight,
    lineHeight: getLineHeight(paragraphProperties, listParagraphProperties, inheritedParagraphProperties),
    verticalAlign,
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

async function parseSpeakerNotes(files: PptxPackageFile[], notesPath: string | undefined) {
  if (!notesPath) return undefined;
  const xml = await readText(findFile(files, notesPath));
  if (!xml) return undefined;
  const document = pptxXml.parseXml(xml);
  const notesText = pptxXml
    .descendants(document, 'sp')
    .filter((shape) => getPlaceholderType(shape) === 'body')
    .map(getTextParagraphs)
    .filter(Boolean)
    .join('\n')
    .trim();
  return notesText || undefined;
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
  textDefaults: PptxTextDefaults,
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
    style: getTextStyle(shape, scaleY, textDefaults),
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

function isMediaControlTiming(timingNode: Element | undefined) {
  return timingNode?.getAttribute('presetClass') === 'mediacall';
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
    if (isMediaControlTiming(timingNode)) return;
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
  textDefaults: PptxTextDefaults,
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
        const object = parseTextObject(child, slideId, objects.length, scaleX, scaleY, textDefaults, idScope);
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
  textDefaults: PptxTextDefaults,
) {
  const xml = await readText(findFile(files, slidePath));
  if (!xml) throw new Error(`PowerPoint slide is missing: ${slidePath}`);
  const document = pptxXml.parseXml(xml);
  const rels = parseRelationships(await readText(findFile(files, relsPathFor(slidePath))), slidePath);
  const slideId = `pptx-page-${slideIndex + 1}`;
  const layoutPath = findRelationshipByType(rels, '/slideLayout')?.target;
  const notesPath = findRelationshipByType(rels, '/notesSlide')?.target;
  const layoutRels = parseRelationships(
    await readText(findFile(files, layoutPath ? relsPathFor(layoutPath) : '')),
    layoutPath ?? slidePath,
  );
  const masterPath = findRelationshipByType(layoutRels, '/slideMaster')?.target;
  const speakerNotes = await parseSpeakerNotes(files, notesPath);
  const masterObjects = await parseInheritedObjects(files, masterPath, slideId, scaleX, scaleY, textDefaults, 'master');
  const layoutObjects = await parseInheritedObjects(files, layoutPath, slideId, scaleX, scaleY, textDefaults, 'layout');
  const tree = pptxXml.firstDescendant(document, 'spTree');
  const inheritedObjects = [...masterObjects, ...layoutObjects];
  const objects: PptxSlideObject[] = inheritedObjects.map((object, index) => ({
    ...object,
    zIndex: index,
  }));
  if (tree) {
    for (const child of pptxXml.childElements(tree)) {
      if (child.localName === 'sp') {
        const object = parseTextObject(child, slideId, objects.length, scaleX, scaleY, textDefaults);
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
    ...(speakerNotes ? { speakerNotes } : {}),
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
  const textDefaults = getPresentationTextDefaults(presentation);
  const slidePaths = pptxXml
    .descendants(presentation, 'sldId')
    .map((slide) => presentationRelationships.get(slide.getAttribute('r:id') ?? '')?.target)
    .filter((path): path is string => Boolean(path));
  if (slidePaths.length === 0) throw new Error('PowerPoint package does not contain slides.');
  return {
    height: size.height,
    name: normalizeName(name),
    slides: await Promise.all(
      slidePaths.map((slidePath, index) =>
        parseSlide(files, slidePath, index, size.scaleX, size.scaleY, textDefaults),
      ),
    ),
    width: size.width,
  };
}

export const pptxParser = {
  parse,
};
