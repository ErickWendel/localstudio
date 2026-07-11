import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presentation movie playback controls in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(async () => {
    const [{ movieStartPlayback }, { presentationMovieControls }] =
      (await Promise.all([
        import('/editor/src/ui/editor/media/movieStartPlayback.ts'),
        import('/editor/src/ui/editor/media/presentationMovieControls.ts'),
      ])) as [
        typeof import('../../../apps/editor/src/ui/editor/media/movieStartPlayback'),
        typeof import('../../../apps/editor/src/ui/editor/media/presentationMovieControls'),
      ];

    const video = document.createElement('video');
    video.dataset.elementId = 'video-1';
    video.dataset.trimStart = '2';
    video.dataset.trimEnd = '12';
    Object.defineProperty(video, 'duration', { configurable: true, value: 20 });
    Object.defineProperty(video, 'paused', { configurable: true, value: true });
    video.play = () => {
      Object.defineProperty(video, 'paused', { configurable: true, value: false });
      return Promise.resolve();
    };
    video.pause = () => {
      Object.defineProperty(video, 'paused', { configurable: true, value: true });
    };
    document.body.append(video);
    const movieProject = {
      assets: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      elements: {
        'video-1': {
          assetId: 'asset-video',
          height: 100,
          id: 'video-1',
          locked: false,
          opacity: 1,
          rotation: 0,
          trimStartSeconds: 2,
          type: 'video',
          visible: true,
          width: 100,
          x: 0,
          y: 0,
        },
      },
      fonts: {},
      id: 'movie-project',
      name: 'Movie Contract',
      pages: [
        {
          background: { color: '#ffffff', type: 'color' },
          elementIds: ['video-1'],
          height: 1080,
          id: 'page-video',
          name: 'Video',
          visible: true,
          width: 1920,
          animationBuilds: [
            {
              delayMs: 0,
              effect: 'reveal',
              elementId: 'video-1',
              id: 'movie-build',
              mediaAction: 'play',
              trigger: 'on-click',
            },
          ],
        },
      ],
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const movieStarted = movieStartPlayback.playPendingMovieStart(document, movieProject, {
      activeBuildElementId: 'video-1',
      pageId: 'page-video',
      waitingForClick: true,
    });
    const consumedBuild = movieStartPlayback.consumeStartedBuild(video, 'movie-build');
    presentationMovieControls.control([video], 'end');
    const endTime = video.currentTime;
    presentationMovieControls.control([video], 'start');
    const startTime = video.currentTime;
    let holdState = presentationMovieControls.startHold([video], 'fast-forward', undefined);
    const fastForwardRate = video.playbackRate;
    holdState = presentationMovieControls.startHold([video], 'rewind', holdState);
    holdState = presentationMovieControls.stopHold(holdState);
    presentationMovieControls.pulse([video], 'fast-forward', holdState);

    return {
      consumedBuild,
      endTime,
      fastForwardRate,
      movieStarted,
      startTime,
    };
  });

  expect(result).toMatchObject({
    consumedBuild: true,
    endTime: 12,
    fastForwardRate: 2,
    movieStarted: true,
    startTime: 2,
  });
});
