import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const presenterRouteNotesResizer = {
  async verify(page: Page): Promise<void> {
    const notesResizer = page.getByRole('separator', { name: 'Resize presenter notes' });
    const notesWidthBefore = await notesResizer.getAttribute('aria-valuenow');
    await notesResizer.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(notesResizer).not.toHaveAttribute('aria-valuenow', notesWidthBefore ?? '');
    await page.keyboard.press('Home');
    await expect(notesResizer).toHaveAttribute('aria-valuenow', '280');
    await page.keyboard.press('End');

    const resizerBox = await notesResizer.boundingBox();
    expect(resizerBox).not.toBeNull();
    await page.mouse.move(resizerBox!.x + resizerBox!.width / 2, resizerBox!.y + 40);
    await page.mouse.down();
    await page.mouse.move(resizerBox!.x - 120, resizerBox!.y + 40);
    await page.mouse.up();
  },
};
