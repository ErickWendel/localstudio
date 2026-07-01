import { useEffect, useState } from 'react';
import type { DesignElement, ShapeElement } from '../../../domain/model';

function isDesignElement(element: DesignElement | undefined): element is DesignElement {
  return Boolean(element);
}

function getElementLabel(element: DesignElement | undefined) {
  if (!element) return 'Element';
  if (element.type === 'text') return element.text.trim().split('\n')[0] || 'Text';
  if (element.type === 'image') return 'Image';
  if (element.type === 'gif') return 'GIF';
  if (element.type === 'video') return 'Video';
  return element.shape === 'ellipse' ? 'Ellipse' : 'Rectangle';
}

function useCanvasImage(src: string | undefined) {
  const [loadedImage, setLoadedImage] = useState<{
    src: string;
    image: HTMLImageElement;
  } | null>(null);

  useEffect(() => {
    if (!src) return;

    const nextImage = new window.Image();
    let isActive = true;
    nextImage.addEventListener('load', () => {
      if (isActive) setLoadedImage({ src, image: nextImage });
    });
    nextImage.src = src;

    return () => {
      isActive = false;
    };
  }, [src]);

  return loadedImage && loadedImage.src === src ? loadedImage.image : undefined;
}

function getPolygonPoints(shape: ShapeElement['shape'], width: number, height: number) {
  if (shape === 'triangle') return [width / 2, 0, width, height, 0, height];
  if (shape === 'diamond') return [width / 2, 0, width, height / 2, width / 2, height, 0, height / 2];
  if (shape === 'parallelogram') return [width * 0.24, 0, width, 0, width * 0.76, height, 0, height];
  if (shape === 'pentagon') {
    return Array.from({ length: 5 }).flatMap((_, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / 5;
      return [width / 2 + Math.cos(angle) * (width / 2), height / 2 + Math.sin(angle) * (height / 2)];
    });
  }
  return [];
}

function getShapePaint(element: ShapeElement) {
  const strokeWidth = element.stroke && (element.strokeWidth ?? 0) > 0 ? (element.strokeWidth ?? 0) : 0;
  return {
    ...(element.fill ? { fill: element.fill } : {}),
    ...(element.stroke && strokeWidth > 0 ? { stroke: element.stroke, strokeWidth } : {}),
  };
}

export const canvasWorkspaceUtils = {
  isDesignElement,
  getElementLabel,
  useCanvasImage,
  getPolygonPoints,
  getShapePaint,
};
