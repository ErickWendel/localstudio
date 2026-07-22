import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { evaluatePresenterRemotePreviewContract } from './presenter-remote-preview-contract-browser';

export const presenterRemotePreviewContractRuntimePage = {
  async run(page: Page, baseURL: string) {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    return page.evaluate(evaluatePresenterRemotePreviewContract);
  },
};
