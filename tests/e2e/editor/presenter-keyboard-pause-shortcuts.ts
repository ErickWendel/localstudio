import { type Locator, type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const presenterKeyboardPauseShortcuts = {
  async verify(page: Page, shortcuts: Locator): Promise<void> {
    await shortcuts.getByRole('button', { name: 'Pause presentation and show black screen' }).click();
    await expect(page.getByLabel('Black screen')).toBeVisible();
    await shortcuts.getByRole('button', { name: 'Pause presentation; press any key to resume' }).click();
    await expect(page.getByLabel('Black screen')).toBeHidden();
    await shortcuts.getByRole('button', { name: 'Pause presentation and show white screen' }).click();
    await expect(page.getByLabel('White screen')).toBeVisible();
    await shortcuts.getByRole('button', { name: 'Pause presentation; press any key to resume' }).click();
    await expect(page.getByLabel('White screen')).toBeHidden();
    await shortcuts.getByRole('button', { name: 'Display the current slide number' }).click();
    await expect(page.getByText('Slide 2 of 2')).toBeVisible();
    await shortcuts.getByRole('button', { name: 'Quit presentation mode' }).click();
    await expect(shortcuts).toBeHidden();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  },
};
