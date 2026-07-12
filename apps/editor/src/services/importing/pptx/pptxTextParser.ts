import type { PlaceholderRole } from '../../../domain/documents/model';
import type {
  ParseContext,
  PptxTextBox,
  PptxTextDefaults,
  PptxTextStyle,
  PptxTheme,
} from './pptx-parser-model';
import { pptxParserDefaults } from './pptx-parser-model';
import { pptxVisualStyle } from './pptx-visual-style';
import { pptxXml } from './pptxXml';

const EMUS_PER_POINT = 12700;

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
    : pptxParserDefaults.textStyle.fontSize;
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
  return pptxParserDefaults.textStyle.lineHeight;
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
  return pptxParserDefaults.textStyle.align;
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
    fill: pptxVisualStyle.getHexColor(
      runProperties ??
        paragraphDefaultRunProperties ??
        listDefaultRunProperties ??
        inheritedRunProperties ??
        shape,
      pptxParserDefaults.textStyle.fill,
      theme,
    ),
    fontFamily: font && !font.startsWith('+') ? font : pptxParserDefaults.textStyle.fontFamily,
    fontSize,
    fontWeight: bold ? 700 : pptxParserDefaults.textStyle.fontWeight,
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
    autoFit: bodyProperties && pptxXml.firstDescendant(bodyProperties, 'normAutofit') ? 'shrink-text' : 'none',
    insets: {
      bottom: getTextInset(bodyProperties, 'bIns', pptxParserDefaults.textInsetsEmu.bottom, scaleY),
      left: getTextInset(bodyProperties, 'lIns', pptxParserDefaults.textInsetsEmu.left, scaleX),
      right: getTextInset(bodyProperties, 'rIns', pptxParserDefaults.textInsetsEmu.right, scaleX),
      top: getTextInset(bodyProperties, 'tIns', pptxParserDefaults.textInsetsEmu.top, scaleY),
    },
    verticalAlign: anchor === 'b' ? 'bottom' : anchor === 'ctr' ? 'middle' : 'top',
  };
}

export const pptxTextParser = {
  getPlaceholderFallbackText,
  getPlaceholderRole,
  getPlaceholderType,
  getPresentationTextDefaults,
  getTextBox,
  getTextParagraphs,
  getTextStyle,
  parseSpeakerNotes,
};
