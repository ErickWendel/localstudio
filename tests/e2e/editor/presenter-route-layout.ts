import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const presenterRouteLayout = {
  async verifyContainedSlide(page: Page): Promise<void> {
    const mainBounds = await page.locator('.presenter-main').boundingBox();
    const stageBounds = await page.getByLabel('Current slide').boundingBox();
    const slideBounds = await page.getByTestId('slide-canvas-frame').boundingBox();
    expect(mainBounds).not.toBeNull();
    expect(stageBounds).not.toBeNull();
    expect(slideBounds).not.toBeNull();
    expect(stageBounds!.x).toBeGreaterThanOrEqual(mainBounds!.x);
    expect(stageBounds!.x + stageBounds!.width).toBeLessThanOrEqual(
      mainBounds!.x + mainBounds!.width,
    );
    expect(slideBounds!.x).toBeGreaterThanOrEqual(stageBounds!.x);
    expect(slideBounds!.y).toBeGreaterThanOrEqual(stageBounds!.y);
    expect(slideBounds!.x + slideBounds!.width).toBeLessThanOrEqual(
      stageBounds!.x + stageBounds!.width,
    );
    expect(slideBounds!.y + slideBounds!.height).toBeLessThanOrEqual(
      stageBounds!.y + stageBounds!.height,
    );
    expect(slideBounds!.width / slideBounds!.height).toBeCloseTo(16 / 9, 2);
  },
};
