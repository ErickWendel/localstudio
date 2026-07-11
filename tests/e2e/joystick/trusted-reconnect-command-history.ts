import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const trustedReconnectCommandHistory = {
  async verify(page: Page): Promise<void> {
    await expect
      .poll(() => page.evaluate(() => window.__LOCALSTUDIO_E2E_JOYSTICK__?.commands ?? []))
      .toEqual(
        expect.arrayContaining([
          'pause-timer',
          'resume-timer',
          'reset-timer',
          'go-to-page:slide-2',
          'go-to-page:slide-1',
          'go-to-page:slide-2',
          'go-to-page:slide-4',
        ]),
      );
  },
};
