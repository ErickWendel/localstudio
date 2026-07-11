import { type Locator, type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const trustedReconnectDirectControls = {
  async exercise(page: Page, currentSlidePreview: Locator): Promise<void> {
    await page.getByRole('button', { name: 'Go to slide 2: Roadmap' }).click();
    await expect(page.getByLabel('Slide position')).toContainText('2 / 4');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 4');
    await currentSlidePreview.dispatchEvent('pointerdown', {
      clientX: 220,
      pointerType: 'touch',
    });
    await currentSlidePreview.dispatchEvent('pointerup', {
      clientX: 340,
      pointerType: 'touch',
    });
    await expect(page.getByLabel('Slide position')).toContainText('1 / 4');

    await currentSlidePreview.dispatchEvent('pointerdown', {
      clientX: 340,
      pointerType: 'touch',
    });
    await currentSlidePreview.dispatchEvent('pointerup', {
      clientX: 220,
      pointerType: 'touch',
    });
    await expect(page.getByLabel('Slide position')).toContainText('2 / 4');
  },
};
