import { applyPalette, GIFEncoder, quantize } from 'gifenc';

const conversionDefaults = {
  frameRate: 6,
  maxColors: 96,
  maxDimension: 480,
  maxDurationSeconds: 12,
};

export interface VideoToAnimatedGifOptions {
  endSeconds?: number | undefined;
  frameRate?: number | undefined;
  maxColors?: number | undefined;
  maxDimension?: number | undefined;
  maxDurationSeconds?: number | undefined;
  startSeconds?: number | undefined;
}

export interface VideoToAnimatedGifResult {
  blob: Blob;
  encodedDurationSeconds: number;
  frameCount: number;
  sourceDurationSeconds: number;
}

function waitForEvent(target: HTMLMediaElement, eventName: 'loadeddata' | 'seeked') {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(eventName, onSuccess);
      target.removeEventListener('error', onError);
    };
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('The video could not be decoded for animated GIF export.'));
    };
    target.addEventListener(eventName, onSuccess, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
}

async function seekVideo(video: HTMLVideoElement, timeSeconds: number) {
  if (Math.abs(video.currentTime - timeSeconds) < 0.001) return;
  const seeked = waitForEvent(video, 'seeked');
  video.currentTime = timeSeconds;
  await seeked;
}

function getOutputSize(video: HTMLVideoElement, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
  return {
    height: Math.max(1, Math.round(video.videoHeight * scale)),
    width: Math.max(1, Math.round(video.videoWidth * scale)),
  };
}

export async function convertVideoToAnimatedGif(
  source: Blob,
  options: VideoToAnimatedGifOptions = {},
): Promise<VideoToAnimatedGifResult> {
  const video = document.createElement('video');
  const sourceUrl = URL.createObjectURL(source);
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = sourceUrl;

  try {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForEvent(video, 'loadeddata');
    }
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error('The video duration is unavailable for animated GIF export.');
    }

    const frameRate = Math.max(1, options.frameRate ?? conversionDefaults.frameRate);
    const maxColors = Math.min(256, Math.max(2, options.maxColors ?? conversionDefaults.maxColors));
    const maxDurationSeconds = Math.max(
      0.1,
      options.maxDurationSeconds ?? conversionDefaults.maxDurationSeconds,
    );
    const startSeconds = Math.min(
      Math.max(0, options.startSeconds ?? 0),
      Math.max(0, video.duration - 0.001),
    );
    const requestedEndSeconds = Math.min(
      video.duration,
      Math.max(startSeconds, options.endSeconds ?? video.duration),
    );
    const endSeconds = Math.min(requestedEndSeconds, startSeconds + maxDurationSeconds);
    const encodedDurationSeconds = endSeconds - startSeconds;
    // Always sample both ends of a non-empty clip. Otherwise a very short animation
    // (for example, a two-frame MP4 created from a GIF) becomes a static image.
    const frameCount = Math.max(2, Math.ceil(encodedDurationSeconds * frameRate));
    const frameDelayMs = Math.max(20, Math.round((encodedDurationSeconds * 1000) / frameCount));
    const size = getOutputSize(video, options.maxDimension ?? conversionDefaults.maxDimension);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    if (!context) throw new Error('Canvas is unavailable for animated GIF export.');
    const encoder = GIFEncoder();

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const frameTime = Math.min(
        Math.max(startSeconds, endSeconds - 0.001),
        startSeconds + frameIndex / frameRate,
      );
      await seekVideo(video, frameTime);
      context.drawImage(video, 0, 0, size.width, size.height);
      const pixels = context.getImageData(0, 0, size.width, size.height).data;
      const palette = quantize(pixels, maxColors, { format: 'rgb444' });
      const indexedPixels = applyPalette(pixels, palette, 'rgb444');
      encoder.writeFrame(indexedPixels, size.width, size.height, {
        delay: frameDelayMs,
        palette,
        repeat: 0,
      });
      if (frameIndex % 4 === 3)
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }

    encoder.finish();
    const encodedBytes = encoder.bytes();
    const outputBytes = new Uint8Array(encodedBytes.byteLength);
    outputBytes.set(encodedBytes);
    return {
      blob: new Blob([outputBytes.buffer], { type: 'image/gif' }),
      encodedDurationSeconds,
      frameCount,
      sourceDurationSeconds: video.duration,
    };
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(sourceUrl);
  }
}
