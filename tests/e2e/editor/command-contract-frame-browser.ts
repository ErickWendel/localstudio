/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type CommandContractFrameResult = {
  missingAssetRetained: boolean;
  referencedAssetRetained: boolean;
  removedAssetGone: boolean;
  imageY: number | undefined;
  shape1X: number | undefined;
  shape2Deleted: boolean;
};

export async function evaluateCommandContractFrame(
  initialProject: ProjectDocument,
): Promise<CommandContractFrameResult> {
  const { basicCommands } = (await import(
    '/editor/src/domain/commands/elements/basicCommands.ts'
  )) as typeof import('../../../apps/editor/src/domain/commands/elements/basicCommands');

  let project = initialProject;
  const run = (command: { execute(project: typeof project): typeof project }) => {
    project = command.execute(project);
  };

  run(
    new basicCommands.AddElementsCommand('page-1', [
      {
        fill: '#123456',
        height: 80,
        id: 'shape-2',
        locked: false,
        opacity: 1,
        rotation: 0,
        shape: 'ellipse',
        type: 'shape',
        visible: true,
        width: 80,
        x: 40,
        y: 40,
      },
    ]),
  );
  run(new basicCommands.UpdateElementFrameCommand('shape-2', { height: 96, width: 120, x: 44 }));
  run(new basicCommands.UpdateElementFramesCommand({ 'shape-1': { x: 100 }, 'image-1': { y: 320 } }));
  run(new basicCommands.DeleteElementCommand('page-1', 'shape-2'));
  run(new basicCommands.RemoveAssetCommand('missing-asset'));
  run(new basicCommands.RemoveAssetCommand('asset-image'));
  project = {
    ...project,
    assets: {
      ...project.assets,
      'asset-unused': {
        id: 'asset-unused',
        mimeType: 'image/png',
        name: 'Unused asset',
        objectUrl: 'blob:unused',
        storage: 'inline',
        type: 'image',
      },
    },
  };
  run(new basicCommands.RemoveAssetCommand('asset-unused'));

  if (project.elements['shape-2']) throw new Error('added shape should be deleted');

  return {
    missingAssetRetained: !project.assets['missing-asset'],
    referencedAssetRetained: Boolean(project.assets['asset-image']),
    removedAssetGone: !project.assets['asset-unused'],
    imageY: project.elements['image-1']?.y,
    shape1X: project.elements['shape-1']?.x,
    shape2Deleted: !project.elements['shape-2'],
  };
}
