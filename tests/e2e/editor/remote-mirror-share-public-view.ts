import { type BrowserContext } from '@playwright/test';

import { expect } from '../support/journey-test';

export const remoteMirrorSharePublicView = {
  async verify(context: BrowserContext, publicUrl: string): Promise<void> {
    const publicPage = await context.newPage();
    await publicPage.goto(publicUrl);
    await expect(publicPage.getByRole('main', { name: 'Public presentation' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(publicPage.getByText('1 / 1')).toBeVisible();
  },
};
