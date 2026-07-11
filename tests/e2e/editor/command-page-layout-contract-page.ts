import { type Page } from '@playwright/test';

import {
  commandPageLayoutContractAssertions,
  type CommandPageLayoutContractResult,
} from './command-page-layout-contract-assertions';
import { commandPageLayoutContractProject } from './command-page-layout-contract-project';
import { commandPageLayoutLayoutCommands } from './command-page-layout-layout-commands';
import { commandPageLayoutPageCommands } from './command-page-layout-page-commands';
import { commandPageLayoutThemeCommands } from './command-page-layout-theme-commands';

export const commandPageLayoutContractPage = {
  async run(page: Page, baseURL: string): Promise<CommandPageLayoutContractResult> {
    await page.goto(new URL('/editor/?newProject=1', baseURL).toString());

    const projectWithPageChanges = await commandPageLayoutPageCommands.run(
      page,
      commandPageLayoutContractProject.createInitial(),
    );
    const projectWithThemeChanges = await commandPageLayoutThemeCommands.run(page, projectWithPageChanges);
    const projectWithLayoutChanges = await commandPageLayoutLayoutCommands.run(
      page,
      projectWithThemeChanges,
    );
    return commandPageLayoutContractAssertions.verify(page, projectWithLayoutChanges);
  },
};
