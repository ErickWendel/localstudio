import { type BrowserContext } from '@playwright/test';

import { expect } from '../support/journey-test';

export const remoteMirrorShareEmbedView = {
  async verify(context: BrowserContext, embedSrc: string): Promise<void> {
    const embedPage = await context.newPage();
    await embedPage.goto(embedSrc);
    await expect(embedPage.getByRole('main', { name: 'Embedded shared deck' })).toBeVisible({
      timeout: 30_000,
    });
  },
};
