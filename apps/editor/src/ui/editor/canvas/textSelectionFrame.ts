export interface TextSelectionFrame {
  height: number;
  rotation?: number;
  width: number;
  x: number;
  y: number;
}

const ANCHOR_CLEARANCE = 10;
const MAX_INK_OVERFLOW = 48;

function paddingForOverflow(overflow: number) {
  if (!Number.isFinite(overflow) || overflow <= 0) return ANCHOR_CLEARANCE;
  const boundedOverflow = Math.min(overflow, MAX_INK_OVERFLOW);
  return Math.max(ANCHOR_CLEARANCE, Math.ceil(boundedOverflow + ANCHOR_CLEARANCE));
}

function clampResize(
  previous: TextSelectionFrame,
  next: TextSelectionFrame,
  minimum: { height: number; width: number },
): TextSelectionFrame {
  let x = next.x;
  let y = next.y;
  let width = Math.max(1, next.width);
  let height = Math.max(1, next.height);
  const previousRight = previous.x + previous.width;
  const previousBottom = previous.y + previous.height;

  if (width < minimum.width) {
    const resizedFromLeft = next.x > previous.x + 0.5;
    width = minimum.width;
    x = resizedFromLeft ? previousRight - width : previous.x;
  }

  if (height < minimum.height) {
    const resizedFromTop = next.y > previous.y + 0.5;
    height = minimum.height;
    y = resizedFromTop ? previousBottom - height : previous.y;
  }

  const rotation = next.rotation ?? previous.rotation;
  return {
    height,
    ...(rotation === undefined ? {} : { rotation }),
    width,
    x,
    y,
  };
}

export const textSelectionFrame = {
  anchorClearance: ANCHOR_CLEARANCE,
  clampResize,
  paddingForOverflow,
};
