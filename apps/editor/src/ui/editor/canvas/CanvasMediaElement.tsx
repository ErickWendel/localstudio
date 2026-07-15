import { useEffect, useRef } from 'react';
import type { GifElement, VideoElement } from '../../../domain/documents/model';
import { movieStartPlayback } from '../media/movieStartPlayback';
import type { ElementAnimationRenderState } from './canvas-element-props';

function getMediaStyle(
  element: GifElement | VideoElement,
  scale: { x: number; y: number },
  interactive: boolean,
  opacity: number,
) {
  return {
    height: `${element.height * scale.y}px`,
    left: `${element.x * scale.x}px`,
    opacity,
    pointerEvents: interactive ? 'auto' : 'none',
    top: `${element.y * scale.y}px`,
    transform: `rotate(${element.rotation}deg)`,
    width: `${element.width * scale.x}px`,
  } as const;
}

function CanvasVideoElement({
  animationState,
  assetName,
  assetUrl,
  element,
  interactive,
  opacity,
  previewMode,
  scale,
}: {
  animationState: ElementAnimationRenderState;
  assetName: string;
  assetUrl: string | undefined;
  element: VideoElement;
  interactive: boolean;
  opacity: number;
  previewMode: boolean;
  scale: { x: number; y: number };
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reverseIntervalRef = useRef<number | undefined>(undefined);
  const previousTrimRef = useRef<
    | {
        assetUrl: string | undefined;
        end: number | undefined;
        poster: number | undefined;
        start: number;
      }
    | undefined
  >(undefined);
  const repeatMode = element.repeatMode ?? (element.loop ? 'loop' : 'none');
  const autoplay =
    previewMode && element.autoplayInPreview && !element.startOnClick && !animationState.hidden;

  function stopReversePlayback() {
    if (reverseIntervalRef.current === undefined) return;
    window.clearInterval(reverseIntervalRef.current);
    reverseIntervalRef.current = undefined;
  }

  function getTrimStart() {
    return Math.max(0, element.trimStartSeconds);
  }

  function getTrimEnd(video: HTMLVideoElement) {
    if (element.trimEndSeconds !== undefined && element.trimEndSeconds > 0) {
      return Math.max(0, element.trimEndSeconds);
    }
    return Number.isFinite(video.duration) ? video.duration : undefined;
  }

  function playVideo(video: HTMLVideoElement) {
    const playResult = video.play() as Promise<void> | undefined;
    if (playResult !== undefined) {
      void playResult.catch(() => {
        video.pause();
      });
    }
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const start = Math.max(0, element.trimStartSeconds);
    const end =
      element.trimEndSeconds !== undefined && element.trimEndSeconds > 0
        ? Math.max(0, element.trimEndSeconds)
        : Number.isFinite(video.duration)
          ? video.duration
          : undefined;
    const previousTrim = previousTrimRef.current;
    const assetChanged = previousTrim?.assetUrl !== assetUrl;
    const poster =
      element.posterFrameSeconds !== undefined
        ? Math.max(0, element.posterFrameSeconds)
        : undefined;
    const posterChanged = previousTrim?.poster !== poster;
    video.volume = Math.min(1, Math.max(0, element.volume ?? 1));
    if (posterChanged && poster !== undefined) {
      video.currentTime = poster;
    } else if (assetChanged || previousTrim?.start !== start) {
      video.currentTime = start;
    } else if (previousTrim?.end !== end && end !== undefined) {
      video.currentTime = end;
    }
    previousTrimRef.current = { assetUrl, end, poster, start };
  }, [
    assetUrl,
    element.posterFrameSeconds,
    element.trimEndSeconds,
    element.trimStartSeconds,
    element.volume,
  ]);

  useEffect(() => {
    return () => {
      if (reverseIntervalRef.current === undefined) return;
      window.clearInterval(reverseIntervalRef.current);
      reverseIntervalRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || element.playbackPositionSeconds === undefined) return;
    stopReversePlayback();
    video.currentTime = Math.max(0, element.playbackPositionSeconds);
  }, [element.playbackPositionSeconds]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || element.playing === undefined) return;
    stopReversePlayback();
    if (!element.playing) {
      video.pause();
      return;
    }
    playVideo(video);
  }, [element.playing]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !previewMode || !element.autoplayInPreview) return;
    if (animationState.activeBuild?.mediaAction === 'play') {
      stopReversePlayback();
      video.currentTime = Math.max(0, element.trimStartSeconds);
      if (movieStartPlayback.consumeStartedBuild(video, animationState.activeBuild.id)) return;
      playVideo(video);
      return;
    }
    if (animationState.hidden || element.startOnClick) {
      stopReversePlayback();
      video.pause();
      video.currentTime = Math.max(0, element.trimStartSeconds);
    }
  }, [
    animationState.activeBuild,
    animationState.hidden,
    element.autoplayInPreview,
    element.startOnClick,
    element.trimStartSeconds,
    previewMode,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (
      !video ||
      !previewMode ||
      !element.autoplayInPreview ||
      element.startOnClick ||
      animationState.hidden ||
      animationState.activeBuild?.mediaAction === 'play' ||
      animationState.playbackRunId === undefined
    ) {
      return;
    }
    stopReversePlayback();
    video.currentTime = Math.max(0, element.trimStartSeconds);
    playVideo(video);
  }, [
    animationState.activeBuild,
    animationState.hidden,
    animationState.playbackRunId,
    element.autoplayInPreview,
    element.startOnClick,
    element.trimStartSeconds,
    previewMode,
  ]);

  function playReverse(video: HTMLVideoElement) {
    stopReversePlayback();
    video.pause();
    reverseIntervalRef.current = window.setInterval(() => {
      const trimStart = getTrimStart();
      const nextTime = Math.max(trimStart, video.currentTime - 1 / 30);
      video.currentTime = nextTime;
      if (nextTime > trimStart) return;
      stopReversePlayback();
      playVideo(video);
    }, 1000 / 30);
  }

  function enforceTrimWindow(video: HTMLVideoElement) {
    const trimEnd = getTrimEnd(video);
    if (trimEnd === undefined || trimEnd <= 0) return;
    if (video.currentTime < trimEnd) return;
    if (repeatMode === 'loop') {
      video.currentTime = getTrimStart();
      playVideo(video);
      return;
    }
    if (repeatMode === 'loop-back-and-forth') {
      playReverse(video);
      return;
    }
    video.pause();
  }

  return (
    <video
      aria-label={assetName}
      autoPlay={autoplay}
      className="canvas-media-element"
      controls={false}
      data-element-id={element.id}
      data-trim-end={element.trimEndSeconds ?? ''}
      data-trim-start={element.trimStartSeconds}
      data-media-element-id={element.id}
      loop={repeatMode === 'loop' && element.trimEndSeconds === undefined}
      muted={element.muted}
      playsInline
      preload="auto"
      ref={videoRef}
      src={assetUrl}
      style={getMediaStyle(element, scale, interactive, opacity)}
      onLoadedMetadata={(event) => {
        event.currentTarget.volume = Math.min(1, Math.max(0, element.volume ?? 1));
        event.currentTarget.currentTime = element.posterFrameSeconds ?? getTrimStart();
      }}
      onTimeUpdate={(event) => {
        enforceTrimWindow(event.currentTarget);
      }}
    />
  );
}

