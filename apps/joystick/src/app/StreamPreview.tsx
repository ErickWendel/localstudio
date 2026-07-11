import { useEffect, useRef, useState } from 'react';
import type {
  PresenterRemoteSlidePreview,
  PresenterRemoteStreamPreference,
} from '@localstudio/presenter-remote/protocol';
import { SlideCanvas } from './SlideCanvas';
import { useHorizontalSwipeNavigation } from './use-horizontal-swipe-navigation';

const streamPreferenceAspectRatio = 390 / 340;

function getNetworkQualityHint(): PresenterRemoteStreamPreference['quality'] {
  const connection = (
    navigator as Navigator & {
      connection?:
        | { effectiveType?: string | undefined; saveData?: boolean | undefined }
        | undefined;
    }
  ).connection;
  if (connection?.saveData) return 'low';
  if (connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g') return 'low';
  if (connection?.effectiveType === '3g') return 'medium';
  return window.devicePixelRatio >= 2 ? 'high' : 'medium';
}

function createStreamPreference(element: HTMLElement): PresenterRemoteStreamPreference {
  const bounds = element.getBoundingClientRect();
  const quality = getNetworkQualityHint();
  const multiplier =
    quality === 'high' ? Math.min(window.devicePixelRatio || 1, 3) : quality === 'medium' ? 1.5 : 1;
  const width = Math.max(390, Math.min(1280, Math.round(bounds.width * multiplier)));
  const height = Math.max(340, Math.min(1120, Math.round(width / streamPreferenceAspectRatio)));
  return {
    fps: quality === 'high' ? 12 : quality === 'medium' ? 8 : 6,
    height,
    quality,
    type: 'stream-preference',
    width,
  };
}

export function StreamPreview({
  fallbackPreview,
  onNavigate,
  onStreamPreference,
  renderFallbackMediaAssets = true,
  stream,
}: {
  fallbackPreview: PresenterRemoteSlidePreview | undefined;
  onNavigate: (direction: 'next' | 'previous') => void;
  onStreamPreference: (preference: PresenterRemoteStreamPreference) => void;
  renderFallbackMediaAssets?: boolean;
  stream: MediaStream;
}) {
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLButtonElement>(null);
  const playbackBlockedRef = useRef(false);
  const swipeHandlers = useHorizontalSwipeNavigation(onNavigate);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.autoplay = true;
    video.controls = false;
    video.defaultMuted = true;
    video.disablePictureInPicture = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    setVideoPlaying(false);
    const requestPlayback = () => {
      const playPromise = video.play();
      void playPromise
        ?.then(() => {
          playbackBlockedRef.current = false;
          setVideoPlaying(true);
        })
        .catch(() => {
          playbackBlockedRef.current = true;
          setVideoPlaying(false);
        });
    };
    requestPlayback();
    const frameId = window.requestAnimationFrame(requestPlayback);
    return () => {
      window.cancelAnimationFrame(frameId);
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let lastPreferenceKey = '';
    const publishPreference = () => {
      const preference = createStreamPreference(container);
      const preferenceKey = `${preference.width}x${preference.height}@${preference.fps}:${preference.quality}`;
      if (preferenceKey === lastPreferenceKey) return;
      lastPreferenceKey = preferenceKey;
      onStreamPreference(preference);
    };
    publishPreference();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(publishPreference);
    observer.observe(container);
    return () => observer.disconnect();
  }, [onStreamPreference, stream]);

  function requestVideoPlayback() {
    const video = videoRef.current;
    if (!video) return;
    void video
      .play()
      ?.then(() => {
        playbackBlockedRef.current = false;
        setVideoPlaying(true);
      })
      .catch(() => {
        playbackBlockedRef.current = true;
        setVideoPlaying(false);
      });
  }

  function handleClick() {
    if (videoRef.current && playbackBlockedRef.current) {
      requestVideoPlayback();
      return;
    }
    onNavigate('next');
  }

  return (
    <button
      type="button"
      ref={containerRef}
      className={
        videoPlaying
          ? 'joystick-stream-hit-target joystick-stream-hit-target-video-ready'
          : 'joystick-stream-hit-target'
      }
      aria-label="Presenter stream preview"
      onClick={handleClick}
      {...swipeHandlers}
    >
      <span className="joystick-stream-fallback" aria-hidden="true">
        <SlideCanvas preview={fallbackPreview} renderMediaAssets={renderFallbackMediaAssets} />
      </span>
      <video
        ref={videoRef}
        autoPlay
        className="joystick-stream-video"
        controls={false}
        disablePictureInPicture
        muted
        onCanPlay={() => {
          const video = videoRef.current;
          if (!video || !video.paused) return;
          requestVideoPlayback();
        }}
        onLoadedMetadata={requestVideoPlayback}
        onPlaying={() => {
          playbackBlockedRef.current = false;
          setVideoPlaying(true);
        }}
        onWaiting={() => setVideoPlaying(false)}
        playsInline
        preload="auto"
      />
    </button>
  );
}
