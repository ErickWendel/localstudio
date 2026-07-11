/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type Page } from '@playwright/test';

import { type CommandPageLayoutContractProject } from './command-page-layout-contract-project';

export const commandPageLayoutThemeCommands = {
  async run(
    page: Page,
    project: CommandPageLayoutContractProject,
  ): Promise<CommandPageLayoutContractProject> {
    return page.evaluate(async (currentProject) => {
      const { basicCommands } = (await import(
        '/editor/src/domain/commands/elements/basicCommands.ts'
      )) as typeof import('../../../apps/editor/src/domain/commands/elements/basicCommands');

      let project = currentProject;
      const run = (command: { execute(project: typeof project): typeof project }) => {
        project = command.execute(project);
      };

      const theme = {
        id: 'theme-contrast',
        name: 'Contrast',
        palette: ['#000000', '#ffffff'],
        typography: { bodyFontFamily: 'Inter', headingFontFamily: 'Inter' },
      };
      run(new basicCommands.SaveThemeCommand(theme));
      run(new basicCommands.ApplyThemeCommand('theme-contrast'));
      run(new basicCommands.EditThemeCommand({ ...theme, name: 'Contrast edited' }));

      return project;
    }, project);
  },
};
