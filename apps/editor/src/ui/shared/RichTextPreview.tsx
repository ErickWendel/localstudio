import type { TextElement } from '../../domain/documents/model';

export function RichTextPreview({
  element,
  pageWidth,
}: {
  element: TextElement;
  pageWidth: number;
}) {
  if (!element.paragraphs?.length) return element.text;
  return element.paragraphs.map((paragraph, paragraphIndex) => (
    <span
      key={`${paragraphIndex}-${paragraph.text}`}
      style={{
        color: paragraph.fill,
        display: 'block',
        fontFamily: paragraph.fontFamily,
        fontSize: `${Math.max(4, (paragraph.fontSize / pageWidth) * 100)}cqw`,
        fontStyle: paragraph.fontStyle,
        fontWeight: paragraph.fontWeight,
        backgroundColor: paragraph.highlight,
        textAlign: paragraph.align,
        textDecoration: paragraph.textDecoration,
      }}
    >
      {paragraph.runs?.length
        ? paragraph.runs.map((run, runIndex) => (
            <span
              key={`${runIndex}-${run.text}`}
              style={{
                color: run.fill,
                fontFamily: run.fontFamily,
                fontSize: `${Math.max(4, (run.fontSize / pageWidth) * 100)}cqw`,
                fontStyle: run.fontStyle,
                fontWeight: run.fontWeight,
                backgroundColor: run.highlight,
                boxDecorationBreak: 'clone',
                textDecoration: run.textDecoration,
                WebkitBoxDecorationBreak: 'clone',
              }}
            >
              {run.text}
            </span>
          ))
        : paragraph.text}
    </span>
  ));
}
