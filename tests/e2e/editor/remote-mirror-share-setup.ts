import { type BrowserContext, type Page } from '@playwright/test';

import { installFakeOpfs } from '../support/fake-opfs';

export const remoteMirrorShareSetup = {
  async install(context: BrowserContext, page: Page, baseURL: string): Promise<void> {
    await installFakeOpfs(page);
    await context.grantPermissions(['clipboard-write'], { origin: baseURL });
  },
};
