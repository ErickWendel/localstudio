import type { Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export async function exerciseConnectedPeerStreamGestures(joystickPage: Page, presenterPage: Page) {
  await expect(joystickPage.getByRole('button', { name: 'Presenter stream preview' })).toBeVisible();
  const streamPreview = joystickPage.getByRole('button', { name: 'Presenter stream preview' });
  await streamPreview.dispatchEvent('pointerdown', {
    clientX: 320,
    pointerType: 'touch',
  });
  await streamPreview.dispatchEvent('pointerup', {
    clientX: 220,
    pointerType: 'touch',
  });
  await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 3');
  await expect(joystickPage.getByLabel('Slide position')).toContainText('2 / 3');
  await expect(joystickPage.getByText('Presenter notes that are created will appear here')).toBeVisible();

  await streamPreview.dispatchEvent('pointerdown', {
    clientX: 320,
    pointerType: 'touch',
  });
  await streamPreview.dispatchEvent('pointerup', {
    clientX: 220,
    pointerType: 'touch',
  });
  await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 3 of 3');
  await expect(joystickPage.getByLabel('Slide position')).toContainText('3 / 3');

  await streamPreview.click({ position: { x: 24, y: 96 } });
  await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 3');
  await expect(joystickPage.getByLabel('Slide position')).toContainText('2 / 3');
}
