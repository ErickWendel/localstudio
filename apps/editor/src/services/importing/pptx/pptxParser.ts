import type {
  AnimationEffect,
  AnimationTrigger,
  ElementAnimationBuild,
  ElementAnimationKind,
  ImportWarning,
  PlaceholderRole,
  ShapeKind,
  ShapeLineEndpoint,
} from '../../../domain/documents/model';
import { pptxFileUtils } from './pptxFileUtils';
import type { PptxPackage, PptxRelationship } from './pptxPackage';
import { pptxXml } from './pptxXml';

export interface PptxRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface PptxTransform extends PptxRect {
  flipX?: boolean;
  rotation: number;
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
      opacity?: number;
      placeholderRole?: PlaceholderRole;
      rotation?: number;
      source: 'layout' | 'master' | 'slide';
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
      opacity?: number;
      placeholderRole?: PlaceholderRole;
      rotation?: number;
      source: 'layout' | 'master' | 'slide';
      startTrigger?: AnimationTrigger;
      sourceShapeId: string;
      zIndex: number;
    }
  | {
      endEndpoint?: ShapeLineEndpoint;
      fill?: string;
      frame: PptxRect;
      id: string;
      kind: 'shape';
      opacity?: number;
      placeholderRole?: PlaceholderRole;
      rotation?: number;
      shape: ShapeKind;
      source: 'layout' | 'master' | 'slide';
      sourceShapeId: string;
      startEndpoint?: ShapeLineEndpoint;
      stroke?: string;
      strokeWidth?: number;
      zIndex: number;
    };

export interface PptxSlide {
  backgroundColor: string;
  id: string;
  layoutId?: string;
  layoutName?: string;
  layoutObjects: PptxSlideObject[];
  name: string;
  animationBuilds: ElementAnimationBuild[];
  objects: PptxSlideObject[];
  placeholderRoles: PlaceholderRole[];
  speakerNotes?: string;
  transitionEffect: AnimationEffect;
}

export interface PptxLayout {
  backgroundColor: string;
  id: string;
  name: string;
  objects: PptxSlideObject[];
  placeholderRoles: PlaceholderRole[];
  sourcePath: string;
}

export interface PptxDeck {
  height: number;
  layouts: PptxLayout[];
  name: string;
  slides: PptxSlide[];
  warnings: ImportWarning[];
  width: number;
}

interface PptxTextDefaults {
  defaultParagraphProperties: Element | undefined;
  defaultRunProperties: Element | undefined;
  listParagraphProperties: Element | undefined;
  listRunProperties: Element | undefined;
}

interface PptxTheme {
  colors: Map<string, string>;
}

interface ParseContext {
  package: PptxPackage;
  themeCache: Map<string, PptxTheme>;
}

