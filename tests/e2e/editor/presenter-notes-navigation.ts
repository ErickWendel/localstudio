import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const presenterNotesNavigation = {
  async verify(presenterPage: Page): Promise<void> {
    await presenterPage.getByRole('button', { name: 'Next slide' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 2');
    await presenterPage.getByRole('button', { name: 'Previous slide' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 2');
    await presenterPage
      .getByRole('navigation', { name: 'Slide previews' })
      .getByRole('button', { name: 'Presenter Close' })
      .click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 2');
    await presenterPage.getByRole('button', { name: 'Previous slide' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 2');
    await presenterPage.getByRole('button', { name: 'Show keyboard shortcuts' }).click();
    await presenterPage.getByRole('button', { name: 'Go to first slide' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 2');
    await presenterPage.getByRole('button', { name: 'Go to last slide' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 2');
    await presenterPage.getByRole('button', { name: 'Close keyboard shortcuts' }).click();
    await this.verifySlideNavigator(presenterPage);
  },

  async verifySlideNavigator(presenterPage: Page): Promise<void> {
    await presenterPage.keyboard.press('Shift+Digit3');
    const slideNavigator = presenterPage.getByRole('dialog', { name: 'Slide navigator' });
    await expect(slideNavigator).toBeVisible();
    await presenterPage.keyboard.press('Minus');
    await expect(slideNavigator.getByRole('option', { name: /Slide 1.*Slide 1/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await presenterPage.keyboard.press('Equal');
    await expect(
      slideNavigator.getByRole('option', { name: /Slide 2.*Presenter Close/ }),
    ).toHaveAttribute('aria-selected', 'true');
    await presenterPage.keyboard.press('Escape');
    await expect(slideNavigator).toBeHidden();
    await presenterPage.keyboard.press('Shift+Digit3');
    await expect(slideNavigator).toBeVisible();
    const closeSlideOption = slideNavigator.getByRole('option', {
      name: /Slide 2.*Presenter Close/,
    });
    await closeSlideOption.click();
    await expect(closeSlideOption).toHaveAttribute('aria-selected', 'true');
    await presenterPage.keyboard.press('Enter');
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 2');
    await presenterPage.getByRole('button', { name: 'Previous slide' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 2');
  },
};
