import type Konva from 'konva';
import { Circle, Group, Line, Rect } from 'react-konva';
import type { ShapeElement, ShapeLineEndpoint } from '../../../domain/documents/model';
import type { CommonElementProps } from './canvas-element-props';
import { shapeLineDraw } from './shape-line-draw';

type LineDrawState = {
  direction: Parameters<typeof shapeLineDraw.getPoints>[2];
  progress: number;
};

function getShapeEndpoint(element: ShapeElement, position: 'end' | 'start') {
  if (position === 'end' && element.shape === 'arrow') return element.endEndpoint ?? 'arrow';
  return (position === 'start' ? element.startEndpoint : element.endEndpoint) ?? 'none';
}

function getEndpointStrokeWidth(element: ShapeElement) {
  return Math.max(1, element.strokeWidth ?? 4);
}

function getEndpointColor(element: ShapeElement) {
  return element.stroke ?? element.fill ?? '#37FD76';
}

function getEndpointAngle(start: { x: number; y: number }, end: { x: number; y: number }) {
  return Math.atan2(end.y - start.y, end.x - start.x);
}

function EndpointMarker({
  angle,
  color,
  endpoint,
  point,
  strokeWidth,
}: {
  angle: number;
  color: string;
  endpoint: ShapeLineEndpoint;
  point: { x: number; y: number };
  strokeWidth: number;
}) {
  if (endpoint === 'none') return null;

  const size = Math.max(12, strokeWidth * 3.2);
  const unitX = Math.cos(angle);
  const unitY = Math.sin(angle);
  const perpendicularX = -unitY;
  const perpendicularY = unitX;
  const back = {
    x: point.x - unitX * size,
    y: point.y - unitY * size,
  };
  const sideA = {
    x: back.x + perpendicularX * size * 0.42,
    y: back.y + perpendicularY * size * 0.42,
  };
  const sideB = {
    x: back.x - perpendicularX * size * 0.42,
    y: back.y - perpendicularY * size * 0.42,
  };

  if (endpoint === 'arrow') {
    return (
      <Line
        closed
        fill={color}
        listening={false}
        points={[point.x, point.y, sideA.x, sideA.y, sideB.x, sideB.y]}
      />
    );
  }

  if (endpoint === 'open-arrow') {
    return (
      <Line
        listening={false}
        points={[sideA.x, sideA.y, point.x, point.y, sideB.x, sideB.y]}
        stroke={color}
        strokeWidth={strokeWidth}
      />
    );
  }

  if (endpoint === 'circle' || endpoint === 'open-circle') {
    return (
      <Circle
        {...(endpoint === 'circle' ? { fill: color } : {})}
        listening={false}
        radius={size * 0.42}
        stroke={color}
        strokeWidth={endpoint === 'open-circle' ? Math.max(1, strokeWidth * 0.72) : 0}
        x={point.x}
        y={point.y}
      />
    );
  }

  if (endpoint === 'square' || endpoint === 'open-square') {
    return (
      <Rect
        {...(endpoint === 'square' ? { fill: color } : {})}
        height={size * 0.74}
        listening={false}
        offsetX={(size * 0.74) / 2}
        offsetY={(size * 0.74) / 2}
        rotation={(angle * 180) / Math.PI}
        stroke={color}
        strokeWidth={endpoint === 'open-square' ? Math.max(1, strokeWidth * 0.72) : 0}
        width={size * 0.74}
        x={point.x}
        y={point.y}
      />
    );
  }

  if (endpoint === 'diamond') {
    return (
      <Line
        closed
        fill={color}
        listening={false}
        points={[
          point.x + unitX * size * 0.54,
          point.y + unitY * size * 0.54,
          point.x + perpendicularX * size * 0.42,
          point.y + perpendicularY * size * 0.42,
          point.x - unitX * size * 0.54,
          point.y - unitY * size * 0.54,
          point.x - perpendicularX * size * 0.42,
          point.y - perpendicularY * size * 0.42,
        ]}
      />
    );
  }

  return (
    <Line
      listening={false}
      points={[
        point.x + perpendicularX * size * 0.48,
        point.y + perpendicularY * size * 0.48,
        point.x - perpendicularX * size * 0.48,
        point.y - perpendicularY * size * 0.48,
      ]}
      stroke={color}
      strokeWidth={strokeWidth}
    />
  );
}

export function LinearShapeElement({
  commonProps,
  element,
  lineDrawState,
  nodeRef,
}: {
  commonProps: CommonElementProps;
  element: ShapeElement;
  lineDrawState: LineDrawState;
  nodeRef: (node: Konva.Node | null) => void;
}) {
  const stroke = getEndpointColor(element);
  const strokeWidth = getEndpointStrokeWidth(element);
  const fullPoints =
    element.shape === 'arc'
      ? [
          0,
          commonProps.height,
          commonProps.width * 0.12,
          0,
          commonProps.width * 0.88,
          0,
          commonProps.width,
          commonProps.height,
        ]
      : element.shape === 'line'
        ? [0, commonProps.height, commonProps.width, 0]
        : [0, commonProps.height / 2, commonProps.width, commonProps.height / 2];
  const points =
    lineDrawState.direction && element.shape !== 'arc'
      ? shapeLineDraw.getPoints(fullPoints, lineDrawState.progress, lineDrawState.direction)
      : fullPoints;
  const startPoint = { x: points[0] ?? 0, y: points[1] ?? 0 };
  const endPoint = {
    x: points[points.length - 2] ?? startPoint.x,
    y: points[points.length - 1] ?? startPoint.y,
  };
  const fullStartPoint = { x: fullPoints[0] ?? 0, y: fullPoints[1] ?? 0 };
  const fullEndPoint = {
    x: fullPoints[fullPoints.length - 2] ?? fullStartPoint.x,
    y: fullPoints[fullPoints.length - 1] ?? fullStartPoint.y,
  };
  const startAngle = getEndpointAngle(fullEndPoint, fullStartPoint);
  const endAngle = getEndpointAngle(fullStartPoint, fullEndPoint);

  return (
    <Group {...commonProps} key={element.id} ref={nodeRef}>
      <Line
        bezier={element.shape === 'arc'}
        points={points}
        {...(lineDrawState.direction && element.shape === 'arc'
          ? shapeLineDraw.getDash(
              commonProps.width * 2 + commonProps.height,
              lineDrawState.progress,
              lineDrawState.direction,
            )
          : {})}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <EndpointMarker
        angle={startAngle}
        color={stroke}
        endpoint={getShapeEndpoint(element, 'start')}
        point={startPoint}
        strokeWidth={strokeWidth}
      />
      <EndpointMarker
        angle={endAngle}
        color={stroke}
        endpoint={getShapeEndpoint(element, 'end')}
        point={endPoint}
        strokeWidth={strokeWidth}
      />
    </Group>
  );
}
