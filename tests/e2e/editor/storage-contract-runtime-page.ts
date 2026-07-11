import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { evaluateStorageContract } from './storage-contract-browser';
import { createStorageContractProject } from './storage-contract-project';

export const storageContractRuntimePage = {
  async run(page: Page, baseURL: string) {
    await installFakeOpfs(page, { directoryPicker: true });
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    return page.evaluate(evaluateStorageContract, createStorageContractProject());
  },
};
