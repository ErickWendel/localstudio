import type { Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export async function exerciseConnectedPeerTimer(page: Page) {
  await page.getByRole('button', { name: 'Increase notes size' }).click();
  await page.getByRole('button', { name: 'Decrease notes size' }).click();
  await page.getByRole('button', { name: 'Pause timer' }).click();
  await expect(page.getByRole('button', { name: 'Resume timer' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Reset timer' }).click();
  await expect(page.getByLabel('Presentation timer')).toContainText('00:00');
}
