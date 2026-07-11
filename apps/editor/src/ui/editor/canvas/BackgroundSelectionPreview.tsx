import { Circle, Image as KonvaImage } from 'react-konva';
import type { DesignElement } from '../../../domain/documents/model';
import { canvasWorkspaceUtils } from './canvasWorkspaceUtils';

export function BackgroundSelectionPreview({
  element,
  maskUrl,
  pending = false,
  point,
  scale,
}: {
  element: DesignElement;
  maskUrl: string | undefined;
  pending?: boolean;
  point: { x: number; y: number } | null;
  scale: { x: number; y: number };
}) {
  const maskImage = canvasWorkspaceUtils.useCanvasImage(maskUrl);
  const x = element.x * scale.x;
  const y = element.y * scale.y;
  const width = element.width * scale.x;
  const height = element.height * scale.y;

  return (
    <>
      {maskImage ? (
        <KonvaImage
          listening={false}
          image={maskImage}
          opacity={pending ? 0.62 : 1}
          rotation={element.rotation}
          width={width}
          height={height}
          x={x}
          y={y}
        />
      ) : null}
      {point ? (
        <Circle
          listening={false}
          radius={7}
          shadowBlur={14}
          shadowColor="#37FD76"
          fill="#37FD76"
          stroke="#001B0A"
          strokeWidth={2}
          x={point.x}
          y={point.y}
        />
      ) : null}
    </>
  );
}
