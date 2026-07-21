import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';
import { presenterRouteHarness } from '../support/presenter-route-harness';

export const presenterRouteStartup = {
  async open(page: Page, baseURL: string): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 820 });
    await page.addInitScript(() => {
      Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
        configurable: true,
        get() {
          return 24;
        },
      });
      HTMLMediaElement.prototype.play = function play() {
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
      };
      HTMLMediaElement.prototype.pause = function pause() {
        this.dispatchEvent(new Event('pause'));
      };
    });
    await presenterRouteHarness.install(page);

    await page.goto(`${baseURL}/editor/?presenter=1&presenterSession=e2e-presenter`);
    await page.locator('.presenter-view').waitFor({ state: 'visible', timeout: 30_000 });
    await this.dismissIntro(page);
    await expect(page.getByRole('main', { name: 'Presenter view' })).toBeVisible();
  },

  async dismissIntro(page: Page): Promise<void> {
    const introDismissButton = page.getByRole('button', { name: 'Got it' });
    if (await introDismissButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await introDismissButton.click();
    }
  },
};
