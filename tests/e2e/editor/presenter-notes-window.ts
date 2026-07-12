import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const presenterNotesWindow = {
  async dismissIntro(presenterPage: Page): Promise<void> {
    const introDismissButton = presenterPage.getByRole('button', { name: 'Got it' });
    if (await introDismissButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await presenterPage.getByLabel("Don't show this message again").check();
      await introDismissButton.click();
    }
  },

  async open(page: Page): Promise<Page> {
    const presenterPopupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Presentation play options' }).click();
    await page.getByRole('menuitem', { name: /Presenter view/i }).click();
    const presenterPage = await presenterPopupPromise;
    await presenterPage.locator('.presenter-view').waitFor({ state: 'visible', timeout: 30_000 });
    await this.dismissIntro(presenterPage);
    await expect(presenterPage.getByRole('main', { name: 'Presenter view' })).toBeVisible();
    expect(await presenterPage.evaluate(() => Boolean(window.opener))).toBe(true);
    await expect(page.getByRole('dialog', { name: 'Audience Window' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Remote control this presentation' }),
    ).toBeHidden();
    await page.getByRole('button', { name: 'Enter full screen mode' }).click();
    return presenterPage;
  },
};
