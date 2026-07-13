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
    bodyParagraphProperties: undefined,
    bodyRunProperties: undefined,
    defaultParagraphProperties,
    defaultRunProperties: getParagraphDefaultRunProperties(defaultParagraphProperties),
    listParagraphProperties,
    listRunProperties: getParagraphDefaultRunProperties(listParagraphProperties),
    titleParagraphProperties: undefined,
    titleRunProperties: undefined,
  };
}

function getMasterTextDefaults(document: Document, baseDefaults: PptxTextDefaults): PptxTextDefaults {
  const titleStyle = pptxXml.firstDescendant(document, 'titleStyle');
  const bodyStyle = pptxXml.firstDescendant(document, 'bodyStyle');
  const titleParagraphProperties = titleStyle ? pptxXml.firstDescendant(titleStyle, 'lvl1pPr') : undefined;
  const bodyParagraphProperties = bodyStyle ? pptxXml.firstDescendant(bodyStyle, 'lvl1pPr') : undefined;
  return {
    ...baseDefaults,
    bodyParagraphProperties: bodyParagraphProperties ?? baseDefaults.bodyParagraphProperties,
    bodyRunProperties: getParagraphDefaultRunProperties(bodyParagraphProperties) ?? baseDefaults.bodyRunProperties,
    titleParagraphProperties: titleParagraphProperties ?? baseDefaults.titleParagraphProperties,
    titleRunProperties: getParagraphDefaultRunProperties(titleParagraphProperties) ?? baseDefaults.titleRunProperties,
  };
}

function getPlaceholderType(shape: Element) {
  return pptxXml.firstDescendant(shape, 'ph')?.getAttribute('type');
}

function getPlaceholderIndex(shape: Element) {
  return pptxXml.firstDescendant(shape, 'ph')?.getAttribute('idx') ?? undefined;
}

