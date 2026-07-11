import type Konva from 'konva';
import { Image as KonvaImage, Rect } from 'react-konva';
import type { DesignElement } from '../../../domain/documents/model';
import { canvasWorkspaceUtils } from './canvasWorkspaceUtils';
import type { CommonElementProps } from './canvas-element-props';

export function CanvasImageElement({
  assetUrl,
  commonProps,
  element,
  nodeRef,
}: {
  assetUrl: string | undefined;
  commonProps: CommonElementProps;
  element: Extract<DesignElement, { type: 'image' }>;
  nodeRef: (node: Konva.Node | null) => void;
}) {
  const image = canvasWorkspaceUtils.useCanvasImage(assetUrl);
  const crop =
    element.crop && image
      ? {
          x: element.crop.x * image.naturalWidth,
          y: element.crop.y * image.naturalHeight,
          width: element.crop.width * image.naturalWidth,
          height: element.crop.height * image.naturalHeight,
        }
      : undefined;
  const imageProps = element.flipX
    ? {
        ...commonProps,
        scaleX: -1,
        x: commonProps.x + commonProps.width,
      }
    : commonProps;

  if (!image) {
    return (
      <Rect
        {...imageProps}
        fill="#101B1D"
        stroke="#37FD76"
        strokeWidth={1}
        cornerRadius={6}
        ref={nodeRef}
      />
    );
  }

  return (
    <KonvaImage
      {...imageProps}
      image={image}
      {...(crop ? { crop } : {})}
      cornerRadius={6}
      ref={nodeRef}
    />
  );
}
