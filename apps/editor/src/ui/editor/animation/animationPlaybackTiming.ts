import type { ElementAnimationBuild } from '../../../domain/documents/model';

const minimumMediaActionRenderMs = 75;

function getBuildDurationMs(build: ElementAnimationBuild) {
  const durationMs = Math.max(0, build.durationMs ?? build.delayMs);
  if (build.mediaAction === 'play') return Math.max(minimumMediaActionRenderMs, durationMs);
  return durationMs;
}

export const animationPlaybackTiming = {
  getBuildDurationMs,
};
