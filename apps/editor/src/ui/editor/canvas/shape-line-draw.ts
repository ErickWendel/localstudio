import type { ElementAnimationBuild } from '../../../domain/documents/model';
import type { ElementAnimationRenderState } from './canvas-element-props';

type LineDrawDirection = ElementAnimationBuild['lineDrawDirection'];

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function getPoints(points: number[], progress: number, direction: LineDrawDirection) {
  if (points.length < 4) return points;
  const startX = points[0] ?? 0;
  const startY = points[1] ?? 0;
  const endX = points[points.length - 2] ?? startX;
  const endY = points[points.length - 1] ?? startY;
  const lerp = (start: number, end: number, ratio = progress) => start + (end - start) * ratio;

  if (direction === 'end-to-start') {
    return [endX, endY, lerp(endX, startX), lerp(endY, startY)];
  }
  if (direction === 'middle-to-ends') {
    const middleX = (startX + endX) / 2;
    const middleY = (startY + endY) / 2;
    return [
      lerp(middleX, startX, progress),
      lerp(middleY, startY, progress),
      lerp(middleX, endX, progress),
      lerp(middleY, endY, progress),
    ];
  }
  return [startX, startY, lerp(startX, endX, progress), lerp(startY, endY, progress)];
}

function getDash(length: number, progress: number, direction: LineDrawDirection) {
  const safeLength = Math.max(1, length);
  if (direction === 'middle-to-ends') {
    return {
      dash: [safeLength * progress, safeLength],
      dashOffset: (safeLength * progress) / 2,
    };
  }
  return {
    dash: [safeLength, safeLength],
    dashOffset:
      direction === 'end-to-start' ? -safeLength * (1 - progress) : safeLength * (1 - progress),
  };
}

function getPerimeter(width: number, height: number) {
  return Math.max(1, width * 2 + height * 2);
}

function getState(state: ElementAnimationRenderState) {
  if (state.activeBuild?.effect !== 'line-draw') {
    return {
      direction: undefined,
      progress: 1,
    };
  }
  return {
    direction: state.activeBuild.lineDrawDirection ?? 'start-to-end',
    progress: easeOutCubic(state.progress),
  };
}

export const shapeLineDraw = {
  getDash,
  getPerimeter,
  getPoints,
  getState,
};
