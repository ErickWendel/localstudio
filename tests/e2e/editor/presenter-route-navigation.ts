import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const presenterRouteNavigation = {
  async verify(page: Page): Promise<void> {
    await page.keyboard.press('Shift+Digit3');
    const slideNavigator = page.getByRole('dialog', { name: 'Slide navigator' });
    await expect(slideNavigator).toBeVisible();
    await page.keyboard.press('Equal');
    await expect(slideNavigator.getByRole('option', { name: /Slide 2.*Visual proof/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 3');
    await page.keyboard.press('Shift+Digit3');
    await slideNavigator.getByRole('option', { name: /Slide 3.*Close/ }).dblclick();
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 3 of 3');
    await page.keyboard.press('Home');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 3');
    await page.keyboard.press('End');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 3 of 3');
    await expect
      .poll(() => page.evaluate(() => window.__LOCALSTUDIO_E2E_PRESENTER__?.activePageId()))
      .toBe('slide-3');
    await page.getByRole('main', { name: 'Presenter view' }).click({ position: { x: 24, y: 24 } });
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 3');
    await expect
      .poll(() => page.evaluate(() => window.__LOCALSTUDIO_E2E_PRESENTER__?.activePageId()))
      .toBe('slide-2');
    await page.getByRole('main', { name: 'Presenter view' }).click({ position: { x: 24, y: 24 } });
    await page.keyboard.press('Shift+ArrowDown');
    await expect
      .poll(() => page.evaluate(() => window.__LOCALSTUDIO_E2E_PRESENTER__?.activePageId()))
      .toBe('slide-3');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 3 of 3');
  },
};
