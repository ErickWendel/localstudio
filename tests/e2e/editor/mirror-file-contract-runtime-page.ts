import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { evaluateMirrorFileGenerationContract } from './mirror-file-generation-contract-browser';
import { mirrorFileGenerationContractFixtures } from './mirror-file-generation-contract-fixtures';

export const mirrorFileContractRuntimePage = {
  async run(page: Page, baseURL: string) {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    return page.evaluate(
      evaluateMirrorFileGenerationContract,
      mirrorFileGenerationContractFixtures.createInput(),
    );
  },
};
