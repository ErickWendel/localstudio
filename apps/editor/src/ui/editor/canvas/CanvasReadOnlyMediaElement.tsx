import type Konva from 'konva';
import { Group, Rect, Text } from 'react-konva';
import type { GifElement, VideoElement } from '../../../domain/documents/model';
import type { CommonElementProps } from './canvas-element-props';

interface CanvasReadOnlyMediaElementProps {
  commonProps: CommonElementProps;
  element: GifElement | VideoElement;
  label: string;
  nodeRef: (node: Konva.Node | null) => void;
}

export function CanvasReadOnlyMediaElement({
  commonProps,
  element,
  label,
  nodeRef,
}: CanvasReadOnlyMediaElementProps) {
  return (
    <Group {...commonProps} key={element.id} ref={nodeRef}>
      <Rect
        fill="#153A2D"
        height={commonProps.height}
        stroke="#37FD76"
        strokeWidth={Math.max(2, Math.min(commonProps.width, commonProps.height) * 0.006)}
        width={commonProps.width}
        x={0}
        y={0}
      />
      <Text
        align="center"
        fill="#FFFFFF"
        fontFamily="Open Sans"
        fontSize={Math.max(18, Math.min(48, commonProps.height * 0.12))}
        fontStyle="bold"
        height={commonProps.height}
        padding={Math.max(12, commonProps.height * 0.04)}
        text={label}
        verticalAlign="middle"
        width={commonProps.width}
        x={0}
        y={0}
      />
    </Group>
  );
}
