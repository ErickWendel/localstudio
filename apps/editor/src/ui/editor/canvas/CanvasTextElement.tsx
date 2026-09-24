import Konva from 'konva';
import { Group, Rect, Text } from 'react-konva';
import type { TextElement, TextParagraph, TextRun } from '../../../domain/documents/model';
import type { CommonElementProps } from './canvas-element-props';
import { textGlyphMeasure } from './textGlyphMeasure';
import type { GlyphMetrics } from './textGlyphMeasure';

const TEXT_FRAME_PADDING = 6;

interface CanvasTextElementProps {
  commonProps: CommonElementProps;
  displayText: string;
  element: TextElement;
  nodeRef: (node: Konva.Node | null) => void;
  scale: { x: number; y: number };
  visible: boolean;
}

function getFontStyle(text: Pick<TextRun, 'fontStyle' | 'fontWeight'>) {
  const bold = text.fontWeight >= 700;
  if (bold && text.fontStyle === 'italic') return 'bold italic';
  if (bold) return 'bold';
  return text.fontStyle;
}

interface TextFragmentLayout {
  metrics: GlyphMetrics;
  run: TextRun;
  text: string;
  width: number;
  x: number;
}

interface TextLineLayout {
  fragments: TextFragmentLayout[];
  height: number;
  width: number;
  y: number;
}

function getParagraphRuns(paragraph: TextParagraph): TextRun[] {
  return paragraph.runs?.length
    ? paragraph.runs
    : [
        {
          fill: paragraph.fill,
          fontFamily: paragraph.fontFamily,
          fontSize: paragraph.fontSize,
          fontStyle: paragraph.fontStyle,
          fontWeight: paragraph.fontWeight,
          ...(paragraph.highlight ? { highlight: paragraph.highlight } : {}),
          text: paragraph.text,
          ...(paragraph.textDecoration ? { textDecoration: paragraph.textDecoration } : {}),
        },
      ];
}

function getFillForTextIndex(element: TextElement, index: number) {
  return (
    element.colorRanges?.find((range) => range.start <= index && index < range.end)?.fill ??
    element.fill
  );
}

function getSyntheticParagraph(element: TextElement): TextParagraph {
  const runs: TextRun[] = [];
  let currentText = '';
  let currentFill = getFillForTextIndex(element, 0);

  for (let index = 0; index < element.text.length; index += 1) {
    const character = element.text[index] ?? '';
    const fill = getFillForTextIndex(element, index);
    if (fill !== currentFill && currentText) {
      runs.push({
        fill: currentFill,
        fontFamily: element.fontFamily,
        fontSize: element.fontSize,
        fontStyle: 'normal',
        fontWeight: element.fontWeight,
        text: currentText,
      });
      currentText = '';
    }
    currentFill = fill;
    currentText += character;
  }

  if (currentText) {
    runs.push({
      fill: currentFill,
      fontFamily: element.fontFamily,
      fontSize: element.fontSize,
      fontStyle: 'normal',
      fontWeight: element.fontWeight,
      text: currentText,
    });
  }

  return {
    align: element.align,
    fill: element.fill,
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    fontStyle: 'normal',
    fontWeight: element.fontWeight,
    indent: 0,
    lineHeight: element.lineHeight ?? 1.05,
    marginLeft: 0,
    runs,
    spaceAfter: 0,
    spaceBefore: 0,
    text: element.text,
  };
}

function layoutParagraph(paragraph: TextParagraph, width: number, scaleY: number) {
  const lines: TextLineLayout[] = [];
  let fragments: TextFragmentLayout[] = [];
  let lineWidth = 0;
  let lineHeight = 0;

  const finishLine = () => {
    if (fragments.length === 0) return;
    const y = lines.reduce((height, line) => height + line.height, 0);
    const overflowLeft = fragments[0]?.metrics.overflowLeft ?? 0;
    const overflowRight = fragments.at(-1)?.metrics.overflowRight ?? 0;
    lines.push({
      fragments,
      height: lineHeight,
      width: lineWidth + overflowLeft + overflowRight,
      y,
    });
    fragments = [];
    lineWidth = 0;
    lineHeight = 0;
  };

  for (const run of getParagraphRuns(paragraph)) {
    const tokens = run.text.match(/\S+\s*|\s+/g) ?? [];
    for (const token of tokens) {
      const tokenMetrics = textGlyphMeasure.measure(token, run, scaleY);
      if (fragments.length > 0 && lineWidth + tokenMetrics.advance > width) finishLine();
      const fragmentText = fragments.length === 0 ? token.replace(/^\s+/, '') : token;
      if (!fragmentText) continue;
      const fragmentMetrics =
        fragmentText === token
          ? tokenMetrics
          : textGlyphMeasure.measure(fragmentText, run, scaleY);
      fragments.push({
        metrics: fragmentMetrics,
        run,
        text: fragmentText,
        width: fragmentMetrics.advance,
        x: lineWidth,
      });
      lineWidth += fragmentMetrics.advance;
      lineHeight = Math.max(lineHeight, run.fontSize * scaleY * paragraph.lineHeight);
    }
  }
  finishLine();

  return {
    height: lines.reduce((height, line) => height + line.height, 0),
    lines,
  };
}

