import type { PlaceholderRole } from '../../../domain/documents/model';
import type {
  ParseContext,
  PptxTextBox,
  PptxTextBoxOverrides,
  PptxTextDefaults,
  PptxTextParagraph,
  PptxTextRun,
  PptxTextStyle,
  PptxTextStyleOverrides,
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

function getTextBody(shape: Element) {
  return pptxXml.firstDescendant(shape, 'txBody');
}

function getDominantRunProperties(paragraph: Element | undefined) {
  const runs = paragraph ? pptxXml.descendants(paragraph, 'r') : [];
  const run = runs.reduce<Element | undefined>((dominant, candidate) => {
    if (!dominant) return candidate;
    const dominantLength = pptxXml.textContent(dominant, 't').trim().length;
    const candidateLength = pptxXml.textContent(candidate, 't').trim().length;
    return candidateLength > dominantLength ? candidate : dominant;
  }, undefined);
  return run ? pptxXml.firstDescendant(run, 'rPr') : undefined;
}

function getParagraphDefaultRunProperties(paragraphProperties: Element | undefined) {
  return paragraphProperties ? pptxXml.firstDescendant(paragraphProperties, 'defRPr') : undefined;
}

function getListParagraphProperties(shape: Element) {
  const textBody = getTextBody(shape);
  const listStyle = textBody ? pptxXml.childElements(textBody, 'lstStyle')[0] : undefined;
  return listStyle ? pptxXml.childElements(listStyle, 'lvl1pPr')[0] : undefined;
}

function getListDefaultRunProperties(shape: Element) {
  const listParagraphProperties = getListParagraphProperties(shape);
  return listParagraphProperties ? pptxXml.firstDescendant(listParagraphProperties, 'defRPr') : undefined;
}

function getTextBodyListDefaultRunProperties(shape: Element) {
  const textBody = getTextBody(shape);
  const listStyle = textBody ? pptxXml.childElements(textBody, 'lstStyle')[0] : undefined;
  const listParagraphProperties = listStyle ? pptxXml.childElements(listStyle, 'lvl1pPr')[0] : undefined;
  return listParagraphProperties ? pptxXml.childElements(listParagraphProperties, 'defRPr')[0] : undefined;
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

function hasTypeface(...runProperties: Array<Element | undefined>) {
  return Boolean(getTypeface(...runProperties));
}

function getTextPropertyColor(
  propertyName: 'highlight' | 'solidFill',
  theme: PptxTheme | undefined,
  element: Element | undefined,
) {
  if (!element) return undefined;
  const propertyScope =
    element.localName === 'sp' ? pptxXml.firstDescendant(element, 'spPr') : element;
  const property = propertyScope
    ? pptxXml.childElements(propertyScope, propertyName)[0]
    : undefined;
  return property ? pptxVisualStyle.getHexColor(property, '', theme) || undefined : undefined;
}

function hasFill(theme: PptxTheme | undefined, ...elements: Array<Element | undefined>) {
  return elements.some((element) => Boolean(getTextPropertyColor('solidFill', theme, element)));
}

function hasHighlight(theme: PptxTheme | undefined, ...elements: Array<Element | undefined>) {
  return elements.some((element) => Boolean(getTextPropertyColor('highlight', theme, element)));
}

function hasLineSpacing(...paragraphProperties: Array<Element | undefined>) {
  return paragraphProperties.some((properties) =>
    Boolean(properties ? pptxXml.firstDescendant(properties, 'lnSpc') : undefined),
  );
}

function getLocalStyleSources(shape: Element) {
  const paragraph = getFirstParagraph(shape);
  const paragraphProperties = paragraph ? pptxXml.firstDescendant(paragraph, 'pPr') : undefined;
  const runProperties = getDominantRunProperties(paragraph);
  const paragraphDefaultRunProperties = getParagraphDefaultRunProperties(paragraphProperties);
  const textBodyListDefaultRunProperties = getTextBodyListDefaultRunProperties(shape);
  const listParagraphProperties = getListParagraphProperties(shape);
  const listDefaultRunProperties = getListDefaultRunProperties(shape);
  return {
    listDefaultRunProperties,
    listParagraphProperties,
    paragraphDefaultRunProperties,
    paragraphProperties,
    runProperties,
    textBodyListDefaultRunProperties,
  };
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
  const {
    listDefaultRunProperties,
    listParagraphProperties,
    paragraphDefaultRunProperties,
    paragraphProperties,
    runProperties,
    textBodyListDefaultRunProperties,
  } = getLocalStyleSources(shape);
  // A direct run property applies only to that DrawingML run. For placeholders,
  // the object-wide base continues to inherit from the layout or master.
  const objectRunProperties = placeholderRole ? undefined : runProperties;
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
      objectRunProperties,
      paragraphDefaultRunProperties,
      textBodyListDefaultRunProperties,
      listDefaultRunProperties,
      roleRunProperties,
      inheritedRunProperties,
      fallbackInheritedRunProperties,
      textDefaults.defaultRunProperties,
    ),
  );
  const font = getTypeface(
    objectRunProperties,
    paragraphDefaultRunProperties,
    textBodyListDefaultRunProperties,
    listDefaultRunProperties,
    roleRunProperties,
    inheritedRunProperties,
    fallbackInheritedRunProperties,
    textDefaults.defaultRunProperties,
  );
  const resolvedFont = resolveThemeFontFamily(font, theme);
  const bold = hasEnabledBold(
    objectRunProperties,
    paragraphDefaultRunProperties,
    textBodyListDefaultRunProperties,
    listDefaultRunProperties,
    roleRunProperties,
    inheritedRunProperties,
    fallbackInheritedRunProperties,
    textDefaults.defaultRunProperties,
  );
  const capitalization = getFirstAttribute(
    'cap',
    objectRunProperties,
    paragraphDefaultRunProperties,
    textBodyListDefaultRunProperties,
    listDefaultRunProperties,
    roleRunProperties,
    inheritedRunProperties,
    fallbackInheritedRunProperties,
    textDefaults.defaultRunProperties,
  );
  const fontSize = getFontSize(size, scaleY);
  const highlight = getOptionalTextHighlight(
    theme,
    paragraphDefaultRunProperties,
    textBodyListDefaultRunProperties,
    listDefaultRunProperties,
    roleRunProperties,
    inheritedRunProperties,
    fallbackInheritedRunProperties,
  );
  return {
    align: getTextAlign(paragraphProperties, listParagraphProperties, textDefaults, fontSize, verticalAlign),
    ...(capitalization === 'all' ? { capitalization: 'all' as const } : {}),
    fill: getTextFill(
      theme,
      objectRunProperties,
      paragraphDefaultRunProperties,
      textBodyListDefaultRunProperties,
      listDefaultRunProperties,
      roleRunProperties,
      inheritedRunProperties,
      fallbackInheritedRunProperties,
      shape,
    ),
    fontFamily: resolvedFont ?? pptxParserDefaults.textStyle.fontFamily,
    fontSize,
    fontWeight: bold ? 700 : pptxParserDefaults.textStyle.fontWeight,
    ...(highlight ? { highlight } : {}),
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
    const color = getTextPropertyColor('solidFill', theme, element);
    if (color) return color;
  }
  return pptxParserDefaults.textStyle.fill;
}

