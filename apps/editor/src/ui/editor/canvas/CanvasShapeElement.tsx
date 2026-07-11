import type Konva from 'konva';
import { Line, Rect } from 'react-konva';
import type { ShapeElement } from '../../../domain/documents/model';
import type { CommonElementProps } from './canvas-element-props';
import { canvasWorkspaceUtils } from './canvasWorkspaceUtils';
import { LinearShapeElement } from './LinearShapeElement';
import { shapeLineDraw } from './shape-line-draw';

interface CanvasShapeElementProps {
  commonProps: CommonElementProps;
  element: ShapeElement;
  lineDrawState: ReturnType<typeof shapeLineDraw.getState>;
  nodeRef: (node: Konva.Node | null) => void;
}

export function CanvasShapeElement({
  commonProps,
  element,
  lineDrawState,
  nodeRef,
}: CanvasShapeElementProps) {
  const paint = canvasWorkspaceUtils.getShapePaint(element);
  const lineDrawProps = lineDrawState.direction
    ? shapeLineDraw.getDash(
        shapeLineDraw.getPerimeter(commonProps.width, commonProps.height),
        lineDrawState.progress,
        lineDrawState.direction,
      )
    : {};

  if (element.shape === 'ellipse') {
    return (
      <Rect
        {...commonProps}
        {...paint}
        {...lineDrawProps}
        key={element.id}
        cornerRadius={Math.min(commonProps.width, commonProps.height) / 2}
        ref={nodeRef}
      />
    );
  }

  if (element.shape === 'rounded-rect') {
    return (
      <Rect
        {...commonProps}
        {...paint}
        {...lineDrawProps}
        key={element.id}
        cornerRadius={Math.min(commonProps.width, commonProps.height) * 0.18}
        ref={nodeRef}
      />
    );
  }

  if (element.shape === 'line' || element.shape === 'arrow' || element.shape === 'arc') {
    return (
      <LinearShapeElement
        commonProps={commonProps}
        element={element}
        key={element.id}
        lineDrawState={lineDrawState}
        nodeRef={nodeRef}
      />
    );
  }

  if (
    element.shape === 'triangle' ||
    element.shape === 'pentagon' ||
    element.shape === 'diamond' ||
    element.shape === 'parallelogram'
  ) {
    return (
      <Line
        {...commonProps}
        {...paint}
        {...lineDrawProps}
        closed
        key={element.id}
        points={canvasWorkspaceUtils.getPolygonPoints(
          element.shape,
          commonProps.width,
          commonProps.height,
        )}
        ref={nodeRef}
      />
    );
  }

  return <Rect {...commonProps} {...paint} {...lineDrawProps} key={element.id} ref={nodeRef} />;
}
