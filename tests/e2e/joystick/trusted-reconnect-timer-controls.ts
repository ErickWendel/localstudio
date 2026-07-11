import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const trustedReconnectTimerControls = {
  async exercise(page: Page): Promise<void> {
    const notesSizeBefore = await page
      .getByLabel('Presenter notes content')
      .evaluate((element) => getComputedStyle(element).fontSize);
    await page.getByRole('button', { name: 'Increase notes size' }).click();
    await expect
      .poll(() =>
        page.getByLabel('Presenter notes content').evaluate((element) => getComputedStyle(element).fontSize),
      )
      .not.toBe(notesSizeBefore);
    await page.getByRole('button', { name: 'Decrease notes size' }).click();

    await page.getByRole('button', { name: 'Pause timer' }).click();
    await expect(page.getByRole('button', { name: 'Resume timer' })).toBeVisible();
    await expect(page.getByText('Command sent: pause-timer')).toBeVisible();
    await page.getByRole('button', { name: 'Resume timer' }).click();
    await expect(page.getByRole('button', { name: 'Pause timer' })).toBeVisible();
    await page.getByRole('button', { name: 'Reset timer' }).click();
    await expect(page.getByLabel('Presentation timer')).toContainText('00:00');
  },
};