function getTextStyleOverrides(
  shape: Element,
  theme: PptxTheme | undefined,
  placeholderRole?: PlaceholderRole,
): PptxTextStyleOverrides {
  const {
    listDefaultRunProperties,
    listParagraphProperties,
    paragraphDefaultRunProperties,
    paragraphProperties,
    runProperties,
    textBodyListDefaultRunProperties,
  } = getLocalStyleSources(shape);
  const runSources = [
    ...(placeholderRole ? [] : [runProperties]),
    paragraphDefaultRunProperties,
    textBodyListDefaultRunProperties,
    listDefaultRunProperties,
  ];
  const overrides: PptxTextStyleOverrides = {};
  if (getFirstAttribute('algn', paragraphProperties, listParagraphProperties)) overrides.align = true;
  if (getFirstAttribute('cap', ...runSources)) overrides.capitalization = true;
  if (hasFill(theme, ...runSources, shape)) overrides.fill = true;
  if (
    hasHighlight(
      theme,
      paragraphDefaultRunProperties,
      textBodyListDefaultRunProperties,
      listDefaultRunProperties,
    )
  ) {
    overrides.highlight = true;
  }
  if (hasTypeface(...runSources)) overrides.fontFamily = true;
  if (getFirstAttribute('sz', ...runSources)) overrides.fontSize = true;
  if (getFirstAttribute('b', ...runSources)) overrides.fontWeight = true;
  if (hasLineSpacing(paragraphProperties, listParagraphProperties)) overrides.lineHeight = true;
  if (pptxXml.firstDescendant(shape, 'bodyPr')?.getAttribute('anchor')) overrides.verticalAlign = true;
  return overrides;
}

