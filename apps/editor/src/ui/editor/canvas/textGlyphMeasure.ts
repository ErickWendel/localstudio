import Konva from 'konva';
import type { TextRun } from '../../../domain/documents/model';

export interface GlyphMetrics {
  advance: number;
  overflowBottom: number;
  overflowLeft: number;
  overflowRight: number;
  overflowTop: number;
}

const MEASUREMENT_CACHE_LIMIT = 1600;
const measurementCache = new Map<string, GlyphMetrics>();
let measureContext: CanvasRenderingContext2D | null | undefined;

function getFontStyle(text: Pick<TextRun, 'fontStyle' | 'fontWeight'>) {
  const bold = text.fontWeight >= 700;
  if (bold && text.fontStyle === 'italic') return 'bold italic';
  if (bold) return 'bold';
  return text.fontStyle;
}

function fontDeclaration(run: TextRun, scaleY: number) {
  return `${getFontStyle(run)} ${run.fontSize * scaleY}px ${run.fontFamily}`;
}

function isFontReady(font: string) {
  try {
    const fontSet = typeof document === 'undefined' ? undefined : document.fonts;
    if (!fontSet?.check) return true;
    return fontSet.check(font);
  } catch {
    return true;
  }
}

function getMeasureContext() {
  if (measureContext !== undefined) return measureContext;
  if (typeof document === 'undefined') {
    measureContext = null;
    return measureContext;
  }
  measureContext = document.createElement('canvas').getContext('2d');
  return measureContext;
}

function measureWithCanvas(text: string, run: TextRun, scaleY: number, advance: number): GlyphMetrics {
  const context = getMeasureContext();
  if (!context || !text) {
    return {
      advance,
      overflowBottom: 0,
      overflowLeft: 0,
      overflowRight: 0,
      overflowTop: 0,
    };
  }

  context.font = fontDeclaration(run, scaleY);
  const metrics = context.measureText(text);
  const inkLeft = metrics.actualBoundingBoxLeft ?? 0;
  const inkRight = metrics.actualBoundingBoxRight ?? advance;
  const fontSize = run.fontSize * scaleY;
  const inkTop = metrics.actualBoundingBoxAscent ?? fontSize;
  const inkBottom = metrics.actualBoundingBoxDescent ?? fontSize * 0.25;

  return {
    advance,
    overflowBottom: Math.max(0, inkBottom - fontSize * 0.25),
    overflowLeft: Math.max(0, inkLeft),
    overflowRight: Math.max(0, inkRight - advance),
    overflowTop: Math.max(0, inkTop - fontSize),
  };
}

function measure(text: string, run: TextRun, scaleY: number): GlyphMetrics {
  const font = fontDeclaration(run, scaleY);
  const cacheKey = [text, font, scaleY].join('\u0000');
  const fontReady = isFontReady(font);
  if (fontReady) {
    const cached = measurementCache.get(cacheKey);
    if (cached) return cached;
  }

  const measurementNode = new Konva.Text({
    fontFamily: run.fontFamily,
    fontSize: run.fontSize * scaleY,
    fontStyle: getFontStyle(run),
    padding: 0,
    text,
  });
  const advance = measurementNode.width();
  measurementNode.destroy();
  const metrics = measureWithCanvas(text, run, scaleY, advance);
  if (!fontReady) return metrics;

  if (measurementCache.size >= MEASUREMENT_CACHE_LIMIT) measurementCache.clear();
  measurementCache.set(cacheKey, metrics);
  return metrics;
}

function clearCache() {
  measurementCache.clear();
}

function collectTextNodes(node: Konva.Node): Konva.Text[] {
  if (node instanceof Konva.Text) return [node];
  if (!(node instanceof Konva.Container)) return [];
  return node.getChildren().flatMap((child: Konva.Node) => collectTextNodes(child));
}

function lineOverflow(textNode: Konva.Text) {
  const fontSize = textNode.fontSize();
  const fill = textNode.fill();
  const run: TextRun = {
    fill: typeof fill === 'string' ? fill : '#000000',
    fontFamily: textNode.fontFamily(),
    fontSize,
    fontStyle: textNode.fontStyle().includes('italic') ? 'italic' : 'normal',
    fontWeight: textNode.fontStyle().includes('bold') ? 700 : 400,
    text: textNode.text(),
  };
  const textLines = (
    textNode as Konva.Text & { textArr?: Array<{ text: string }> }
  ).textArr?.map((line) => line.text);
  const lines = textLines?.length ? textLines : [textNode.text()];
  return lines.reduce(
    (overflow, line) => {
      const metrics = measure(line, run, 1);
      return {
        bottom: Math.max(overflow.bottom, metrics.overflowBottom),
        left: Math.max(overflow.left, metrics.overflowLeft),
        right: Math.max(overflow.right, metrics.overflowRight),
        top: Math.max(overflow.top, metrics.overflowTop),
      };
    },
    { bottom: 0, left: 0, right: 0, top: 0 },
  );
}

function isLocalTextBox(box: { height: number; width: number; x: number; y: number }, nodeWidth: number, nodeHeight: number) {
  if (![box.x, box.y, box.width, box.height].every(Number.isFinite)) return false;
  if (box.width <= 0 || box.height <= 0) return false;
  return box.x >= -nodeWidth && box.y >= -nodeHeight && box.x <= nodeWidth * 2 && box.y <= nodeHeight * 2;
}

function getNodeInkOverflow(node: Konva.Node) {
  const textNodes = collectTextNodes(node);
  const nodeWidth = node.width();
  const nodeHeight = node.height();
  if (textNodes.length === 0 || nodeWidth < 1 || nodeHeight < 1) return 0;

  return textNodes.reduce((overflow, textNode) => {
    const box = textNode.getClientRect({
      relativeTo: node,
      skipShadow: true,
      skipStroke: true,
    });
    if (!isLocalTextBox(box, nodeWidth, nodeHeight)) return overflow;
    const ink = lineOverflow(textNode);
    const left = box.x - ink.left;
    const top = box.y - ink.top;
    const right = box.x + box.width + ink.right;
    const bottom = box.y + box.height + ink.bottom;
    return Math.max(overflow, -left, -top, right - nodeWidth, bottom - nodeHeight, 0);
  }, 0);
}

export const textGlyphMeasure = {
  clearCache,
  getNodeInkOverflow,
  measure,
};
