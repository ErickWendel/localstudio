import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const remoteMirrorShareSettings = {
  async enableMirroring(page: Page): Promise<void> {
    await page
      .getByRole('contentinfo', { name: 'Editor footer controls' })
      .getByRole('button', { name: 'Mirror settings' })
      .click();
    await page
      .getByRole('dialog', { name: 'Settings' })
      .getByRole('button', { name: 'Mirror settings' })
      .click();
    await expect(page.getByRole('dialog', { name: 'Mirror settings' })).toBeVisible();
    await page.getByRole('button', { name: 'Enable mirroring' }).click();
    await expect(page.getByRole('button', { name: /Mirror up to date|Mirror syncing|Mirror ready/ })).toBeVisible();
    await page.getByRole('button', { name: 'Close mirror settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Mirror settings' })).toBeHidden();
    await expect(page.getByRole('button', { name: /Mirror up to date|Mirror syncing|Mirror ready/ })).toBeVisible();
  },
};
