import { type Page } from '@playwright/test';

import { installFakeOpfs } from '../support/fake-opfs';
import { remoteMirrorImportConfig } from './remote-mirror-import-config';

export const remoteMirrorImportBrowserSetup = {
  async install(page: Page): Promise<void> {
    await page.addInitScript(installFakeOpfs);
    await page.addInitScript((config) => {
      window.localStorage.setItem('localstudio.minioMirror.config', JSON.stringify(config));
    }, remoteMirrorImportConfig);
  },
};
