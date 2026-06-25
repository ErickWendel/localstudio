interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface Scale {
  x: number;
  y: number;
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function getNormalizedElementPoint({
  element,
  pointer,
  scale,
}: {
  element: ElementBounds;
  pointer: Point;
  scale: Scale;
}): Point {
  const stageX = element.x * scale.x;
  const stageY = element.y * scale.y;
  const stageWidth = element.width * scale.x;
  const stageHeight = element.height * scale.y;

  return {
    x: clamp((pointer.x - stageX) / stageWidth),
    y: clamp((pointer.y - stageY) / stageHeight),
  };
}
