import { useCallback, useEffect, useRef } from 'react';
import type Konva from 'konva';
import { Image as KonvaImage } from 'react-konva';
import type { CommonElementProps } from './canvas-element-props';

export function CanvasMediaNode({
  commonProps,
  media,
  nodeRef,
  redrawContinuously,
}: {
  commonProps: CommonElementProps;
  media: HTMLImageElement | HTMLVideoElement;
  nodeRef: (node: Konva.Node | null) => void;
  redrawContinuously: boolean;
}) {
  const imageRef = useRef<Konva.Image>(null);
  const setImageRef = useCallback(
    (node: Konva.Image | null) => {
      imageRef.current = node;
      nodeRef(node);
    },
    [nodeRef],
  );

  useEffect(() => {
    let animationFrameId: number | undefined;
    const redraw = () => imageRef.current?.getLayer()?.batchDraw();
    const redrawFrame = () => {
      redraw();
      animationFrameId = window.requestAnimationFrame(redrawFrame);
    };
    const startRedraw = () => {
      if (animationFrameId !== undefined) return;
      animationFrameId = window.requestAnimationFrame(redrawFrame);
    };
    const stopRedraw = () => {
      if (animationFrameId === undefined) return;
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = undefined;
    };

    redraw();
    if (media instanceof HTMLVideoElement) {
      media.addEventListener('loadeddata', redraw);
      media.addEventListener('seeked', redraw);
      media.addEventListener('timeupdate', redraw);
      media.addEventListener('play', startRedraw);
      media.addEventListener('pause', stopRedraw);
      media.addEventListener('ended', stopRedraw);
      if (!media.paused) startRedraw();
    } else if (redrawContinuously) {
      startRedraw();
    }

    return () => {
      stopRedraw();
      if (!(media instanceof HTMLVideoElement)) return;
      media.removeEventListener('loadeddata', redraw);
      media.removeEventListener('seeked', redraw);
      media.removeEventListener('timeupdate', redraw);
      media.removeEventListener('play', startRedraw);
      media.removeEventListener('pause', stopRedraw);
      media.removeEventListener('ended', stopRedraw);
    };
  }, [media, redrawContinuously]);

  return <KonvaImage {...commonProps} image={media} ref={setImageRef} />;
}
