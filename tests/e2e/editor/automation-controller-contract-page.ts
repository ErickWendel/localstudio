import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { aiAutomationContractProject } from './ai-automation-contract-project';

export const automationControllerContractPage = {
  async run<TResult>(
    page: Page,
    baseURL: string,
    evaluate: (project: ReturnType<typeof aiAutomationContractProject.createProject>) => Promise<TResult>,
  ): Promise<TResult> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    return page.evaluate(evaluate, aiAutomationContractProject.createProject());
  },
};
