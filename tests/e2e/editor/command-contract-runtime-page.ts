import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { createCommandContractProject } from './command-contract-project';

export const commandContractRuntimePage = {
  async run<TResult>(
    page: Page,
    baseURL: string,
    evaluate: (initialProject: ReturnType<typeof createCommandContractProject>) => Promise<TResult>,
  ): Promise<TResult> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    return page.evaluate(evaluate, createCommandContractProject());
  },
};
