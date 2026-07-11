import type { ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type MovieControlsContractResult = {
  consumedBuild: boolean;
  endTime: number;
  fastForwardRate: number;
  movieStarted: boolean;
  startTime: number;
};

export async function evaluateMovieControlsContract(
  movieProject: ProjectDocument,
): Promise<MovieControlsContractResult> {
  const [{ movieStartPlayback }, { presentationMovieControls }] = (await Promise.all([
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
  video.remove();

  return {
    consumedBuild,
    endTime,
    fastForwardRate,
    movieStarted,
    startTime,
  };
}
