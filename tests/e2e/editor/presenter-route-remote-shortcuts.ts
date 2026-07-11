import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const presenterRouteRemoteShortcuts = {
  async verify(page: Page): Promise<void> {
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (text: string) => {
            window.localStorage.setItem('localstudio.e2e.presenterRouteCopiedRemoteLink', text);
            return Promise.resolve();
          },
        },
      });
    });

    await page.getByRole('button', { name: 'Show remote control QR code' }).click();
    const remotePanel = page.getByRole('region', { name: 'Remote control this presentation' });
    await expect(remotePanel).toBeVisible();
    await expect(remotePanel.getByRole('img', { name: 'Remote control QR code' })).toBeVisible();
    const remoteUrl = await remotePanel.evaluate((element) => element.getAttribute('data-remote-url'));
    expect(remoteUrl).toContain('/joystick/?code=');
    await remotePanel.getByRole('button', { name: 'Copy remote link' }).click();
    await expect(remotePanel.getByRole('button', { name: 'Copied' })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem('localstudio.e2e.presenterRouteCopiedRemoteLink'),
        ),
      )
      .toBe(remoteUrl);
    await page.getByRole('main', { name: 'Presenter view' }).click({ position: { x: 24, y: 24 } });
    await expect(remotePanel).toBeHidden();

    await page.getByRole('button', { name: 'Show keyboard shortcuts' }).click();
    await expect(page.getByRole('dialog', { name: 'Magic Shortcuts' })).toBeVisible();
    await page.getByRole('button', { name: 'Increase notes size' }).click();
    await page.getByRole('button', { name: 'Decrease notes size' }).click();
    await page.getByRole('button', { name: 'Scroll notes down' }).click();
    await page.getByRole('button', { name: 'Scroll notes up' }).click();
    await page.getByRole('button', { name: 'Close keyboard shortcuts' }).click();
  },
};
