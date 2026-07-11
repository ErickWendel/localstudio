import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const presenterRouteInitialState = {
  async verify(page: Page): Promise<void> {
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 3');
    await expect(page.getByLabel('Presenter status')).toContainText('Builds remaining: 1');
    await expect(page.getByLabel('Speaker notes')).toHaveValue('Open with the metric.');
  },
};
