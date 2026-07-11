import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const presenterRouteTimerCommands = {
  async verify(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Pause timer' }).click();
    await expect(page.getByRole('button', { name: 'Resume timer' })).toBeVisible();
    await page.evaluate(() => {
      window.__LOCALSTUDIO_E2E_PRESENTER__?.sendCommand('resume-timer');
    });
    await expect(page.getByRole('button', { name: 'Pause timer' })).toBeVisible();
    await page.evaluate(() => {
      window.__LOCALSTUDIO_E2E_PRESENTER__?.sendCommand('pause-timer');
    });
    await expect(page.getByRole('button', { name: 'Resume timer' })).toBeVisible();
    await page.evaluate(() => {
      window.__LOCALSTUDIO_E2E_PRESENTER__?.sendCommand('reset-timer');
    });
    await expect(page.getByRole('button', { name: 'Pause timer' })).toBeVisible();
  },
};
