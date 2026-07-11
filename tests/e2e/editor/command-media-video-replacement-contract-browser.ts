/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type CommandMediaVideoReplacementContractResult = {
  videoAssetId: string | undefined;
  videoDuration: number | undefined;
  videoTrimEnd: number | undefined;
  videoTrimStart: number | undefined;
};

export async function evaluateCommandMediaVideoReplacementContract(
  initialProject: ProjectDocument,
): Promise<CommandMediaVideoReplacementContractResult> {
  const { basicCommands } = (await import(
    '/editor/src/domain/commands/elements/basicCommands.ts'
  )) as typeof import('../../../apps/editor/src/domain/commands/elements/basicCommands');

  let project = initialProject;
  const run = (command: { execute(project: typeof project): typeof project }) => {
    project = command.execute(project);
  };

  run(
    new basicCommands.ReplaceVideoAssetCommand(
      'video-1',
      {
        id: 'asset-video-2',
        mimeType: 'video/mp4',
        name: 'Replacement video',
        objectUrl: 'data:video/mp4;base64,AQ==',
        type: 'video',
      },
      { durationSeconds: 18 },
    ),
  );

  if (project.elements['video-1']?.assetId !== 'asset-video-2') {
    throw new Error('video asset should be replaced');
  }

  return {
    videoAssetId: project.elements['video-1']?.assetId,
    videoDuration: project.elements['video-1']?.durationSeconds,
    videoTrimEnd: project.elements['video-1']?.trimEndSeconds,
    videoTrimStart: project.elements['video-1']?.trimStartSeconds,
  };
}