function getPlaceholderRole(shape: Element): PlaceholderRole | undefined {
  const placeholder = pptxXml.firstDescendant(shape, 'ph');
  if (!placeholder) return undefined;
  const type = getPlaceholderType(shape);
  if (type === 'title' || type === 'ctrTitle') return 'title';
  if (type === 'body' || type === 'obj' || type === 'subTitle') return 'body';
  if (type === 'ftr') return 'footer';
  if (type === 'sldNum') return 'slideNumber';
  if (!type) return 'body';
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

function getRoleParagraphProperties(
  role: PlaceholderRole | undefined,
  textDefaults: PptxTextDefaults,
) {
  if (role === 'title') return textDefaults.titleParagraphProperties;
  if (role === 'body') return textDefaults.bodyParagraphProperties;
  return undefined;
}

function getRoleRunProperties(role: PlaceholderRole | undefined, textDefaults: PptxTextDefaults) {
  if (role === 'title') return textDefaults.titleRunProperties;
  if (role === 'body') return textDefaults.bodyRunProperties;
  return undefined;
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

function resolveThemeFontFamily(font: string | undefined, theme: PptxTheme | undefined) {
  if (!font) return undefined;
  if (font === '+mj-lt' || font === '+mj-ea' || font === '+mj-cs') {
    return theme?.majorFontFamily;
  }
  if (font === '+mn-lt' || font === '+mn-ea' || font === '+mn-cs') {
    return theme?.minorFontFamily;
  }
  if (font.startsWith('+')) return undefined;
  return font;
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
  placeholderRole?: PlaceholderRole,
): PptxTextStyle {
  const paragraph = getFirstParagraph(shape);
  const paragraphProperties = paragraph ? pptxXml.firstDescendant(paragraph, 'pPr') : undefined;
  const runProperties = getFirstRunProperties(paragraph);
  const paragraphDefaultRunProperties = getParagraphDefaultRunProperties(paragraphProperties);
  const listParagraphProperties = getListParagraphProperties(shape);
  const listDefaultRunProperties = getListDefaultRunProperties(shape);
  const verticalAlign = getVerticalAlign(shape);
  const roleParagraphProperties = getRoleParagraphProperties(placeholderRole, textDefaults);
  const roleRunProperties = getRoleRunProperties(placeholderRole, textDefaults);
  const inheritedRunProperties =
    verticalAlign === 'middle' ? textDefaults.listRunProperties : textDefaults.defaultRunProperties;
  const fallbackInheritedRunProperties =
    verticalAlign === 'middle' ? textDefaults.defaultRunProperties : textDefaults.listRunProperties;
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
      roleRunProperties,
      inheritedRunProperties,
      fallbackInheritedRunProperties,
      textDefaults.defaultRunProperties,
    ),
  );
  const font = getTypeface(
    runProperties,
    paragraphDefaultRunProperties,
    listDefaultRunProperties,
    roleRunProperties,
    inheritedRunProperties,
    fallbackInheritedRunProperties,
    textDefaults.defaultRunProperties,
  );
  const resolvedFont = resolveThemeFontFamily(font, theme);
  const bold = hasEnabledBold(
    runProperties,
    paragraphDefaultRunProperties,
    listDefaultRunProperties,
    roleRunProperties,
    inheritedRunProperties,
    fallbackInheritedRunProperties,
    textDefaults.defaultRunProperties,
  );
  const capitalization = getFirstAttribute(
    'cap',
    runProperties,
    paragraphDefaultRunProperties,
    listDefaultRunProperties,
    roleRunProperties,
    inheritedRunProperties,
    fallbackInheritedRunProperties,
    textDefaults.defaultRunProperties,
  );
  const fontSize = getFontSize(size, scaleY);
  return {
    align: getTextAlign(paragraphProperties, listParagraphProperties, textDefaults, fontSize, verticalAlign),
    ...(capitalization === 'all' ? { capitalization: 'all' as const } : {}),
    fill: getTextFill(
      theme,
      runProperties,
      paragraphDefaultRunProperties,
      listDefaultRunProperties,
      roleRunProperties,
      inheritedRunProperties,
      fallbackInheritedRunProperties,
      shape,
    ),
    fontFamily: resolvedFont ?? pptxParserDefaults.textStyle.fontFamily,
    fontSize,
    fontWeight: bold ? 700 : pptxParserDefaults.textStyle.fontWeight,
    lineHeight: getLineHeight(
      paragraphProperties,
      listParagraphProperties,
      roleParagraphProperties,
      inheritedParagraphProperties,
    ),
    verticalAlign,
  };
}

function getTextFill(theme: PptxTheme | undefined, ...elements: Array<Element | undefined>) {
  for (const element of elements) {
    const color = pptxVisualStyle.getHexColor(element, '', theme);
    if (color) return color;
  }
  return pptxParserDefaults.textStyle.fill;
}

function applyRunCapitalization(text: string, runProperties: Element | undefined) {
  const capitalization = runProperties?.getAttribute('cap');
  if (capitalization === 'all') return text.toLocaleUpperCase();
  return text;
}

function getParagraphText(paragraph: Element) {
  const runs = pptxXml.descendants(paragraph, 'r');
  if (runs.length === 0) return pptxXml.textContent(paragraph, 't');
  return runs
    .map((run) => {
      const runProperties = pptxXml.firstDescendant(run, 'rPr');
      return applyRunCapitalization(pptxXml.textContent(run, 't'), runProperties);
    })
    .join('');
}

function getTextParagraphs(shape: Element) {
  const body = pptxXml.firstDescendant(shape, 'txBody');
  const paragraphs = body ? pptxXml.descendants(body, 'p') : [];
  return paragraphs
    .map((paragraph) => getParagraphText(paragraph).replace(/[ \t\r\f\v]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function applyTextStyle(text: string, style: PptxTextStyle) {
  if (style.capitalization === 'all') return text.toLocaleUpperCase();
  return text;
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
  applyTextStyle,
  getMasterTextDefaults,
  getPlaceholderFallbackText,
  getPlaceholderIndex,
  getPlaceholderRole,
  getPlaceholderType,
  getPresentationTextDefaults,
  getTextBox,
  getTextParagraphs,
  getTextStyle,
  parseSpeakerNotes,
};
