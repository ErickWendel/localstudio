import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const presenterRouteNotesSync = {
  async verify(page: Page): Promise<void> {
    await page.getByLabel('Speaker notes').fill('Presenter route edited notes');
    await expect
      .poll(() => page.evaluate(() => window.__LOCALSTUDIO_E2E_PRESENTER__?.notesFor('slide-1')))
      .toBe('Presenter route edited notes');
  },
};
