import type Konva from 'konva';
import { Group, Image as KonvaImage, Rect } from 'react-konva';
import { placeholderImage } from '../../../domain/assets/placeholderImage';
import type { DesignElement, VectorPathCommand } from '../../../domain/documents/model';
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

  if (element.assetId === placeholderImage.PLACEHOLDER_IMAGE_ASSET_ID) {
    const placeholderFrame = fitPlaceholderVisualFrame({
      height: commonProps.height,
      imageHeight: image.naturalHeight,
      imageWidth: image.naturalWidth,
      width: commonProps.width,
    });
    return (
      <>
        <Rect {...imageProps} fill="#F4F4F5" cornerRadius={6} ref={nodeRef} />
        <KonvaImage
          image={image}
          x={commonProps.x + placeholderFrame.x}
          y={commonProps.y + placeholderFrame.y}
          width={placeholderFrame.width}
          height={placeholderFrame.height}
          opacity={0.36}
          listening={false}
        />
      </>
    );
  }

  if (element.clipPath || element.mask === 'ellipse') {
    return (
      <Group
        {...imageProps}
        clipFunc={(context) => {
          clipImage(context, imageProps.width, imageProps.height, element.clipPath);
        }}
        ref={nodeRef}
      >
        <KonvaImage
          image={image}
          {...(crop ? { crop } : {})}
          height={imageProps.height}
          listening={false}
          width={imageProps.width}
        />
      </Group>
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

function clipImage(
  context: Pick<
    CanvasRenderingContext2D,
    'beginPath' | 'bezierCurveTo' | 'closePath' | 'ellipse' | 'lineTo' | 'moveTo'
  >,
  width: number,
  height: number,
  clipPath: VectorPathCommand[] | undefined,
) {
  context.beginPath();
  if (!clipPath) {
    context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    context.closePath();
    return;
  }
  for (const command of clipPath) {
    if (command.type === 'move') context.moveTo((command.x ?? 0) * width, (command.y ?? 0) * height);
    if (command.type === 'line') context.lineTo((command.x ?? 0) * width, (command.y ?? 0) * height);
    if (command.type === 'cubic') {
      context.bezierCurveTo(
        (command.cx1 ?? 0) * width,
        (command.cy1 ?? 0) * height,
        (command.cx2 ?? 0) * width,
        (command.cy2 ?? 0) * height,
        (command.x ?? 0) * width,
        (command.y ?? 0) * height,
      );
    }
    if (command.type === 'close') context.closePath();
  }
  context.closePath();
}

function fitPlaceholderVisualFrame(input: {
  height: number;
  imageHeight: number;
  imageWidth: number;
  width: number;
}) {
  const imageAspectRatio =
    input.imageWidth > 0 && input.imageHeight > 0 ? input.imageWidth / input.imageHeight : 1;
  const maxWidth = Math.max(1, input.width * 0.46);
  const maxHeight = Math.max(1, input.height * 0.46);
  const width = Math.min(maxWidth, maxHeight * imageAspectRatio);
  const height = width / imageAspectRatio;
  return {
    height,
    width,
    x: (input.width - width) / 2,
    y: (input.height - height) / 2,
  };
}