function applyRunCapitalization(text: string, runProperties: Element | undefined) {
  const capitalization = runProperties?.getAttribute('cap');
  if (capitalization === 'all') return text.toLocaleUpperCase();
  return text;
}

function getParagraphProperties(paragraph: Element) {
  return pptxXml.childElements(paragraph, 'pPr')[0];
}

function getParagraphLevel(paragraphProperties: Element | undefined) {
  const level = Number(paragraphProperties?.getAttribute('lvl'));
  return Number.isInteger(level) && level >= 0 && level <= 8 ? level : 0;
}

function getParagraphListProperties(shape: Element, paragraph: Element) {
  const textBody = getTextBody(shape);
  const listStyle = textBody ? pptxXml.childElements(textBody, 'lstStyle')[0] : undefined;
  return listStyle
    ? pptxXml.childElements(listStyle, `lvl${getParagraphLevel(getParagraphProperties(paragraph)) + 1}pPr`)[0]
    : undefined;
}

function getParagraphBullet(shape: Element, paragraph: Element) {
  const paragraphProperties = getParagraphProperties(paragraph);
  const listProperties = getParagraphListProperties(shape, paragraph);
  if (
    (paragraphProperties && pptxXml.firstDescendant(paragraphProperties, 'buNone')) ||
    (!paragraphProperties && listProperties && pptxXml.firstDescendant(listProperties, 'buNone'))
  ) {
    return '';
  }
  const bullet =
    (paragraphProperties
      ? pptxXml.firstDescendant(paragraphProperties, 'buChar')?.getAttribute('char')
      : undefined) ??
    (listProperties ? pptxXml.firstDescendant(listProperties, 'buChar')?.getAttribute('char') : undefined);
  return bullet ? `${bullet} ` : '';
}

function getParagraphText(shape: Element, paragraph: Element) {
  const runs = pptxXml.descendants(paragraph, 'r');
  const text =
    runs.length === 0
      ? pptxXml.textContent(paragraph, 't')
      : runs
          .map((run) => {
            const runProperties = pptxXml.firstDescendant(run, 'rPr');
            return applyRunCapitalization(pptxXml.textContent(run, 't'), runProperties);
          })
          .join('');
  return `${getParagraphBullet(shape, paragraph)}${text}`;
}