export function CanvasMediaElement({
  animationState,
  assetName,
  assetUrl,
  element,
  interactive,
  opacity,
  previewMode,
  scale,
}: {
  animationState: ElementAnimationRenderState;
  assetName: string;
  assetUrl: string | undefined;
  element: GifElement | VideoElement;
  interactive: boolean;
  opacity: number;
  previewMode: boolean;
  scale: { x: number; y: number };
}) {
  if (element.type === 'gif') {
    const shouldPlayGif =
      element.playing &&
      (!previewMode || !animationState.hidden || Boolean(animationState.activeBuild));
    const gifPlaybackKey = animationState.activeBuild
      ? `${element.id}-${animationState.playbackRunId ?? 'static'}-${animationState.activeBuild.id}`
      : `${element.id}-${animationState.playbackRunId ?? 'static'}-${shouldPlayGif ? 'playing' : 'hidden'}`;
    return (
      <img
        aria-label={assetName}
        className="canvas-media-element"
        key={gifPlaybackKey}
        src={shouldPlayGif ? assetUrl : undefined}
        style={getMediaStyle(element, scale, interactive, opacity)}
      />
    );
  }

  return (
    <CanvasVideoElement
      assetName={assetName}
      assetUrl={assetUrl}
      element={element}
      animationState={animationState}
      interactive={interactive}
      opacity={opacity}
      previewMode={previewMode}
      scale={scale}
    />
  );
}
