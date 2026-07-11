/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type CommandContractOrderResult = {
  copyLocked: boolean | undefined;
  copyVisible: boolean | undefined;
  pageElementIds: string[] | undefined;
};

export async function evaluateCommandContractOrder(
  initialProject: ProjectDocument,
): Promise<CommandContractOrderResult> {
  const { basicCommands } = (await import(
    '/editor/src/domain/commands/elements/basicCommands.ts'
  )) as typeof import('../../../apps/editor/src/domain/commands/elements/basicCommands');

  let project = initialProject;
  const run = (command: { execute(project: typeof project): typeof project }) => {
    project = command.execute(project);
  };

  run(new basicCommands.AlignElementCommand('page-1', 'shape-1', 'page-center'));
  run(new basicCommands.SetZOrderCommand('page-1', 'shape-1', 'front'));
  run(new basicCommands.SetZOrderCommand('page-1', 'shape-1', 'backward'));
  run(new basicCommands.DuplicateElementCommand('page-1', 'text-1', 'text-copy'));
  run(new basicCommands.ReorderElementCommand('page-1', 'text-copy', 0));
  run(new basicCommands.SetElementVisibilityCommand('text-copy', false));
  run(new basicCommands.SetElementLockCommand('text-copy', true));

  if (project.elements['text-copy']?.locked !== true) throw new Error('copy should be locked');
  if (project.elements['text-copy']?.visible !== false) throw new Error('copy should be hidden');

  return {
    copyLocked: project.elements['text-copy']?.locked,
    copyVisible: project.elements['text-copy']?.visible,
    pageElementIds: project.pages[0]?.elementIds,
  };
}
