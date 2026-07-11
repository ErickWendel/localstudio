/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type CommandMediaAssetContractResult = {
  remainingAssetIds: string[];
};

export async function evaluateCommandMediaAssetContract(
  initialProject: ProjectDocument,
): Promise<CommandMediaAssetContractResult> {
  const { basicCommands } = (await import(
    '/editor/src/domain/commands/elements/basicCommands.ts'
  )) as typeof import('../../../apps/editor/src/domain/commands/elements/basicCommands');

  let project = initialProject;
  const run = (command: { execute(project: typeof project): typeof project }) => {
    project = command.execute(project);
  };

  run(
    new basicCommands.ReplaceImageAssetCommand('image-1', {
      id: 'asset-image-2',
      mimeType: 'image/png',
      name: 'Replacement',
      objectUrl: 'data:image/png;base64,AQ==',
      type: 'image',
    }),
  );
  run(new basicCommands.RemoveAssetCommand('asset-image'));

  if (project.elements['image-1']?.assetId !== 'asset-image-2') {
    throw new Error('image asset should be replaced');
  }
  if (project.assets['asset-image']) throw new Error('unreferenced asset should be removed');

  return {
    remainingAssetIds: Object.keys(project.assets).sort(),
  };
}