export function CanvasTextElement({
  commonProps,
  displayText,
  element,
  nodeRef,
  scale,
  visible,
}: CanvasTextElementProps) {
  const hasInlineColorRanges = Boolean(element.colorRanges?.length && displayText === element.text);
  const paragraphs =
    hasInlineColorRanges ? [getSyntheticParagraph(element)] : element.paragraphs;
  if (!paragraphs?.length || displayText !== element.text) {
    return (
      <Text
        {...commonProps}
        text={displayText}
        fontFamily={element.fontFamily}
        fontSize={element.fontSize * scale.y}
        fontStyle={element.fontWeight >= 700 ? 'bold' : 'normal'}
        fill={element.fill}
        {...(element.stroke && (element.strokeWidth ?? 0) > 0
          ? { stroke: element.stroke, strokeWidth: element.strokeWidth }
          : {})}
        align={element.align}
        lineHeight={element.lineHeight ?? 1.05}
        padding={TEXT_FRAME_PADDING * scale.y}
        ref={nodeRef}
        {...(element.hyperlink ? { textDecoration: 'underline' } : {})}
        verticalAlign={element.verticalAlign ?? 'top'}
        visible={visible}
      />
    );
  }

  const paddingX = TEXT_FRAME_PADDING * scale.x;
  const rows = paragraphs.map((paragraph) => {
    const offsetX = (paragraph.marginLeft + paragraph.indent) * scale.x;
    const x = Math.max(0, paddingX + offsetX);
    const width = Math.max(1, commonProps.width - x - paddingX);
    const layout = layoutParagraph(paragraph, width, scale.y);
    return {
      height: layout.height,
      lines: layout.lines,
      paragraph,
      width,
      x,
    };
  });
  const contentHeight = rows.reduce(
    (height, row) =>
      height +
      row.paragraph.spaceBefore * scale.y +
      row.height +
      row.paragraph.spaceAfter * scale.y,
    0,
  );
  const verticalAlign = element.verticalAlign ?? 'top';
  const allowsVerticalOverflow = element.verticalOverflow === 'overflow';
  const startY =
    verticalAlign === 'middle'
      ? allowsVerticalOverflow
        ? (commonProps.height - contentHeight) / 2
        : Math.max(0, (commonProps.height - contentHeight) / 2)
      : verticalAlign === 'bottom'
        ? allowsVerticalOverflow
          ? commonProps.height - contentHeight - TEXT_FRAME_PADDING * scale.y
          : Math.max(0, commonProps.height - contentHeight - TEXT_FRAME_PADDING * scale.y)
        : TEXT_FRAME_PADDING * scale.y;
  const positionedRows = rows.reduce<Array<(typeof rows)[number] & { y: number }>>(
    (result, row) => {
      const previous = result.at(-1);
      const y = previous
        ? previous.y +
          previous.height +
          previous.paragraph.spaceAfter * scale.y +
          row.paragraph.spaceBefore * scale.y
        : startY + row.paragraph.spaceBefore * scale.y;
      return [...result, { ...row, y }];
    },
    [],
  );
  const renderedParagraphFragments = positionedRows.flatMap(
    ({ lines, paragraph, width, x, y }, paragraphIndex) =>
      lines.flatMap((line, lineIndex) => {
        const alignOffset =
          paragraph.align === 'center'
            ? Math.max(0, (width - line.width) / 2)
            : paragraph.align === 'right'
              ? Math.max(0, width - line.width)
              : 0;
        const inkShift = line.fragments[0]?.metrics.overflowLeft ?? 0;
        return line.fragments.map((fragment, fragmentIndex) => (
          <Group
            key={`${paragraphIndex}-${lineIndex}-${fragmentIndex}-${fragment.text}`}
            listening={!hasInlineColorRanges}
            x={x + alignOffset + inkShift + fragment.x}
            y={y + line.y}
          >
            {fragment.run.highlight ? (
              <Rect
                fill={fragment.run.highlight}
                height={line.height}
                listening={false}
                width={fragment.width}
              />
            ) : null}
            <Text
              fill={fragment.run.fill}
              fontFamily={fragment.run.fontFamily}
              fontSize={fragment.run.fontSize * scale.y}
              fontStyle={getFontStyle(fragment.run)}
              height={line.height}
              lineHeight={paragraph.lineHeight}
              listening={!hasInlineColorRanges}
              padding={0}
              text={fragment.text}
              {...(fragment.run.textDecoration
                ? { textDecoration: fragment.run.textDecoration }
                : {})}
              width={fragment.width}
            />
          </Group>
        ));
      }),
  );

  if (hasInlineColorRanges) {
    return (
      <Group
        {...commonProps}
        ref={nodeRef}
        visible={visible}
      >
        <Rect
          fill="rgba(0,0,0,0.01)"
          height={commonProps.height}
          width={commonProps.width}
        />
        <Group
          listening={false}
        >
          {renderedParagraphFragments}
        </Group>
      </Group>
    );
  }

  return (
    <Group
      {...commonProps}
      ref={nodeRef}
      visible={visible}
    >
      {renderedParagraphFragments}
    </Group>
  );
}
