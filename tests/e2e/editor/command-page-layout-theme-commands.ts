import { type Page } from '@playwright/test';

import { type CommandPageLayoutContractProject } from './command-page-layout-contract-project';
import { evaluateCommandPageLayoutThemeContract } from './command-page-layout-theme-contract-browser';

export const commandPageLayoutThemeCommands = {
  async run(
    page: Page,
    project: CommandPageLayoutContractProject,
  ): Promise<CommandPageLayoutContractProject> {
    return page.evaluate(evaluateCommandPageLayoutThemeContract, project);
  },
};
