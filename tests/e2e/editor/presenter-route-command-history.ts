import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const presenterRouteCommandHistory = {
  async verify(page: Page): Promise<void> {
    await expect
      .poll(() => page.evaluate(() => window.__LOCALSTUDIO_E2E_PRESENTER__?.commands ?? []))
      .toEqual(
        expect.arrayContaining([
          'request-state',
          'resume-timer',
          'pause-timer',
          'update-notes:slide-1',
          'go-to-page:slide-2',
          'go-to-page:slide-3',
          'go-to-page:slide-1',
          'go-to-page:slide-3',
          'go-to-page:slide-2',
        ]),
      );
  },
};
