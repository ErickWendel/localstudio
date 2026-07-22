export interface CanvasMagnetRect {
  height: number;
  id?: string;
  width: number;
  x: number;
  y: number;
}

export interface CanvasMagnetLineGuide {
  id: string;
  kind: 'line';
  orientation: 'horizontal' | 'vertical';
  source: 'object' | 'page';
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export interface CanvasMagnetSizeGuide {
  id: string;
  capX1: number;
  capX2: number;
  capY1: number;
  capY2: number;
  kind: 'size';
  orientation: 'horizontal' | 'vertical';
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export type CanvasMagnetGuide = CanvasMagnetLineGuide | CanvasMagnetSizeGuide;

interface DragSnapInput {
  movingRect: CanvasMagnetRect;
  stageHeight: number;
  stageWidth: number;
  targetRects: CanvasMagnetRect[];
  threshold: number;
}

interface ResizeSnapInput {
  resizedRect: CanvasMagnetRect;
  targetRects: CanvasMagnetRect[];
  threshold: number;
}

const OBJECT_GUIDE_MARGIN = 18;
const SIZE_GUIDE_CAP = 18;

function getRectBounds(rects: CanvasMagnetRect[]) {
  if (rects.length === 0) return undefined;
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function translateRect(rect: CanvasMagnetRect, delta: { x: number; y: number }) {
  return { ...rect, x: rect.x + delta.x, y: rect.y + delta.y };
}

function getObjectGuideSpan(first: CanvasMagnetRect, second: CanvasMagnetRect) {
  return {
    x1: Math.min(first.x, second.x) - OBJECT_GUIDE_MARGIN,
    x2: Math.max(first.x + first.width, second.x + second.width) + OBJECT_GUIDE_MARGIN,
    y1: Math.min(first.y, second.y) - OBJECT_GUIDE_MARGIN,
    y2: Math.max(first.y + first.height, second.y + second.height) + OBJECT_GUIDE_MARGIN,
  };
}

function getBestMatch(
  candidates: Array<{ delta: number; guide: CanvasMagnetLineGuide }>,
  threshold: number,
) {
  return candidates
    .filter((candidate) => Math.abs(candidate.delta) <= threshold)
    .sort((first, second) => Math.abs(first.delta) - Math.abs(second.delta))[0];
}

function getDragSnap(input: DragSnapInput) {
  const { movingRect, stageHeight, stageWidth, targetRects, threshold } = input;
  const movingXAnchors = [
    { name: 'left', value: movingRect.x },
    { name: 'center', value: movingRect.x + movingRect.width / 2 },
    { name: 'right', value: movingRect.x + movingRect.width },
  ];
  const movingYAnchors = [
    { name: 'top', value: movingRect.y },
    { name: 'center', value: movingRect.y + movingRect.height / 2 },
    { name: 'bottom', value: movingRect.y + movingRect.height },
  ];
  const pageVerticalCenter = stageWidth / 2;
  const pageHorizontalCenter = stageHeight / 2;
  const verticalCandidates: Array<{ delta: number; guide: CanvasMagnetLineGuide }> = [
    {
      delta: pageVerticalCenter - (movingRect.x + movingRect.width / 2),
      guide: {
        id: 'page-vertical-center',
        kind: 'line',
        orientation: 'vertical',
        source: 'page',
        x1: pageVerticalCenter,
        x2: pageVerticalCenter,
        y1: 0,
        y2: stageHeight,
      } satisfies CanvasMagnetLineGuide,
    },
  ];
  const horizontalCandidates: Array<{ delta: number; guide: CanvasMagnetLineGuide }> = [
    {
      delta: pageHorizontalCenter - (movingRect.y + movingRect.height / 2),
      guide: {
        id: 'page-horizontal-center',
        kind: 'line',
        orientation: 'horizontal',
        source: 'page',
        x1: 0,
        x2: stageWidth,
        y1: pageHorizontalCenter,
        y2: pageHorizontalCenter,
      } satisfies CanvasMagnetLineGuide,
    },
  ];

  for (const targetRect of targetRects) {
    const span = getObjectGuideSpan(movingRect, targetRect);
    const targetXAnchors = [
      { name: 'left', value: targetRect.x },
      { name: 'center', value: targetRect.x + targetRect.width / 2 },
      { name: 'right', value: targetRect.x + targetRect.width },
    ];
    const targetYAnchors = [
      { name: 'top', value: targetRect.y },
      { name: 'center', value: targetRect.y + targetRect.height / 2 },
      { name: 'bottom', value: targetRect.y + targetRect.height },
    ];
    for (const movingAnchor of movingXAnchors) {
      for (const targetAnchor of targetXAnchors) {
        verticalCandidates.push({
          delta: targetAnchor.value - movingAnchor.value,
          guide: {
            id: `object-vertical-${targetRect.id ?? 'target'}-${movingAnchor.name}-${targetAnchor.name}`,
            kind: 'line',
            orientation: 'vertical',
            source: 'object',
            x1: targetAnchor.value,
            x2: targetAnchor.value,
            y1: span.y1,
            y2: span.y2,
          },
        });
      }
    }
    for (const movingAnchor of movingYAnchors) {
      for (const targetAnchor of targetYAnchors) {
        horizontalCandidates.push({
          delta: targetAnchor.value - movingAnchor.value,
          guide: {
            id: `object-horizontal-${targetRect.id ?? 'target'}-${movingAnchor.name}-${targetAnchor.name}`,
            kind: 'line',
            orientation: 'horizontal',
            source: 'object',
            x1: span.x1,
            x2: span.x2,
            y1: targetAnchor.value,
            y2: targetAnchor.value,
          },
        });
      }
    }
  }

  const verticalMatch = getBestMatch(verticalCandidates, threshold);
  const horizontalMatch = getBestMatch(horizontalCandidates, threshold);
  return {
    deltaX: verticalMatch?.delta ?? 0,
    deltaY: horizontalMatch?.delta ?? 0,
    guides: [verticalMatch?.guide, horizontalMatch?.guide].filter(
      (guide): guide is CanvasMagnetLineGuide => Boolean(guide),
    ),
  };
}

function getResizeSnap(input: ResizeSnapInput) {
  const { resizedRect, targetRects, threshold } = input;
  let widthMatch: { guide: CanvasMagnetSizeGuide; width: number } | undefined;
  let heightMatch: { guide: CanvasMagnetSizeGuide; height: number } | undefined;

  for (const targetRect of targetRects) {
    const widthDelta = targetRect.width - resizedRect.width;
    if (
      Math.abs(widthDelta) <= threshold &&
      (!widthMatch || Math.abs(widthDelta) < Math.abs(widthMatch.width - resizedRect.width))
    ) {
      const y = resizedRect.y + resizedRect.height;
      const capX = resizedRect.x + targetRect.width;
      widthMatch = {
        width: targetRect.width,
        guide: {
          id: `size-width-${targetRect.id ?? 'target'}`,
          capX1: capX,
          capX2: capX,
          capY1: y - SIZE_GUIDE_CAP,
          capY2: y + SIZE_GUIDE_CAP,
          kind: 'size',
          orientation: 'horizontal',
          x1: resizedRect.x,
          x2: resizedRect.x + targetRect.width,
          y1: y,
          y2: y,
        },
      };
    }

    const heightDelta = targetRect.height - resizedRect.height;
    if (
      Math.abs(heightDelta) <= threshold &&
      (!heightMatch || Math.abs(heightDelta) < Math.abs(heightMatch.height - resizedRect.height))
    ) {
      const x = resizedRect.x + resizedRect.width;
      const capY = resizedRect.y + targetRect.height;
      heightMatch = {
        height: targetRect.height,
        guide: {
          id: `size-height-${targetRect.id ?? 'target'}`,
          capX1: x - SIZE_GUIDE_CAP,
          capX2: x + SIZE_GUIDE_CAP,
          capY1: capY,
          capY2: capY,
          kind: 'size',
          orientation: 'vertical',
          x1: x,
          x2: x,
          y1: resizedRect.y,
          y2: resizedRect.y + targetRect.height,
        },
      };
    }
  }

  return {
    height: heightMatch?.height ?? resizedRect.height,
    guides: [widthMatch?.guide, heightMatch?.guide].filter(
      (guide): guide is CanvasMagnetSizeGuide => Boolean(guide),
    ),
    width: widthMatch?.width ?? resizedRect.width,
  };
}

export const canvasMagnetGuides = {
  SNAP_THRESHOLD_STAGE: 6,
  getDragSnap,
  getRectBounds,
  getResizeSnap,
  translateRect,
};
