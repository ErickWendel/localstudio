/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type CommandMediaVideoPlaybackContractResult = {
  videoRepeatMode: string | undefined;
  videoTrimEnd: number | undefined;
  videoTrimStart: number | undefined;
  videoVolume: number | undefined;
};

export async function evaluateCommandMediaVideoPlaybackContract(
  initialProject: ProjectDocument,
): Promise<CommandMediaVideoPlaybackContractResult> {
  const { basicCommands } = (await import(
    '/editor/src/domain/commands/elements/basicCommands.ts'
  )) as typeof import('../../../apps/editor/src/domain/commands/elements/basicCommands');

  let project = initialProject;
  const run = (command: { execute(project: typeof project): typeof project }) => {
    project = command.execute(project);
  };

  run(
    new basicCommands.UpdateMediaPlaybackCommand('video-1', {
      autoplayInPreview: true,
      loop: true,
      playbackPositionSeconds: 4,
      repeatMode: 'loop',
      trimEndSeconds: 12,
      trimStartSeconds: 2,
      volume: 0.4,
    }),
  );

  if (project.elements['video-1']?.repeatMode !== 'loop') {
    throw new Error('video repeat mode should update');
  }

  return {
    videoRepeatMode: project.elements['video-1']?.repeatMode,
    videoTrimEnd: project.elements['video-1']?.trimEndSeconds,
    videoTrimStart: project.elements['video-1']?.trimStartSeconds,
    videoVolume: project.elements['video-1']?.volume,
  };
}
