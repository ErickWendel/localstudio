import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export type CanvasDesignPoint = {
  x: number;
  y: number;
};

export async function getCanvasPoint(page: Page, point: CanvasDesignPoint) {
  const canvas = page.getByTestId('slide-canvas-frame').locator('canvas').first();
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  return {
    x: canvasBox!.x + (point.x / 1920) * canvasBox!.width,
    y: canvasBox!.y + (point.y / 1080) * canvasBox!.height,
  };
}
