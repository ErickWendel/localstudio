/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type CommandPageLayoutContractProject } from './command-page-layout-contract-project';

export async function evaluateCommandPageLayoutPageContract(
  currentProject: CommandPageLayoutContractProject,
): Promise<CommandPageLayoutContractProject> {
  const { basicCommands } = (await import(
    '/editor/src/domain/commands/elements/basicCommands.ts'
  )) as typeof import('../../../apps/editor/src/domain/commands/elements/basicCommands');

  let project = currentProject;
  const run = (command: { execute(project: typeof project): typeof project }) => {
    project = command.execute(project);
  };

  run(new basicCommands.DuplicatePageCommand('page-1', 'page-2', (id: string) => id + '-copy'));
  run(new basicCommands.RenamePageCommand('page-2', 'Appendix'));
  run(new basicCommands.SetPageVisibilityCommand('page-2', false));
  run(new basicCommands.ReorderPageCommand('page-2', 0));
  run(new basicCommands.DeletePageCommand('page-2'));

  return project;
}
