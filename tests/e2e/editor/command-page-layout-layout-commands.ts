/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type Page } from '@playwright/test';

import { type CommandPageLayoutContractProject } from './command-page-layout-contract-project';

export const commandPageLayoutLayoutCommands = {
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

      const layout = {
        elementIds: ['title-placeholder'],
        elements: {
          'title-placeholder': {
            align: 'left',
            fill: '#111111',
            fontFamily: 'Inter',
            fontSize: 64,
            fontWeight: 700,
            height: 120,
            id: 'title-placeholder',
            lineHeight: 1.1,
            locked: true,
            opacity: 1,
            placeholderRole: 'title',
            rotation: 0,
            templateSource: 'layout',
            text: 'Title',
            type: 'text',
            verticalAlign: 'top',
            visible: true,
            width: 900,
            x: 80,
            y: 80,
          },
        },
        id: 'layout-title',
        name: 'Title layout',
        placeholderVisibility: { body: true, media: true, title: true },
      };
      run(new basicCommands.SaveSlideLayoutCommand(layout));
      run(new basicCommands.ToggleSlideLayoutPlaceholderVisibilityCommand('layout-title', 'title', false));
      run(new basicCommands.ToggleSlideLayoutPlaceholderVisibilityCommand('layout-title', 'title', true));
      run(new basicCommands.ApplySlideLayoutCommand('page-1', 'layout-title'));
      run(new basicCommands.EditSlideLayoutCommand({ ...layout, name: 'Edited title layout' }));

      return project;
    }, project);
  },
};
