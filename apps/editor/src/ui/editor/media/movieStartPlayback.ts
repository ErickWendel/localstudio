import type { ProjectDocument } from '../../../domain/documents/model';

interface MovieStartAnimationPreview {
  activeBuildElementId: string | undefined;
  pageId: string;
  waitingForClick: boolean;
}

function playVideo(video: HTMLVideoElement) {
  const playResult = video.play() as Promise<void> | undefined;
  if (playResult !== undefined) {
    void playResult.catch(() => {
      video.pause();
    });
  }
}

function getMovieStartVideo(
  root: ParentNode,
  elementId: string,
): HTMLVideoElement | undefined {
  return Array.from(root.querySelectorAll<HTMLVideoElement>('video[data-element-id]')).find(
    (video): video is HTMLVideoElement => video.dataset.elementId === elementId,
  );
}

function consumeStartedBuild(video: HTMLVideoElement, buildId: string) {
  if (video.dataset.startedMovieBuildId !== buildId) return false;
  delete video.dataset.startedMovieBuildId;
  return true;
}

function playPendingMovieStart(
  root: ParentNode | null | undefined,
  project: ProjectDocument,
  animationPreview: MovieStartAnimationPreview | undefined,
) {
  if (!root || !animationPreview?.waitingForClick || !animationPreview.activeBuildElementId) {
    return false;
  }
  const page = project.pages.find((item) => item.id === animationPreview.pageId);
  const build = page?.animationBuilds?.find(
    (item) =>
      item.elementId === animationPreview.activeBuildElementId && item.mediaAction === 'play',
  );
  if (!build) return false;
  const element = project.elements[build.elementId];
  if (element?.type !== 'video') return false;
  const video = getMovieStartVideo(root, element.id);
  if (!video) return false;

  video.currentTime = Math.max(0, element.trimStartSeconds);
  playVideo(video);
  video.dataset.startedMovieBuildId = build.id;
  return true;
}

export const movieStartPlayback = {
  consumeStartedBuild,
  playPendingMovieStart,
};
