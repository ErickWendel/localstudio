import { type Page } from '@playwright/test';

import { fakeOpfsInitScript } from './fake-opfs-init-script';
import type { FakeOpfsOptions } from './fake-opfs-types';

export async function installFakeOpfs(page: Page, options: FakeOpfsOptions = {}) {
  await page.addInitScript({
    content: fakeOpfsInitScript.build(options),
  });
}
