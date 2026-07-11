import type { Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export async function resizeConnectedPeerPresenterNotes(page: Page) {
  const notesResizeHandle = page.getByRole('button', { name: 'Resize presenter notes' });
  const notesHeightBefore = await page
    .getByRole('main', { name: 'Presentation remote control' })
    .evaluate((element) => getComputedStyle(element).getPropertyValue('--joystick-stream-notes-height'));
  const resizeBox = await notesResizeHandle.boundingBox();
  expect(resizeBox).not.toBeNull();
  await page.mouse.move(resizeBox!.x + resizeBox!.width / 2, resizeBox!.y + resizeBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBox!.x + resizeBox!.width / 2, resizeBox!.y - 80);
  await page.mouse.up();
  await expect
    .poll(() =>
      page
        .getByRole('main', { name: 'Presentation remote control' })
        .evaluate((element) => getComputedStyle(element).getPropertyValue('--joystick-stream-notes-height')),
    )
    .not.toBe(notesHeightBefore);
}
