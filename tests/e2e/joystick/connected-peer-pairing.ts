import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '../support/journey-test';

export const connectedPeerPairing = {
  async connectRemote(context: BrowserContext, editorPage: Page, presenterPage: Page, baseURL: string) {
    await presenterPage.getByRole('button', { name: 'Show remote control QR code' }).click();
    const remotePanel = presenterPage.getByRole('region', { name: 'Remote control this presentation' });
    await expect(remotePanel).toBeVisible({ timeout: 45_000 });
    await expect(remotePanel.getByRole('img', { name: 'Remote control QR code' })).toBeVisible();
    const remoteUrl = await remotePanel.evaluate((element) => element.getAttribute('data-remote-url'));
    expect(remoteUrl).toContain('/joystick/?peer=');
    await this.installClipboardCapture(presenterPage);
    await remotePanel.getByRole('button', { name: 'Copy remote link' }).click();
    await expect(remotePanel.getByRole('button', { name: 'Copied' })).toBeVisible();
    await expect
      .poll(() =>
        editorPage.evaluate(() => window.localStorage.getItem('localstudio.e2e.copiedRemoteLink')),
      )
      .toBe(remoteUrl);

    const localRemoteUrl = new URL(remoteUrl!);
    const localBaseUrl = new URL(baseURL);
    localRemoteUrl.protocol = localBaseUrl.protocol;
    localRemoteUrl.host = localBaseUrl.host;
    await editorPage.getByRole('button', { name: 'Enter full screen mode' }).click();

    const joystickPage = await context.newPage();
    await joystickPage.goto(localRemoteUrl.toString());
    await expect(joystickPage.getByRole('main', { name: 'Presentation remote control' })).toBeVisible();
    await expect(joystickPage.getByLabel('Connected (1)')).toBeVisible({ timeout: 45_000 });
    return joystickPage;
  },

  async installClipboardCapture(page: Page) {
    const install = () => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            await Promise.resolve();
            window.localStorage.setItem('localstudio.e2e.copiedRemoteLink', text);
          },
        },
      });
    };
    await page.addInitScript(install);
    await page.evaluate(install);
  },

  async openPresenterView(page: Page) {
    const presenterPopupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Presentation play options' }).click();
    await page.getByRole('menuitem', { name: /Presenter view/i }).click();
    const presenterPage = await presenterPopupPromise;
    await presenterPage.locator('.presenter-view').waitFor({ state: 'visible', timeout: 30_000 });
    const introDismissButton = presenterPage.getByRole('button', { name: 'Got it' });
    if (await introDismissButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await introDismissButton.click();
    }
    await expect(presenterPage.getByRole('main', { name: 'Presenter view' })).toBeVisible();
    return presenterPage;
  },
};
