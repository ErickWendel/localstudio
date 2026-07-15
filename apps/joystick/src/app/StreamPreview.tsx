import { useEffect, useRef, useState } from 'react';
import type { PresenterRemoteSlidePreview } from '@localstudio/presenter-remote/protocol';
import { SlideCanvas } from './SlideCanvas';
import { useHorizontalSwipeNavigation } from './use-horizontal-swipe-navigation';

export function StreamPreview({
  fallbackPreview,
  onNavigate,
  renderFallbackMediaAssets = true,
  stream,
}: {
  fallbackPreview: PresenterRemoteSlidePreview | undefined;
  onNavigate: (direction: 'next' | 'previous') => void;
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
