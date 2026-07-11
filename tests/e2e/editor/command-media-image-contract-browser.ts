/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type CommandMediaImageContractResult = {
  imageAssetId: string | undefined;
  imageCrop: unknown;
  imageFlipped: boolean | undefined;
};

export async function evaluateCommandMediaImageContract(
  initialProject: ProjectDocument,
): Promise<CommandMediaImageContractResult> {
  const { basicCommands } = (await import(
    '/editor/src/domain/commands/elements/basicCommands.ts'
  )) as typeof import('../../../apps/editor/src/domain/commands/elements/basicCommands');

  let project = initialProject;
  const run = (command: { execute(project: typeof project): typeof project }) => {
    project = command.execute(project);
  };

  run(new basicCommands.ToggleImageFlipCommand('image-1'));
  run(
    new basicCommands.UpdateImageCropCommand('image-1', {
      crop: { height: 0.8, width: 0.7, x: 0.1, y: 0.05 },
      height: 250,
      width: 350,
    }),
  );
  run(
    new basicCommands.ReplaceImageAssetCommand('image-1', {
      id: 'asset-image-2',
      mimeType: 'image/png',
      name: 'Replacement',
      objectUrl: 'data:image/png;base64,AQ==',
      type: 'image',
    }),
  );

  if (project.elements['image-1']?.assetId !== 'asset-image-2') {
    throw new Error('image asset should be replaced');
  }

  return {
    imageAssetId: project.elements['image-1']?.assetId,
    imageCrop: project.elements['image-1']?.crop,
    imageFlipped: project.elements['image-1']?.flipX,
  };
}
