import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { presentationMovieControls } from '../../../../src/ui/editor/media/presentationMovieControls';

function createTestVideo(options: { currentTime?: number; duration?: number; paused?: boolean } = {}) {
  const video = document.createElement('video');
  let paused = options.paused ?? true;
  const pauseMock = vi.fn(() => {
    paused = true;
  });
  const playMock = vi.fn(() => {
    paused = false;
    return Promise.resolve();
  });
  Object.defineProperty(video, 'duration', { configurable: true, value: options.duration ?? 20 });
  Object.defineProperty(video, 'paused', { configurable: true, get: () => paused });
  video.currentTime = options.currentTime ?? 0;
  video.playbackRate = 1;
  video.play = playMock;
  video.pause = pauseMock;
  return { pauseMock, playMock, video };
}

describe('presentationMovieControls', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fast forwards at 2x, accelerates to 4x after four seconds, and restores on release', () => {
    const { pauseMock, playMock, video } = createTestVideo({ paused: true });

    const state = presentationMovieControls.startHold([video], 'fast-forward', undefined);

    expect(video.playbackRate).toBe(2);
    expect(playMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(4000);

    expect(video.playbackRate).toBe(4);

    presentationMovieControls.stopHold(state);

    expect(video.playbackRate).toBe(1);
    expect(pauseMock).toHaveBeenCalledTimes(1);
  });

  it('rewinds by time while held, accelerates after four seconds, and resumes if the movie was playing', () => {
    const { pauseMock, playMock, video } = createTestVideo({ currentTime: 20, duration: 30, paused: false });
    video.dataset.trimStart = '2';

    const state = presentationMovieControls.startHold([video], 'rewind', undefined);

    expect(pauseMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    expect(video.currentTime).toBeCloseTo(19.8);

    vi.advanceTimersByTime(4000);
    const timeAfterAcceleration = video.currentTime;
    vi.advanceTimersByTime(100);

    expect(video.currentTime).toBeCloseTo(timeAfterAcceleration - 0.4);

    presentationMovieControls.stopHold(state);

    expect(video.currentTime).toBeGreaterThanOrEqual(2);
    expect(playMock).toHaveBeenCalledTimes(1);
  });
});