function getTextParagraphs(shape: Element) {
  const body = getTextBody(shape);
  const paragraphs = body ? pptxXml.descendants(body, 'p') : [];
  return paragraphs
    .map((paragraph) => getParagraphText(shape, paragraph).replace(/[ \t\r\f\v]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function getOptionalTextFill(theme: PptxTheme | undefined, ...elements: Array<Element | undefined>) {
  for (const element of elements) {
    const color = getTextPropertyColor('solidFill', theme, element);
    if (color) return color;
  }
  return undefined;
}

function getOptionalTextHighlight(
  theme: PptxTheme | undefined,
  ...elements: Array<Element | undefined>
) {
  for (const element of elements) {
    const color = getTextPropertyColor('highlight', theme, element);
    if (color) return color;
  }
  return undefined;
}

function getParagraphLength(
  attributeName: 'indent' | 'marL',
  paragraphProperties: Element | undefined,
  listProperties: Element | undefined,
  scaleX: number,
) {
  const rawValue = getFirstAttribute(attributeName, paragraphProperties, listProperties);
  const value = Number(rawValue);
  return Number.isFinite(value) ? Math.round(value * scaleX) : 0;
}

function getParagraphSpacing(
  spacingName: 'spcAft' | 'spcBef',
  paragraphProperties: Element | undefined,
  listProperties: Element | undefined,
  scaleY: number,
) {
  for (const properties of [paragraphProperties, listProperties]) {
    const spacing = properties ? pptxXml.firstDescendant(properties, spacingName) : undefined;
    const points = Number(
      spacing ? pptxXml.firstDescendant(spacing, 'spcPts')?.getAttribute('val') : undefined,
    );
    if (Number.isFinite(points)) return Math.round((points / 100) * EMUS_PER_POINT * scaleY);
  }
  return 0;
}

function getUniformTextDecoration(paragraph: Element): PptxTextParagraph['textDecoration'] {
  const runs = pptxXml
    .descendants(paragraph, 'r')
    .filter((run) => Boolean(pptxXml.textContent(run, 't').trim()));
  if (runs.length === 0) return undefined;
  const runProperties = runs.map((run) => pptxXml.firstDescendant(run, 'rPr'));
  if (
    runProperties.every((properties) => {
      const underline = properties?.getAttribute('u');
      return Boolean(underline && underline !== 'none');
    })
  ) {
    return 'underline';
  }
  if (
    runProperties.every((properties) => {
      const strike = properties?.getAttribute('strike');
      return Boolean(strike && strike !== 'noStrike');
    })
  ) {
    return 'line-through';
  }
  return undefined;
}

function getTextDecoration(
  ...properties: Array<Element | undefined>
): PptxTextRun['textDecoration'] {
  const underline = getFirstAttribute('u', ...properties);
  if (underline && underline !== 'none') return 'underline';
  const strike = getFirstAttribute('strike', ...properties);
  if (strike && strike !== 'noStrike') return 'line-through';
  return undefined;
}

function getTextRun(
  text: string,
  properties: Array<Element | undefined>,
  scaleY: number,
  theme: PptxTheme | undefined,
  fallback: PptxTextRun,
  trackOverrides = false,
): PptxTextRun {
  const rawSize = Number(getFirstAttribute('sz', ...properties));
  const font = resolveThemeFontFamily(getTypeface(...properties), theme);
  const bold = getFirstAttribute('b', ...properties);
  const italic = getFirstAttribute('i', ...properties);
  const decoration = getTextDecoration(...properties);
  const highlight = getOptionalTextHighlight(theme, ...properties) ?? fallback.highlight;
  const explicitProperties = properties[0];
  const styleOverrides = trackOverrides
    ? {
        ...(getTextPropertyColor('solidFill', theme, explicitProperties)
          ? { fill: true as const }
          : {}),
        ...(hasTypeface(explicitProperties) ? { fontFamily: true as const } : {}),
        ...(explicitProperties?.getAttribute('sz') ? { fontSize: true as const } : {}),
        ...(explicitProperties?.getAttribute('i') ? { fontStyle: true as const } : {}),
        ...(explicitProperties?.getAttribute('b') ? { fontWeight: true as const } : {}),
        ...(getTextPropertyColor('highlight', theme, explicitProperties)
          ? { highlight: true as const }
          : {}),
        ...(getTextDecoration(explicitProperties) ? { textDecoration: true as const } : {}),
      }
    : undefined;
  return {
    fill: getOptionalTextFill(theme, ...properties) ?? fallback.fill,
    fontFamily: font ?? fallback.fontFamily,
    fontSize:
      Number.isFinite(rawSize) && rawSize > 0 ? getFontSize(rawSize, scaleY) : fallback.fontSize,
    fontStyle: italic === '1' ? 'italic' : italic === '0' ? 'normal' : fallback.fontStyle,
    fontWeight: bold === '1' ? 700 : bold === '0' ? 400 : fallback.fontWeight,
    ...(highlight ? { highlight } : {}),
    text,
    ...(decoration ? { textDecoration: decoration } : {}),
    ...(styleOverrides && Object.keys(styleOverrides).length > 0 ? { styleOverrides } : {}),
  };
}

function getTextParagraphFormats(
  shape: Element,
  scaleX: number,
  scaleY: number,
  textDefaults: PptxTextDefaults,
  theme: PptxTheme | undefined,
  placeholderRole: PlaceholderRole | undefined,
  fallbackStyle: PptxTextStyle,
): PptxTextParagraph[] {
  const body = getTextBody(shape);
  const paragraphs = body ? pptxXml.descendants(body, 'p') : [];
  const roleRunProperties = getRoleRunProperties(placeholderRole, textDefaults);
  return paragraphs.flatMap((paragraph) => {
    const text = getParagraphText(shape, paragraph).replace(/[ \t\r\f\v]+/g, ' ').trim();
    if (!text) return [];
    const paragraphProperties = getParagraphProperties(paragraph);
    const listProperties = getParagraphListProperties(shape, paragraph);
    const runProperties = getDominantRunProperties(paragraph);
    const paragraphDefaultRunProperties = getParagraphDefaultRunProperties(paragraphProperties);
    const listDefaultRunProperties = getParagraphDefaultRunProperties(listProperties);
    const runSources = [
      runProperties,
      paragraphDefaultRunProperties,
      listDefaultRunProperties,
      roleRunProperties,
    ];
    const baseRun: PptxTextRun = {
      fill: fallbackStyle.fill,
      fontFamily: fallbackStyle.fontFamily,
      fontSize: fallbackStyle.fontSize,
      fontStyle: 'normal',
      fontWeight: fallbackStyle.fontWeight,
      ...(fallbackStyle.highlight ? { highlight: fallbackStyle.highlight } : {}),
      text,
    };
    const inheritedRun = getTextRun(
      text,
      [paragraphDefaultRunProperties, listDefaultRunProperties, roleRunProperties],
      scaleY,
      theme,
      baseRun,
    );
    const paragraphRun = getTextRun(text, runSources, scaleY, theme, inheritedRun);
    const fontSize = paragraphRun.fontSize;
    const verticalAlign = getVerticalAlign(shape);
    const bulletText = getParagraphBullet(shape, paragraph);
    const bulletColor = paragraphProperties
      ? pptxXml.firstDescendant(paragraphProperties, 'buClr')
      : listProperties
        ? pptxXml.firstDescendant(listProperties, 'buClr')
        : undefined;
    const bulletFont = paragraphProperties
      ? pptxXml.firstDescendant(paragraphProperties, 'buFont')?.getAttribute('typeface')
      : listProperties
        ? pptxXml.firstDescendant(listProperties, 'buFont')?.getAttribute('typeface')
        : undefined;
    const bulletSize = Number(
      (paragraphProperties
        ? pptxXml.firstDescendant(paragraphProperties, 'buSzPts')
        : listProperties
          ? pptxXml.firstDescendant(listProperties, 'buSzPts')
          : undefined
      )?.getAttribute('val'),
    );
    const runs: PptxTextRun[] = [
      ...(bulletText
        ? [
            {
              ...inheritedRun,
              fill: pptxVisualStyle.getHexColor(bulletColor, '', theme) || fallbackStyle.fill,
              ...(bulletFont ? { fontFamily: bulletFont } : {}),
              ...(Number.isFinite(bulletSize) && bulletSize > 0
                ? { fontSize: getFontSize(bulletSize, scaleY) }
                : {}),
              text: bulletText,
            },
          ]
        : []),
      ...pptxXml.descendants(paragraph, 'r').flatMap((run) => {
        const runText = applyRunCapitalization(
          pptxXml.textContent(run, 't'),
          pptxXml.firstDescendant(run, 'rPr'),
        );
        if (!runText) return [];
        return [
          getTextRun(
            runText,
            [
              pptxXml.firstDescendant(run, 'rPr'),
              paragraphDefaultRunProperties,
              listDefaultRunProperties,
              roleRunProperties,
            ],
            scaleY,
            theme,
            inheritedRun,
            true,
          ),
        ];
      }),
    ];
    return [
      {
        align: getTextAlign(
          paragraphProperties,
          listProperties,
          textDefaults,
          fontSize,
          verticalAlign,
        ),
        fill: paragraphRun.fill,
        fontFamily: paragraphRun.fontFamily,
        fontSize: paragraphRun.fontSize,
        fontStyle: paragraphRun.fontStyle,
        fontWeight: paragraphRun.fontWeight,
        indent: getParagraphLength('indent', paragraphProperties, listProperties, scaleX),
        lineHeight: getLineHeight(paragraphProperties, listProperties),
        marginLeft: getParagraphLength('marL', paragraphProperties, listProperties, scaleX),
        ...(runs.length > 0 ? { runs } : {}),
        spaceAfter: getParagraphSpacing('spcAft', paragraphProperties, listProperties, scaleY),
        spaceBefore: getParagraphSpacing('spcBef', paragraphProperties, listProperties, scaleY),
        text,
        ...(getUniformTextDecoration(paragraph)
          ? { textDecoration: getUniformTextDecoration(paragraph)! }
          : {}),
        verticalAlign,
      },
    ];
  });
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
  const normalAutoFit = bodyProperties
    ? pptxXml.firstDescendant(bodyProperties, 'normAutofit')
    : undefined;
  const rawFontScale = Number(normalAutoFit?.getAttribute('fontScale'));
  const fontScale =
    Number.isFinite(rawFontScale) && rawFontScale > 0 ? Math.min(1, rawFontScale / 100000) : undefined;
  return {
    autoFit: normalAutoFit ? 'shrink-text' : 'none',
    ...(fontScale !== undefined ? { fontScale } : {}),
    insets: {
      bottom: getTextInset(bodyProperties, 'bIns', pptxParserDefaults.textInsetsEmu.bottom, scaleY),
      left: getTextInset(bodyProperties, 'lIns', pptxParserDefaults.textInsetsEmu.left, scaleX),
      right: getTextInset(bodyProperties, 'rIns', pptxParserDefaults.textInsetsEmu.right, scaleX),
      top: getTextInset(bodyProperties, 'tIns', pptxParserDefaults.textInsetsEmu.top, scaleY),
    },
    verticalAlign: anchor === 'b' ? 'bottom' : anchor === 'ctr' ? 'middle' : 'top',
    verticalOverflow:
      bodyProperties?.getAttribute('vertOverflow') === 'clip' ? 'clip' : 'overflow',
  };
}

function getTextBoxOverrides(shape: Element): PptxTextBoxOverrides {
  const bodyProperties = pptxXml.firstDescendant(shape, 'bodyPr');
  const overrides: PptxTextBoxOverrides = {};
  if (!bodyProperties) return overrides;
  if (pptxXml.firstDescendant(bodyProperties, 'normAutofit')) overrides.autoFit = true;
  if (bodyProperties.getAttribute('anchor')) overrides.verticalAlign = true;
  if (bodyProperties.getAttribute('vertOverflow')) overrides.verticalOverflow = true;
  if (
    bodyProperties.getAttribute('bIns') !== null ||
    bodyProperties.getAttribute('lIns') !== null ||
    bodyProperties.getAttribute('rIns') !== null ||
    bodyProperties.getAttribute('tIns') !== null
  ) {
    overrides.insets = true;
  }
  return overrides;
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
  getTextBoxOverrides,
  getTextParagraphFormats,
  getTextParagraphs,
  getTextStyle,
  getTextStyleOverrides,
  parseSpeakerNotes,
};
