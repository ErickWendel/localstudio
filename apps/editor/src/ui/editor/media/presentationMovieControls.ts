type MovieHoldAction = 'fast-forward' | 'rewind';

interface MovieHoldVideoState {
  playbackRate: number;
  video: HTMLVideoElement;
  wasPaused: boolean;
}

interface MovieHoldState {
  action: MovieHoldAction;
  accelerationTimeoutId: number;
  intervalId?: number;
  videos: MovieHoldVideoState[];
}

const movieHoldInitialRate = 2;
const movieHoldAcceleratedRate = 4;
const movieHoldAccelerationDelayMs = 4000;
const movieRewindIntervalMs = 100;
const movieClickPulseMs = 800;

function getVideoTrimStart(video: HTMLVideoElement) {
  const trimStart = Number(video.dataset.trimStart);
  return Number.isFinite(trimStart) ? Math.max(0, trimStart) : 0;
}

function getVideoTrimEnd(video: HTMLVideoElement) {
  const trimEnd = Number(video.dataset.trimEnd);
  if (Number.isFinite(trimEnd) && trimEnd > 0) return trimEnd;
  return Number.isFinite(video.duration) ? video.duration : video.currentTime;
}

function collectVideoState(videos: HTMLVideoElement[]) {
  return videos.map((video) => ({
    playbackRate: video.playbackRate,
    video,
    wasPaused: video.paused,
  }));
}

function restoreVideoState(state: MovieHoldState) {
  for (const item of state.videos) {
    item.video.playbackRate = item.playbackRate;
    if (item.wasPaused) item.video.pause();
    else void item.video.play();
  }
}

function startFastForward(videos: HTMLVideoElement[]) {
  const videoStates = collectVideoState(videos);
  for (const { video } of videoStates) {
    video.playbackRate = movieHoldInitialRate;
    void video.play();
  }
  const accelerationTimeoutId = window.setTimeout(() => {
    for (const { video } of videoStates) {
      video.playbackRate = movieHoldAcceleratedRate;
    }
  }, movieHoldAccelerationDelayMs);
  return { action: 'fast-forward', accelerationTimeoutId, videos: videoStates } satisfies MovieHoldState;
}

function startRewind(videos: HTMLVideoElement[]) {
  let rewindRate = movieHoldInitialRate;
  const videoStates = collectVideoState(videos);
  for (const { video } of videoStates) {
    video.pause();
  }
  const intervalId = window.setInterval(() => {
    const secondsPerTick = rewindRate * (movieRewindIntervalMs / 1000);
    for (const { video } of videoStates) {
      video.currentTime = Math.max(getVideoTrimStart(video), video.currentTime - secondsPerTick);
    }
  }, movieRewindIntervalMs);
  const accelerationTimeoutId = window.setTimeout(() => {
    rewindRate = movieHoldAcceleratedRate;
  }, movieHoldAccelerationDelayMs);
  return { action: 'rewind', accelerationTimeoutId, intervalId, videos: videoStates } satisfies MovieHoldState;
}

function stopHold(state: MovieHoldState | undefined) {
  if (!state) return undefined;
  window.clearTimeout(state.accelerationTimeoutId);
  if (state.intervalId !== undefined) window.clearInterval(state.intervalId);
  restoreVideoState(state);
  return undefined;
}

function startHold(
  videos: HTMLVideoElement[],
  action: MovieHoldAction,
  currentState: MovieHoldState | undefined,
) {
  const previousState = stopHold(currentState);
  if (videos.length === 0) return previousState;
  return action === 'fast-forward' ? startFastForward(videos) : startRewind(videos);
}

function pulse(videos: HTMLVideoElement[], action: MovieHoldAction, currentState: MovieHoldState | undefined) {
  const nextState = startHold(videos, action, currentState);
  if (!nextState) return undefined;
  window.setTimeout(() => {
    stopHold(nextState);
  }, movieClickPulseMs);
  return nextState;
}

function control(videos: HTMLVideoElement[], action: 'end' | 'play-toggle' | 'start') {
  if (videos.length === 0) return false;
  for (const video of videos) {
    if (action === 'play-toggle') {
      if (video.paused) void video.play();
      else video.pause();
      continue;
    }
    if (action === 'start') video.currentTime = getVideoTrimStart(video);
    if (action === 'end') video.currentTime = getVideoTrimEnd(video);
  }
  return true;
}

export const presentationMovieControls = {
  control,
  pulse,
  startHold,
  stopHold,
};

export type { MovieHoldAction, MovieHoldState };
