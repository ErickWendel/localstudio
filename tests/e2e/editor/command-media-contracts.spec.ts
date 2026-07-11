/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { createCommandContractProject } from './command-contract-project';

const getServer = withIsolatedDevServer(test);

test.describe('editor media command contracts', () => {
  test('executes image, video, playback, replacement, and asset commands in the browser runtime', async ({
    page,
  }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    const result = await page.evaluate(async (initialProject) => {
      const { basicCommands } = (await import(
        '/editor/src/domain/commands/elements/basicCommands.ts'
      )) as typeof import('../../../apps/editor/src/domain/commands/elements/basicCommands');

      function assert(condition: unknown, message: string) {
        if (!condition) throw new Error(message);
      }

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
      run(
        new basicCommands.ReplaceImageAssetCommand('image-1', {
          id: 'asset-image-2',
          mimeType: 'image/png',
          name: 'Replacement',
          objectUrl: 'data:image/png;base64,AQ==',
          type: 'image',
        }),
      );
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
      run(new basicCommands.RemoveAssetCommand('asset-image'));

      assert(project.elements['image-1']?.assetId === 'asset-image-2', 'image asset should be replaced');
      assert(project.elements['video-1']?.assetId === 'asset-video-2', 'video asset should be replaced');
      assert(!project.assets['asset-image'], 'unreferenced asset should be removed');
      assert(project.elements['video-1']?.repeatMode === 'loop', 'video repeat mode should update');

      return {
        imageCrop: project.elements['image-1']?.crop,
        imageFlipped: project.elements['image-1']?.flipX,
        remainingAssetIds: Object.keys(project.assets).sort(),
        videoDuration: project.elements['video-1']?.durationSeconds,
        videoRepeatMode: project.elements['video-1']?.repeatMode,
      };
    }, createCommandContractProject());

    expect(result).toEqual({
      imageCrop: { height: 0.8, width: 0.7, x: 0.1, y: 0.05 },
      imageFlipped: true,
      remainingAssetIds: ['asset-image-2', 'asset-video', 'asset-video-2'],
      videoDuration: 18,
      videoRepeatMode: 'loop',
    });
  });
});
