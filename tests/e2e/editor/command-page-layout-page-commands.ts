import { type Page } from '@playwright/test';

import { type CommandPageLayoutContractProject } from './command-page-layout-contract-project';
import { evaluateCommandPageLayoutPageContract } from './command-page-layout-page-contract-browser';

export const commandPageLayoutPageCommands = {
  async run(
    page: Page,
    project: CommandPageLayoutContractProject,
  ): Promise<CommandPageLayoutContractProject> {
    return page.evaluate(evaluateCommandPageLayoutPageContract, project);
  },
};
