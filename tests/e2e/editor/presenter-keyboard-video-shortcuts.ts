import { type Locator, type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const presenterKeyboardVideoShortcuts = {
  async verify(page: Page, shortcuts: Locator, video: Locator): Promise<void> {
    await shortcuts.getByRole('button', { name: 'Pause/Play movie' }).click();
    await shortcuts.getByRole('button', { name: 'Pause/Play movie' }).click();

    await shortcuts.getByRole('button', { name: 'Jump to end of movie' }).click();
    await expect
      .poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime))
      .toBeGreaterThan(5);
    await shortcuts.getByRole('button', { name: 'Jump to beginning of movie' }).click();
    await expect
      .poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime))
      .toBeLessThan(0.2);
    await page.keyboard.down('l');
    await expect
      .poll(() => video.evaluate((element) => (element as HTMLVideoElement).playbackRate))
      .toBe(2);
    await page.keyboard.up('l');
    await expect
      .poll(() => video.evaluate((element) => (element as HTMLVideoElement).playbackRate))
      .toBe(1);
    await video.evaluate((element) => {
      const movie = element as HTMLVideoElement;
      movie.pause();
      movie.currentTime = 1;
    });
    await shortcuts.getByRole('button', { name: 'Hold to rewind movie' }).click();
    await expect
      .poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime))
      .toBeLessThan(1);
  },
};
