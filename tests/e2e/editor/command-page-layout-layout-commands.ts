import { type Page } from '@playwright/test';

import { type CommandPageLayoutContractProject } from './command-page-layout-contract-project';
import { evaluateCommandPageLayoutLayoutContract } from './command-page-layout-layout-contract-browser';

export const commandPageLayoutLayoutCommands = {
  async run(
    page: Page,
    project: CommandPageLayoutContractProject,
  ): Promise<CommandPageLayoutContractProject> {
    return page.evaluate(evaluateCommandPageLayoutLayoutContract, project);
  },
};
