import type { Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export async function exerciseConnectedPeerStreamGestures(joystickPage: Page, presenterPage: Page) {
  await expect(joystickPage.getByRole('button', { name: 'Presenter stream preview' })).toBeVisible();
  const streamPreview = joystickPage.getByRole('button', { name: 'Presenter stream preview' });
  await expect
    .poll(() =>
      streamPreview.evaluate((element) => {
        const video = element.querySelector('video');
        if (!video) return { sourceIsWidescreen: false, videoContained: false };
        const frameBounds = element.getBoundingClientRect();
        const videoBounds = video.getBoundingClientRect();
        return {
          sourceIsWidescreen:
            video.videoWidth > 0 && Math.abs(video.videoWidth / video.videoHeight - 16 / 9) < 0.01,
          videoContained:
            videoBounds.right <= frameBounds.right + 1 && videoBounds.bottom <= frameBounds.bottom + 1,
        };
      }),
    )
    .toEqual({ sourceIsWidescreen: true, videoContained: true });
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
