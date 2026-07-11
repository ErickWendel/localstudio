import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { aiAutomationContractProject } from './ai-automation-contract-project';
import {
  evaluateAutomationControllerContract,
  type AutomationControllerContractResult,
} from './automation-controller-contract-browser';

export const automationControllerContractPage = {
  async run(page: Page, baseURL: string): Promise<AutomationControllerContractResult> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    return page.evaluate(evaluateAutomationControllerContract, aiAutomationContractProject.createProject());
  },
};
