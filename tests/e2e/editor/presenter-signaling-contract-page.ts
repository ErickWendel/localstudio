import type { Page } from '@playwright/test';
import { EditorAppPage } from '../pages/editor-app.page';

export const presenterSignalingContractPage = {
  async gotoReady(page: Page, baseURL: string) {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();
  },
};
