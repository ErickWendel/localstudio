import type { Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export async function verifyConnectedPeerReloadReconnect(joystickPage: Page, presenterPage: Page) {
  await joystickPage.reload();
  await expect(joystickPage.getByRole('main', { name: 'Presentation remote control' })).toBeVisible();
  await expect(joystickPage.getByLabel('Connected (1)')).toBeVisible({ timeout: 45_000 });
  await expect(joystickPage.getByLabel('Slide position')).toContainText('2 / 3');
  await joystickPage.getByRole('button', { name: 'Previous slide' }).click();
  await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 3');
  await expect(joystickPage.getByLabel('Slide position')).toContainText('1 / 3');
}