interface ParseScope {
  groupTransform?: PptxTransform;
  theme: PptxTheme | undefined;
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

function parseFrame(element: Element, scaleX: number, scaleY: number, groupTransform?: PptxTransform): PptxTransform | undefined {
  const transform = pptxXml.firstDescendant(element, 'xfrm');
  const offset = transform ? pptxXml.firstDescendant(transform, 'off') : undefined;
  const extent = transform ? pptxXml.firstDescendant(transform, 'ext') : undefined;
  const x = Number(offset?.getAttribute('x'));
  const y = Number(offset?.getAttribute('y'));
  const width = Number(extent?.getAttribute('cx'));
  const height = Number(extent?.getAttribute('cy'));
  if (![x, y, width, height].every(Number.isFinite)) return undefined;
  const localFrame = {
    x: x * scaleX,
    y: y * scaleY,
    width: Math.max(1, width * scaleX),
    height: Math.max(1, height * scaleY),
    rotation: getRotation(transform),
    ...(transform?.getAttribute('flipH') === '1' ? { flipX: true } : {}),
  };
  if (!groupTransform) {
    return {
      ...localFrame,
      x: Math.round(localFrame.x),
      y: Math.round(localFrame.y),
      width: Math.round(localFrame.width),
      height: Math.round(localFrame.height),
    };
  }
  return {
    ...localFrame,
    x: Math.round(groupTransform.x + localFrame.x),
    y: Math.round(groupTransform.y + localFrame.y),
    width: Math.round(localFrame.width),
    height: Math.round(localFrame.height),
    rotation: groupTransform.rotation + localFrame.rotation,
  };
}

function normalizeColor(value: string) {
  return `#${value.replace(/^#/, '').toUpperCase()}`;
}

function clampColor(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function applyColorModifier(color: string, element: Element) {
  const hex = color.replace(/^#/, '');
  let red = Number.parseInt(hex.slice(0, 2), 16);
  let green = Number.parseInt(hex.slice(2, 4), 16);
  let blue = Number.parseInt(hex.slice(4, 6), 16);
  const shade = Number(pptxXml.firstDescendant(element, 'shade')?.getAttribute('val'));
  const tint = Number(pptxXml.firstDescendant(element, 'tint')?.getAttribute('val'));
  const lumMod = Number(pptxXml.firstDescendant(element, 'lumMod')?.getAttribute('val'));
  const lumOff = Number(pptxXml.firstDescendant(element, 'lumOff')?.getAttribute('val'));
  if (Number.isFinite(shade) && shade >= 0) {
    red = (red * shade) / 100000;
    green = (green * shade) / 100000;
    blue = (blue * shade) / 100000;
  }
  if (Number.isFinite(tint) && tint >= 0) {
    red += (255 - red) * (tint / 100000);
    green += (255 - green) * (tint / 100000);
    blue += (255 - blue) * (tint / 100000);
  }
  if (Number.isFinite(lumMod) && lumMod >= 0) {
    red *= lumMod / 100000;
    green *= lumMod / 100000;
    blue *= lumMod / 100000;
  }
  if (Number.isFinite(lumOff) && lumOff >= 0) {
    red += 255 * (lumOff / 100000);
    green += 255 * (lumOff / 100000);
    blue += 255 * (lumOff / 100000);
  }
  return normalizeColor(
    [red, green, blue].map((channel) => clampColor(channel).toString(16).padStart(2, '0')).join(''),
  );
}

function getThemeColor(theme: PptxTheme | undefined, name: string) {
  const aliases = new Map([
    ['bg1', 'lt1'],
    ['tx1', 'dk1'],
    ['bg2', 'lt2'],
    ['tx2', 'dk2'],
  ]);
  return theme?.colors.get(name) ?? theme?.colors.get(aliases.get(name) ?? '');
}

function getHexColor(element: ParentNode | undefined, fallback: string, theme?: PptxTheme) {
  if (!element) return fallback;
  const color = pptxXml.firstDescendant(element, 'srgbClr');
  const schemeColor = pptxXml.firstDescendant(element, 'schemeClr');
  const systemColor = pptxXml.firstDescendant(element, 'sysClr');
  const rawColor =
    color?.getAttribute('val') ??
    systemColor?.getAttribute('lastClr') ??
    (schemeColor ? getThemeColor(theme, schemeColor.getAttribute('val') ?? '') : undefined);
  const sourceElement = color ?? schemeColor ?? systemColor;
  return rawColor && sourceElement ? applyColorModifier(normalizeColor(rawColor), sourceElement) : fallback;
}

function getOpacity(element: ParentNode | undefined) {
  if (!element) return undefined;
  const alpha = Number(pptxXml.firstDescendant(element, 'alpha')?.getAttribute('val'));
  return Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha / 100000)) : undefined;
}

function getRotation(transform: Element | undefined) {
  const rotation = Number(transform?.getAttribute('rot'));
  return Number.isFinite(rotation) ? Math.round(rotation / 60000) : 0;
}

function getPlaceholderType(shape: Element) {
  return pptxXml.firstDescendant(shape, 'ph')?.getAttribute('type');
}

function getPlaceholderRole(shape: Element): PlaceholderRole | undefined {
  const type = getPlaceholderType(shape);
  if (type === 'title' || type === 'ctrTitle') return 'title';
  if (type === 'body' || type === 'obj' || type === 'subTitle') return 'body';
  if (type === 'ftr') return 'footer';
  if (type === 'sldNum') return 'slideNumber';
  return undefined;
}

function getPlaceholderFallbackText(role: PlaceholderRole | undefined) {
  if (role === 'title') return 'Title';
  if (role === 'body') return 'Body';
  if (role === 'footer') return 'Footer';
  if (role === 'slideNumber') return 'Slide Number';
  return '';
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

function getTextStyle(
  shape: Element,
  scaleY: number,
  textDefaults: PptxTextDefaults,
  theme: PptxTheme | undefined,
): PptxTextStyle {
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
      theme,
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

async function parseSpeakerNotes(context: ParseContext, notesPath: string | undefined) {
  if (!notesPath) return undefined;
  const xml = await context.package.readText(notesPath);
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
  scope: ParseScope,
  idScope: 'layout' | 'master' | 'slide' = 'slide',
): PptxSlideObject | undefined {
  const placeholderRole = getPlaceholderRole(shape);
  const text = getTextParagraphs(shape) || (idScope === 'slide' ? '' : getPlaceholderFallbackText(placeholderRole));
  if (!text) return undefined;
  const frame = parseFrame(shape, scaleX, scaleY, scope.groupTransform);
  if (!frame) return undefined;
  const shapeId = localShapeId(shape, String(zIndex));
  const opacity = getOpacity(shape);
  return {
    frame,
    id: `${slideId}-${idScope}-text-${shapeId}`,
    kind: 'text',
    ...(opacity !== undefined ? { opacity } : {}),
    ...(placeholderRole ? { placeholderRole } : {}),
    rotation: frame.rotation,
    source: idScope,
    sourceShapeId: shapeId,
    style: getTextStyle(shape, scaleY, textDefaults, scope.theme),
    text,
    textBox: getTextBox(shape, scaleX, scaleY),
    zIndex,
  };
}

function getRelationshipTarget(
  context: ParseContext,
  relationships: Map<string, PptxRelationship>,
  id: string | null | undefined,
  pageId?: string,
) {
  if (!id) return undefined;
  const relationship = relationships.get(id);
  if (!relationship) return undefined;
  if (relationship.targetMode === 'External') {
    context.package.warnings.push({
      code: 'pptx-external-relationship',
      message: `Skipped external PowerPoint relationship: ${relationship.target}`,
      ...(pageId ? { pageId } : {}),
      severity: 'warning',
    });
    return undefined;
  }
  return relationship.target;
}

function parsePictureObject(
  context: ParseContext,
  picture: Element,
  slideId: string,
  zIndex: number,
  scaleX: number,
  scaleY: number,
  relationships: Map<string, PptxRelationship>,
  scope: ParseScope,
  idScope: 'layout' | 'master' | 'slide' = 'slide',
): PptxSlideObject | undefined {
  const frame = parseFrame(picture, scaleX, scaleY, scope.groupTransform);
  if (!frame) return undefined;
  const videoRelId =
    pptxXml.getRelationshipAttr(pptxXml.firstDescendant(picture, 'videoFile'), 'link') ??
    pptxXml.getRelationshipAttr(pptxXml.firstDescendant(picture, 'media'), 'embed');
  const imageRelId = pptxXml.getRelationshipAttr(pptxXml.firstDescendant(picture, 'blip'), 'embed');
  const assetPath =
    getRelationshipTarget(context, relationships, videoRelId, slideId) ??
    getRelationshipTarget(context, relationships, imageRelId, slideId);
  if (!assetPath) return undefined;
  const mimeType = context.package.getContentType(assetPath) ?? pptxFileUtils.getMimeType(assetPath);
  const assetType = pptxFileUtils.getAssetType(assetPath, mimeType);
  if (!assetType) {
    context.package.warnings.push({
      code: 'pptx-unsupported-asset',
      message: `Skipped unsupported PowerPoint asset: ${assetPath}`,
      pageId: slideId,
      severity: 'warning',
    });
  }
  if (!assetType) return undefined;
  const shapeId = localShapeId(picture, String(zIndex));
  const opacity = getOpacity(picture);
  return {
    assetPath,
    frame,
    id: `${slideId}-${idScope}-${assetType}-${shapeId}`,
    kind: assetType,
    ...(opacity !== undefined ? { opacity } : {}),
    rotation: frame.rotation,
    source: idScope,
    sourceShapeId: shapeId,
    zIndex,
  };
}

function getBackgroundColor(document: Document, theme: PptxTheme | undefined, fallback = '#000000') {
  const background = pptxXml.firstDescendant(document, 'bgPr');
  return getHexColor(background, fallback, theme);
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

function getVideoStartTriggers(document: Document, objects: PptxSlideObject[]) {
  const videoObjectsByShapeId = new Map(
    objects
      .filter((object) => object.kind === 'video' && object.id.includes('-slide-'))
      .map((object) => [object.sourceShapeId, object]),
  );
  const triggers = new Map<string, AnimationTrigger>();
  let mediaBuildIndex = 0;
  pptxXml.descendants(document, 'cBhvr').forEach((behavior) => {
    const sourceShapeId = findBuildSourceShapeId(behavior);
    if (!sourceShapeId || !videoObjectsByShapeId.has(sourceShapeId)) return;
    const timingNode = findNearestAnimationTimingNode(behavior);
    if (!isMediaControlTiming(timingNode)) return;
    triggers.set(
      sourceShapeId,
      toBuildTrigger(timingNode?.getAttribute('nodeType') ?? null, mediaBuildIndex),
    );
    mediaBuildIndex += 1;
  });
  return triggers;
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
    if (isMediaControlTiming(timingNode) && object.kind !== 'video') return;
    const buildIndex = builds.length;
    builds.push({
      id: `${slideId}-build-${buildIndex + 1}-${object.id}`,
      elementId: object.id,
      effect: 'reveal',
      trigger: toBuildTrigger(timingNode?.getAttribute('nodeType') ?? null, buildIndex),
      delayMs: 0,
      durationMs: isMediaControlTiming(timingNode) ? 0 : getBuildDurationMs(timingNode),
      kind: toBuildKind(timingNode?.getAttribute('presetClass') ?? null),
      ...(isMediaControlTiming(timingNode) ? { mediaAction: 'play' as const } : {}),
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

function findRelationshipByType(relationships: Map<string, PptxRelationship>, typeSuffix: string) {
  return Array.from(relationships.values()).find((relationship) =>
    relationship.type.endsWith(typeSuffix),
  );
}

function shapeKindForPreset(preset: string | null | undefined): ShapeKind | undefined {
  if (!preset) return undefined;
  if (preset === 'rect') return 'rect';
  if (preset === 'roundRect') return 'rounded-rect';
  if (preset === 'ellipse') return 'ellipse';
  if (preset === 'triangle' || preset === 'rtTriangle') return 'triangle';
  if (preset === 'diamond') return 'diamond';
  if (preset === 'parallelogram') return 'parallelogram';
  if (preset === 'pentagon') return 'pentagon';
  if (preset === 'line') return 'line';
  if (preset === 'arc') return 'arc';
  if (preset.toLowerCase().includes('arrow')) return 'arrow';
  return undefined;
}

function getLineEndpoint(value: string | null | undefined): ShapeLineEndpoint | undefined {
  if (!value) return undefined;
  if (value === 'triangle') return 'arrow';
  if (value === 'stealth') return 'open-arrow';
  if (value === 'oval') return 'circle';
  if (value === 'diamond') return 'diamond';
  return undefined;
}

function getStrokeWidth(line: Element | undefined, scaleY: number) {
  const width = Number(line?.getAttribute('w'));
  return Number.isFinite(width) && width > 0 ? Math.max(1, Math.round(width * scaleY)) : undefined;
}

function parseShapeObject(
  shape: Element,
  slideId: string,
  zIndex: number,
  scaleX: number,
  scaleY: number,
  scope: ParseScope,
  idScope: 'layout' | 'master' | 'slide' = 'slide',
): PptxSlideObject | undefined {
  const preset = pptxXml.firstDescendant(shape, 'prstGeom')?.getAttribute('prst');
  const shapeKind = shapeKindForPreset(preset);
  if (!shapeKind) return undefined;
  const frame = parseFrame(shape, scaleX, scaleY, scope.groupTransform);
  if (!frame) return undefined;
  const shapeProperties = pptxXml.firstDescendant(shape, 'spPr');
  const line = shapeProperties ? pptxXml.firstDescendant(shapeProperties, 'ln') : undefined;
  const shapeId = localShapeId(shape, String(zIndex));
  const placeholderRole = getPlaceholderRole(shape);
  const fill = shapeProperties ? getHexColor(pptxXml.firstDescendant(shapeProperties, 'solidFill'), '', scope.theme) : '';
  const stroke = line ? getHexColor(pptxXml.firstDescendant(line, 'solidFill'), '', scope.theme) : '';
  const opacity = getOpacity(shapeProperties);
  const startEndpoint = getLineEndpoint(pptxXml.firstDescendant(line ?? shape, 'headEnd')?.getAttribute('type'));
  const endEndpoint = getLineEndpoint(pptxXml.firstDescendant(line ?? shape, 'tailEnd')?.getAttribute('type'));
  const strokeWidth = getStrokeWidth(line, scaleY);
  return {
    frame,
    id: `${slideId}-${idScope}-shape-${shapeId}`,
    kind: 'shape',
    ...(fill ? { fill } : {}),
    ...(stroke ? { stroke } : {}),
    ...(strokeWidth ? { strokeWidth } : {}),
    ...(startEndpoint ? { startEndpoint } : {}),
    ...(endEndpoint ? { endEndpoint } : {}),
    ...(opacity !== undefined ? { opacity } : {}),
    ...(placeholderRole ? { placeholderRole } : {}),
    rotation: frame.rotation,
    shape: shapeKind,
    source: idScope,
    sourceShapeId: shapeId,
    zIndex,
  };
}

function parseGroupTransform(group: Element, scaleX: number, scaleY: number, parent?: PptxTransform) {
  const frame = parseFrame(group, scaleX, scaleY, parent);
  return frame;
}

function getTableColumnWidths(table: Element) {
  return pptxXml.childElements(pptxXml.firstDescendant(table, 'tblGrid') ?? table, 'gridCol').map((column) => {
    const width = Number(column.getAttribute('w'));
    return Number.isFinite(width) && width > 0 ? width : 0;
  });
}

function parseTableObjects(
  frame: PptxTransform,
  graphicFrame: Element,
  slideId: string,
  zIndexStart: number,
  scaleX: number,
  scaleY: number,
  textDefaults: PptxTextDefaults,
  scope: ParseScope,
): PptxSlideObject[] {
  const table = pptxXml.firstDescendant(graphicFrame, 'tbl');
  if (!table) return [];
  const columnWidths = getTableColumnWidths(table);
  const rowElements = pptxXml.childElements(table, 'tr');
  const objects: PptxSlideObject[] = [];
  let y = frame.y;
  rowElements.forEach((row, rowIndex) => {
    const rawHeight = Number(row.getAttribute('h'));
    const rowHeight = Number.isFinite(rawHeight) && rawHeight > 0 ? Math.round(rawHeight * scaleY) : frame.height;
    let x = frame.x;
    pptxXml.childElements(row, 'tc').forEach((cell, columnIndex) => {
      const columnWidth = Math.round((columnWidths[columnIndex] ?? 0) * scaleX) || Math.round(frame.width / Math.max(1, columnWidths.length));
      const cellId = `${slideId}-slide-table-${rowIndex + 1}-${columnIndex + 1}`;
      const fill = getHexColor(pptxXml.firstDescendant(cell, 'solidFill'), '#FFFFFF', scope.theme);
      objects.push({
        fill,
        frame: { x, y, width: columnWidth, height: rowHeight },
        id: `${cellId}-shape`,
        kind: 'shape',
        opacity: 1,
        rotation: frame.rotation,
        shape: 'rect',
        source: 'slide',
        sourceShapeId: cellId,
        stroke: '#FFFFFF',
        strokeWidth: 1,
        zIndex: zIndexStart + objects.length,
      });
      const text = getTextParagraphs(cell);
      if (text) {
        objects.push({
          frame: { x, y, width: columnWidth, height: rowHeight },
          id: `${cellId}-text`,
          kind: 'text',
          opacity: 1,
          rotation: frame.rotation,
          source: 'slide',
          sourceShapeId: `${cellId}-text`,
          style: getTextStyle(cell, scaleY, textDefaults, scope.theme),
          text,
          textBox: getTextBox(cell, scaleX, scaleY),
          zIndex: zIndexStart + objects.length,
        });
      }
      x += columnWidth;
    });
    y += rowHeight;
  });
  return objects;
}

function addUnsupportedGraphicWarnings(
  context: ParseContext,
  graphicFrame: Element,
  slideId: string,
) {
  const graphicData = pptxXml.firstDescendant(graphicFrame, 'graphicData');
  const uri = graphicData?.getAttribute('uri') ?? '';
  if (uri.includes('/chart')) {
    context.package.warnings.push({
      code: 'pptx-unsupported-chart',
      message: 'Skipped unsupported PowerPoint chart.',
      pageId: slideId,
      severity: 'info',
    });
  }
  if (uri.includes('/diagram')) {
    context.package.warnings.push({
      code: 'pptx-unsupported-diagram',
      message: 'Skipped unsupported PowerPoint SmartArt or diagram.',
      pageId: slideId,
      severity: 'info',
    });
  }
}

function parseSlideTreeObjects(
  context: ParseContext,
  tree: Element | undefined,
  slideId: string,
  zIndexStart: number,
  scaleX: number,
  scaleY: number,
  textDefaults: PptxTextDefaults,
  relationships: Map<string, PptxRelationship>,
  scope: ParseScope,
  idScope: 'layout' | 'master' | 'slide' = 'slide',
): PptxSlideObject[] {
  const objects: PptxSlideObject[] = [];
  if (!tree) return objects;
  for (const child of pptxXml.childElements(tree)) {
    const zIndex = zIndexStart + objects.length;
    if (child.localName === 'sp') {
      const textObject = parseTextObject(child, slideId, zIndex, scaleX, scaleY, textDefaults, scope, idScope);
      if (textObject) objects.push(textObject);
      if (!textObject || !getTextParagraphs(child)) {
        const shapeObject = parseShapeObject(child, slideId, zIndexStart + objects.length, scaleX, scaleY, scope, idScope);
        if (shapeObject) objects.push(shapeObject);
      }
    }
    if (child.localName === 'pic') {
      const object = parsePictureObject(context, child, slideId, zIndex, scaleX, scaleY, relationships, scope, idScope);
      if (object) objects.push(object);
    }
    if (child.localName === 'grpSp') {
      objects.push(
        ...parseSlideTreeObjects(
          context,
          child,
          slideId,
          zIndexStart + objects.length,
          scaleX,
          scaleY,
          textDefaults,
          relationships,
          {
            ...scope,
            ...(parseGroupTransform(child, scaleX, scaleY, scope.groupTransform)
              ? { groupTransform: parseGroupTransform(child, scaleX, scaleY, scope.groupTransform)! }
              : {}),
          },
          idScope,
        ),
      );
    }
    if (child.localName === 'graphicFrame') {
      const frame = parseFrame(child, scaleX, scaleY, scope.groupTransform);
      if (frame && pptxXml.firstDescendant(child, 'tbl')) {
        objects.push(...parseTableObjects(frame, child, slideId, zIndexStart + objects.length, scaleX, scaleY, textDefaults, scope));
      } else {
        addUnsupportedGraphicWarnings(context, child, slideId);
      }
    }
  }
  return objects;
}

async function loadTheme(context: ParseContext, masterPath: string | undefined) {
  if (!masterPath) return undefined;
  const cached = context.themeCache.get(masterPath);
  if (cached) return cached;
  const themePath = findRelationshipByType(context.package.getRelationships(masterPath), '/theme')?.target;
  if (!themePath) return undefined;
  const xml = await context.package.readText(themePath);
  if (!xml) return undefined;
  const document = pptxXml.parseXml(xml);
  const colors = new Map<string, string>();
  const colorScheme = pptxXml.firstDescendant(document, 'clrScheme');
  if (colorScheme) {
    for (const child of pptxXml.childElements(colorScheme)) {
      const color = getHexColor(child, '');
      if (color) colors.set(child.localName, color);
    }
  }
  const theme = { colors };
  context.themeCache.set(masterPath, theme);
  return theme;
}

async function parseInheritedObjects(
  context: ParseContext,
  sourcePath: string | undefined,
  slideId: string,
  scaleX: number,
  scaleY: number,
  textDefaults: PptxTextDefaults,
  scope: ParseScope,
  idScope: 'layout' | 'master',
) {
  if (!sourcePath) return [];
  const xml = await context.package.readText(sourcePath);
  if (!xml) return [];
  const document = pptxXml.parseXml(xml);
  const rels = context.package.getRelationships(sourcePath);
  const tree = pptxXml.firstDescendant(document, 'spTree');
  return parseSlideTreeObjects(
    context,
    tree,
    slideId,
    0,
    scaleX,
    scaleY,
    textDefaults,
    rels,
    scope,
    idScope,
  );
}

function getLayoutId(layoutPath: string | undefined) {
  if (!layoutPath) return undefined;
  const fileName = layoutPath.split('/').at(-1)?.replace(/\.xml$/i, '') ?? 'layout';
  const slug = fileName
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .trim();
  return `pptx-layout-${slug || 'layout'}`;
}

function getLayoutName(layoutPath: string | undefined) {
  if (!layoutPath) return undefined;
  return layoutPath.split('/').at(-1)?.replace(/\.xml$/i, '') || undefined;
}

function getLayoutNameFromDocument(document: Document, layoutPath: string) {
  const name = pptxXml.firstDescendant(document, 'cSld')?.getAttribute('name')?.trim();
  return name || getLayoutName(layoutPath) || getLayoutId(layoutPath) || 'Layout';
}

function getPlaceholderRoles(objects: PptxSlideObject[]) {
  return Array.from(
    new Set(
      objects
        .map((object) => object.placeholderRole)
        .filter((role): role is PlaceholderRole => Boolean(role)),
    ),
  );
}

function getRelationshipTargetsInListOrder(
  relationships: Map<string, PptxRelationship>,
  listItems: Element[],
) {
  return listItems
    .map((item) => {
      const relationshipId = pptxXml.getRelationshipAttr(item, 'id');
      const relationship = relationshipId ? relationships.get(relationshipId) : undefined;
      return relationship?.targetMode === 'Internal' ? relationship.target : undefined;
    })
    .filter((target): target is string => Boolean(target));
}

async function getMasterLayoutPaths(context: ParseContext, masterPath: string) {
  const xml = await context.package.readText(masterPath);
  const relationships = context.package.getRelationships(masterPath);
  if (!xml) {
    return Array.from(relationships.values())
      .filter((relationship) => relationship.type.endsWith('/slideLayout') && relationship.targetMode === 'Internal')
      .map((relationship) => relationship.target);
  }
  const document = pptxXml.parseXml(xml);
  const orderedPaths = getRelationshipTargetsInListOrder(
    relationships,
    pptxXml.descendants(document, 'sldLayoutId'),
  );
  if (orderedPaths.length > 0) return orderedPaths;
  return Array.from(relationships.values())
    .filter((relationship) => relationship.type.endsWith('/slideLayout') && relationship.targetMode === 'Internal')
    .map((relationship) => relationship.target);
}

async function parseLayout(
  context: ParseContext,
  layoutPath: string,
  masterPath: string | undefined,
  scaleX: number,
  scaleY: number,
  textDefaults: PptxTextDefaults,
): Promise<PptxLayout | undefined> {
  const layoutId = getLayoutId(layoutPath);
  if (!layoutId) return undefined;
  const xml = await context.package.readText(layoutPath);
  if (!xml) return undefined;
  const document = pptxXml.parseXml(xml);
  const relationships = context.package.getRelationships(layoutPath);
  const resolvedMasterPath =
    masterPath ?? findRelationshipByType(relationships, '/slideMaster')?.target;
  const theme = await loadTheme(context, resolvedMasterPath);
  const scope = { theme };
  const masterObjects = await parseInheritedObjects(
    context,
    resolvedMasterPath,
    layoutId,
    scaleX,
    scaleY,
    textDefaults,
    scope,
    'master',
  );
  const tree = pptxXml.firstDescendant(document, 'spTree');
  const layoutObjects = parseSlideTreeObjects(
    context,
    tree,
    layoutId,
    masterObjects.length,
    scaleX,
    scaleY,
    textDefaults,
    relationships,
    scope,
    'layout',
  );
  const objects = [...masterObjects, ...layoutObjects].map((object, index) => ({
    ...object,
    zIndex: index,
  }));
  return {
    backgroundColor: getBackgroundColor(document, theme, '#FFFFFF'),
    id: layoutId,
    name: getLayoutNameFromDocument(document, layoutPath),
    objects,
    placeholderRoles: getPlaceholderRoles(objects),
    sourcePath: layoutPath,
  };
}

async function parseSlide(
  context: ParseContext,
  slidePath: string,
  slideIndex: number,
  scaleX: number,
  scaleY: number,
  textDefaults: PptxTextDefaults,
  layoutsByPath: Map<string, PptxLayout>,
) {
  const xml = await context.package.readText(slidePath);
  if (!xml) throw new Error(`PowerPoint slide is missing: ${slidePath}`);
  const document = pptxXml.parseXml(xml);
  const rels = context.package.getRelationships(slidePath);
  const slideId = `pptx-page-${slideIndex + 1}`;
  const layoutPath = findRelationshipByType(rels, '/slideLayout')?.target;
  const layoutId = getLayoutId(layoutPath);
  const notesPath = findRelationshipByType(rels, '/notesSlide')?.target;
  const layoutRels = layoutPath ? context.package.getRelationships(layoutPath) : new Map<string, PptxRelationship>();
  const masterPath = findRelationshipByType(layoutRels, '/slideMaster')?.target;
  const theme = await loadTheme(context, masterPath);
  const scope = { theme };
  const speakerNotes = await parseSpeakerNotes(context, notesPath);
  const parsedLayout = layoutPath ? layoutsByPath.get(layoutPath) : undefined;
  const tree = pptxXml.firstDescendant(document, 'spTree');
  const inheritedObjects = (parsedLayout?.objects ?? []).map((object, index) => ({
    ...object,
    zIndex: index,
  }));
  const objects: PptxSlideObject[] = [];
  objects.push(
    ...parseSlideTreeObjects(
      context,
      tree,
      slideId,
      objects.length,
      scaleX,
      scaleY,
      textDefaults,
      rels,
      scope,
    ),
  );
  const videoStartTriggers = getVideoStartTriggers(document, objects);
  for (const object of objects) {
    const startTrigger = videoStartTriggers.get(object.sourceShapeId);
    if (object.kind === 'video' && startTrigger) object.startTrigger = startTrigger;
  }
  const resolvedLayoutId = parsedLayout?.id ?? layoutId;
  return {
    backgroundColor: getBackgroundColor(document, theme),
    id: slideId,
    ...(resolvedLayoutId ? { layoutId: resolvedLayoutId } : {}),
    ...(parsedLayout?.name ? { layoutName: parsedLayout.name } : {}),
    layoutObjects: inheritedObjects,
    name: `Slide ${slideIndex + 1}`,
    animationBuilds: parseAnimationBuilds(document, slideId, objects),
    objects,
    placeholderRoles: parsedLayout?.placeholderRoles ?? getPlaceholderRoles(inheritedObjects),
    ...(speakerNotes ? { speakerNotes } : {}),
    transitionEffect: getTransitionEffect(document),
  };
}

function normalizeName(name: string) {
  return name.replace(/\.pptx$/i, '').trim() || 'Imported PowerPoint';
}

function findPresentationPath(context: ParseContext) {
  const packageRelationship = findRelationshipByType(context.package.getRelationships(''), '/officeDocument');
  if (packageRelationship?.targetMode === 'Internal') return packageRelationship.target;
  const legacyPath = 'ppt/presentation.xml';
  if (context.package.getFile(legacyPath)) {
    context.package.warnings.push({
      code: 'pptx-legacy-presentation-path',
      message: 'PowerPoint package did not declare the presentation part; ppt/presentation.xml was used as a fallback.',
      severity: 'warning',
    });
    return legacyPath;
  }
  return undefined;
}

async function parse(context: ParseContext, name: string): Promise<PptxDeck> {
  const presentationPath = findPresentationPath(context);
  if (!presentationPath) throw new Error('PowerPoint package is missing a presentation relationship.');
  const presentationXml = await context.package.readText(presentationPath);
  if (!presentationXml) throw new Error(`PowerPoint package is missing presentation part: ${presentationPath}`);
  const presentation = pptxXml.parseXml(presentationXml);
  const presentationRelationships = context.package.getRelationships(presentationPath);
  const size = getPresentationSize(presentation);
  const textDefaults = getPresentationTextDefaults(presentation);
  const slidePaths = pptxXml
    .descendants(presentation, 'sldId')
    .map((slide) => presentationRelationships.get(pptxXml.getRelationshipAttr(slide, 'id') ?? '')?.target)
    .filter((path): path is string => Boolean(path));
  if (slidePaths.length === 0) throw new Error('PowerPoint package does not contain slides.');
  const masterPaths = getRelationshipTargetsInListOrder(
    presentationRelationships,
    pptxXml.descendants(presentation, 'sldMasterId'),
  );
  const layoutPathEntries: Array<{ layoutPath: string; masterPath?: string }> = [];
  for (const masterPath of masterPaths) {
    for (const layoutPath of await getMasterLayoutPaths(context, masterPath)) {
      layoutPathEntries.push({ layoutPath, masterPath });
    }
  }
  for (const slidePath of slidePaths) {
    const slideLayoutPath = findRelationshipByType(
      context.package.getRelationships(slidePath),
      '/slideLayout',
    )?.target;
    if (slideLayoutPath && !layoutPathEntries.some((entry) => entry.layoutPath === slideLayoutPath)) {
      const slideLayoutRels = context.package.getRelationships(slideLayoutPath);
      const masterPath = findRelationshipByType(slideLayoutRels, '/slideMaster')?.target;
      layoutPathEntries.push({ layoutPath: slideLayoutPath, ...(masterPath ? { masterPath } : {}) });
    }
  }
  const layouts = (
    await Promise.all(
      layoutPathEntries.map((entry) =>
        parseLayout(
          context,
          entry.layoutPath,
          entry.masterPath,
          size.scaleX,
          size.scaleY,
          textDefaults,
        ),
      ),
    )
  ).filter((layout): layout is PptxLayout => Boolean(layout));
  const layoutsByPath = new Map(layouts.map((layout) => [layout.sourcePath, layout]));
  return {
    height: size.height,
    layouts,
    name: normalizeName(name),
    slides: await Promise.all(
      slidePaths.map((slidePath, index) =>
        parseSlide(context, slidePath, index, size.scaleX, size.scaleY, textDefaults, layoutsByPath),
      ),
    ),
    warnings: context.package.warnings,
    width: size.width,
  };
}

export const pptxParser = {
  parse,
};
