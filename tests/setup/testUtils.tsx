import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

const canvasContext = {
  canvas: document.createElement('canvas'),
  scale: () => undefined,
  clearRect: () => undefined,
  fillRect: () => undefined,
  strokeRect: () => undefined,
  save: () => undefined,
  restore: () => undefined,
  translate: () => undefined,
  rotate: () => undefined,
  transform: () => undefined,
  setTransform: () => undefined,
  beginPath: () => undefined,
  closePath: () => undefined,
  moveTo: () => undefined,
  lineTo: () => undefined,
  quadraticCurveTo: () => undefined,
  bezierCurveTo: () => undefined,
  arc: () => undefined,
  rect: () => undefined,
  fill: () => undefined,
  stroke: () => undefined,
  fillText: () => undefined,
  strokeText: () => undefined,
  measureText: (text: string) => ({ width: text.length * 8 }),
  createLinearGradient: () => ({ addColorStop: () => undefined }),
  createPattern: () => null,
  drawImage: () => undefined,
  getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  putImageData: () => undefined,
};

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value(this: HTMLCanvasElement) {
    return { ...canvasContext, canvas: this } as unknown as CanvasRenderingContext2D;
  },
});

class ResizeObserverMock implements ResizeObserver {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

globalThis.ResizeObserver = ResizeObserverMock;
