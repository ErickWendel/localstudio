import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const canvasBox = {
  async get(page: Page) {
    const box = await page.getByTestId('slide-canvas-frame').locator('canvas').first().boundingBox();
    expect(box).not.toBeNull();
    return box!;
  },
};
