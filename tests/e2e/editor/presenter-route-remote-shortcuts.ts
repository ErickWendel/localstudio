import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const presenterRouteRemoteShortcuts = {
  async verify(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Show remote control QR code' }).click();
    await expect(page.getByRole('region', { name: 'Remote control this presentation' })).toBeVisible();
    await page.getByRole('main', { name: 'Presenter view' }).click({ position: { x: 24, y: 24 } });
    await expect(page.getByRole('region', { name: 'Remote control this presentation' })).toBeHidden();

    await page.getByRole('button', { name: 'Show keyboard shortcuts' }).click();
    await expect(page.getByRole('dialog', { name: 'Magic Shortcuts' })).toBeVisible();
    await page.getByRole('button', { name: 'Increase notes size' }).click();
    await page.getByRole('button', { name: 'Decrease notes size' }).click();
    await page.getByRole('button', { name: 'Scroll notes down' }).click();
    await page.getByRole('button', { name: 'Scroll notes up' }).click();
    await page.getByRole('button', { name: 'Close keyboard shortcuts' }).click();
  },
};
