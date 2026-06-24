import { useEffect, useRef } from 'react';
import type Konva from 'konva';
import { Layer, Rect, Stage, Text, Transformer } from 'react-konva';
import type { ElementFramePatch } from '../../domain/commands/basicCommands';
import type { DesignElement, ProjectDocument, SelectionState } from '../../domain/model';
import { FloatingSelectionToolbar } from './FloatingSelectionToolbar';

interface CanvasWorkspaceProps {
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  onSelectElement?: (elementId: string) => void;
  onUpdateElementFrame?: (elementId: string, patch: ElementFramePatch) => void;
}

function isDesignElement(element: DesignElement | undefined): element is DesignElement {
  return Boolean(element);
}

export function CanvasWorkspace({
  project,
  activePageId,
  selection,
  onSelectElement,
  onUpdateElementFrame,
}: CanvasWorkspaceProps) {
  const transformerRef = useRef<Konva.Transformer>(null);
  const selectedNodeRef = useRef<Konva.Node | null>(null);
  const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
  const visibleElements = page?.elementIds.map((id) => project.elements[id]).filter(isDesignElement) ?? [];
  const hasSelection = selection.elementIds.length > 0;
  const stageWidth = 768;
  const stageHeight = 432;
  const scale = page ? stageWidth / page.width : 1;

  useEffect(() => {
    transformerRef.current?.nodes(selectedNodeRef.current ? [selectedNodeRef.current] : []);
    transformerRef.current?.getLayer()?.batchDraw();
  }, [selection.elementIds, project]);

  function toStageValue(value: number) {
    return value / scale;
  }

  function handleDragEnd(elementId: string, event: Konva.KonvaEventObject<DragEvent>) {
    onUpdateElementFrame?.(elementId, {
      x: toStageValue(event.target.x()),
      y: toStageValue(event.target.y()),
    });
  }

  function handleTransformEnd(elementId: string, event: Konva.KonvaEventObject<Event>) {
    const node = event.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    onUpdateElementFrame?.(elementId, {
      x: toStageValue(node.x()),
      y: toStageValue(node.y()),
      width: toStageValue(Math.max(8, node.width() * scaleX)),
      height: toStageValue(Math.max(8, node.height() * scaleY)),
      rotation: node.rotation(),
    });
  }

  function getCommonElementProps(element: DesignElement) {
    const isSelected = selection.elementIds.includes(element.id);
    return {
      draggable: !element.locked,
      height: element.height * scale,
      opacity: element.opacity,
      ref: (node: Konva.Node | null) => {
        if (isSelected) selectedNodeRef.current = node;
      },
      rotation: element.rotation,
      width: element.width * scale,
      x: element.x * scale,
      y: element.y * scale,
      onClick: () => {
        onSelectElement?.(element.id);
      },
      onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
        handleDragEnd(element.id, event);
      },
      onTap: () => {
        onSelectElement?.(element.id);
      },
      onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
        handleTransformEnd(element.id, event);
      },
    };
  }

  return (
    <div className="canvas-workspace">
      <div className="canvas-frame neon-border" aria-label="Slide canvas" data-selected-elements={selection.elementIds.join(',')}>
        <div className="canvas-artboard" aria-hidden="true">
          <Stage height={stageHeight} width={stageWidth}>
            <Layer>
              {visibleElements.map((element) => {
                const commonProps = getCommonElementProps(element);

                if (element.type === 'shape') {
                  return (
                    <Rect
                      {...commonProps}
                      key={element.id}
                      fill={element.fill}
                    />
                  );
                }

                if (element.type === 'image') {
                  return (
                    <Rect
                      {...commonProps}
                      key={element.id}
                      fill="#101B1D"
                      stroke="#37FD76"
                      strokeWidth={1}
                      cornerRadius={6}
                    />
                  );
                }

                return (
                  <Text
                    {...commonProps}
                    key={element.id}
                    text={element.text}
                    fontFamily={element.fontFamily}
                    fontSize={element.fontSize * scale}
                    fontStyle={element.fontWeight >= 700 ? 'bold' : 'normal'}
                    fill={element.fill}
                    align={element.align}
                  />
                );
              })}
              <Transformer
                ref={transformerRef}
                anchorFill="#37FD76"
                anchorSize={8}
                anchorStroke="#0C160D"
                borderDash={[6, 4]}
                borderStroke="#37FD76"
                enabledAnchors={[
                  'top-left',
                  'top-center',
                  'top-right',
                  'middle-left',
                  'middle-right',
                  'bottom-left',
                  'bottom-center',
                  'bottom-right',
                ]}
                rotateAnchorOffset={28}
              />
            </Layer>
          </Stage>
          <span className="canvas-fallback-label">Selected Image</span>
        </div>
        <div className="canvas-accessible-text">
          {visibleElements.map((element) =>
            element.type === 'text' ? <span key={element.id}>{element.text}</span> : null,
          )}
        </div>
        <span className="canvas-size">
          {page?.width} x {page?.height}
        </span>
        {hasSelection ? <FloatingSelectionToolbar /> : null}
      </div>
    </div>
  );
}
