import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const trustedReconnectSlideNavigation = {
  async exercise(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Show slide navigation' }).click();
    const slideNavigation = page.getByRole('dialog', { name: 'Slide navigation' });
    await expect(slideNavigation.getByRole('button', { name: 'Go to slide 1: Overview' })).toBeVisible();
    await expect(slideNavigation.getByRole('button', { name: 'Go to slide 4: Close' })).toBeVisible();
    await slideNavigation.getByRole('button', { name: 'Go to slide 4: Close' }).click();
    await expect(page.getByLabel('Slide position')).toContainText('4 / 4');
    await expect(page.getByText('Presenter notes that are created will appear here')).toBeVisible();
  },
};
