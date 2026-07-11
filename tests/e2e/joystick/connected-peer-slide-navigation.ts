import type { Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export async function exerciseConnectedPeerSlideNavigation(
  joystickPage: Page,
  presenterPage: Page,
) {
  await joystickPage.getByRole('button', { name: 'Show slide navigation' }).click();
  const slideNavigation = joystickPage.getByRole('dialog', { name: 'Slide navigation' });
  await expect(slideNavigation.getByRole('button', { name: 'Go to slide 1: Slide 1' })).toBeVisible();
  await slideNavigation.getByRole('button', { name: 'Close slide navigation' }).click();
  await expect(slideNavigation).toBeHidden();
  await joystickPage.getByRole('button', { name: 'Show slide navigation' }).click();
  await joystickPage
    .getByRole('dialog', { name: 'Slide navigation' })
    .getByRole('button', { name: 'Go to slide 2: Close' })
    .click();

  await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 3');
  await expect(joystickPage.getByLabel('Slide position')).toContainText('2 / 3');
}
