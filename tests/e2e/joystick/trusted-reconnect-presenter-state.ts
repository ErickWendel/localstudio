import { type Locator, type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const trustedReconnectPresenterState = {
  async enterPresentingMode(page: Page): Promise<void> {
    await page.evaluate(() => {
      window.__LOCALSTUDIO_E2E_JOYSTICK__?.setPresenterMode('presenting');
    });
  },

  async verifyConnected(page: Page, currentSlidePreview: Locator): Promise<void> {
    await expect(page.getByLabel('Slide position')).toContainText('1 / 4');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 4');
    await expect(page.getByLabel('Presenter status')).toContainText('Build 1 of 2');
    await expect(page.getByLabel('Presentation timer')).toContainText(/00:0[4-9]/);
    await expect(page.getByLabel('Presenter notes content')).toContainText(
      'Open with the customer metric before the roadmap.',
    );
    await expect(currentSlidePreview).toBeVisible();
    await expect(currentSlidePreview.getByLabel('Slide video')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go to slide 2: Roadmap' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go to slide 3: Risks' })).toBeVisible();
  },

  async verifyPresenterModeRequired(page: Page): Promise<void> {
    const presenterModeRequired = page.getByRole('region', { name: 'Presenter mode required' });
    await expect(presenterModeRequired).toContainText('Studio laptop');
    await expect(presenterModeRequired).toContainText('Quarterly launch review');
    await expect(page.getByText('Connected (2)')).toBeVisible();
  },
};
