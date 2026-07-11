import { type Locator, type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const presenterKeyboardSlideShortcuts = {
  async verify(page: Page, shortcuts: Locator): Promise<void> {
    await shortcuts.getByRole('button', { name: 'Open the slide navigator' }).click();
    const slideNavigator = page.getByRole('dialog', { name: 'Slide navigator' });
    await expect(slideNavigator).toBeVisible();
    await shortcuts
      .getByRole('button', { name: 'Go to the next slide in the slide navigator' })
      .click();
    await expect(
      slideNavigator.getByRole('option', { name: /Slide 2.*Keyboard close/ }),
    ).toHaveAttribute('aria-selected', 'true');
    await shortcuts
      .getByRole('button', { name: 'Go to the current slide in the slide navigator' })
      .click();
    await expect(page.getByText('2 / 2')).toBeVisible();

    await shortcuts.getByRole('button', { name: 'Go to first slide' }).click();
    await expect(page.getByText('1 / 2')).toBeVisible();
    await shortcuts.getByRole('button', { name: 'Go to last slide' }).click();
    await expect(page.getByText('2 / 2')).toBeVisible();
    await shortcuts.getByRole('button', { name: 'Go back to previous slide' }).click();
    await expect(page.getByText('1 / 2')).toBeVisible();
    await shortcuts.getByRole('button', { name: 'Advance to next build' }).first().click();
    await expect(page.getByText('2 / 2')).toBeVisible();
  },
};
