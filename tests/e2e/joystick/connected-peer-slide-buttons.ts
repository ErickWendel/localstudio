import type { Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export async function exerciseConnectedPeerSlideButtons(joystickPage: Page, presenterPage: Page) {
  await joystickPage.getByRole('button', { name: 'Go to slide 2: Close' }).click();
  await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 3');
  await expect(joystickPage.getByLabel('Slide position')).toContainText('2 / 3');
  await joystickPage.getByRole('button', { name: 'Previous slide' }).click();
  await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 3');
  await expect(joystickPage.getByLabel('Slide position')).toContainText('1 / 3');
}
