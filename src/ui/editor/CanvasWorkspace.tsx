import { useEffect, useRef, useState } from 'react';
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
  onUpdateTextContent?: (elementId: string, text: string) => void;
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
  onUpdateTextContent,
}: CanvasWorkspaceProps) {
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  const artboardRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const [stageSize, setStageSize] = useState({ width: 768, height: 432 });
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
  const visibleElements = page?.elementIds.map((id) => project.elements[id]).filter(isDesignElement) ?? [];
  const hasSelection = selection.elementIds.length > 0;
  const stageWidth = stageSize.width;
  const stageHeight = stageSize.height;
  const scaleX = page ? stageWidth / page.width : 1;
  const scaleY = page ? stageHeight / page.height : 1;

  useEffect(() => {
    const selectedNode = nodeRefs.current[selection.elementIds[0] ?? ''];
    transformerRef.current?.nodes(selectedNode ? [selectedNode] : []);
    transformerRef.current?.getLayer()?.batchDraw();
  }, [selection.elementIds, project]);

  useEffect(() => {
    const artboard = artboardRef.current;
    if (!artboard) return;

    function updateStageSize() {
      if (!artboard) return;
      const nextWidth = artboard.clientWidth;
      const nextHeight = artboard.clientHeight;
      if (!nextWidth || !nextHeight) return;
      setStageSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight },
      );
    }

    updateStageSize();
    const observer = new ResizeObserver(updateStageSize);
    observer.observe(artboard);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!editingTextId) return;
    textInputRef.current?.focus();
    textInputRef.current?.select();
  }, [editingTextId]);

  function toDocumentX(value: number) {
    return value / scaleX;
  }

  function toDocumentY(value: number) {
    return value / scaleY;
  }

  function handleDragEnd(elementId: string, event: Konva.KonvaEventObject<DragEvent>) {
    onUpdateElementFrame?.(elementId, {
      x: toDocumentX(event.target.x()),
      y: toDocumentY(event.target.y()),
    });
  }

  function handleTransformEnd(elementId: string, event: Konva.KonvaEventObject<Event>) {
    const node = event.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    onUpdateElementFrame?.(elementId, {
      x: toDocumentX(node.x()),
      y: toDocumentY(node.y()),
      width: toDocumentX(Math.max(8, node.width() * scaleX)),
      height: toDocumentY(Math.max(8, node.height() * scaleY)),
      rotation: node.rotation(),
    });
  }

  function startTextEditing(element: DesignElement) {
    if (element.type !== 'text') return;
    onSelectElement?.(element.id);
    setEditingTextId(element.id);
    setEditingTextValue(element.text);
  }

  function commitTextEditing() {
    if (!editingTextId) return;
    onUpdateTextContent?.(editingTextId, editingTextValue);
    setEditingTextId(null);
  }

  function cancelTextEditing() {
    setEditingTextId(null);
    setEditingTextValue('');
  }

  function getCommonElementProps(element: DesignElement) {
    return {
      draggable: !element.locked,
      height: element.height * scaleY,
      opacity: element.opacity,
      ref: (node: Konva.Node | null) => {
        nodeRefs.current[element.id] = node;
      },
      rotation: element.rotation,
      width: element.width * scaleX,
      x: element.x * scaleX,
      y: element.y * scaleY,
      onClick: () => {
        onSelectElement?.(element.id);
      },
      onDblClick: () => {
        startTextEditing(element);
      },
      onDblTap: () => {
        startTextEditing(element);
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
      <div
        className="canvas-frame neon-border"
        aria-label="Slide canvas"
        data-selected-elements={selection.elementIds.join(',')}
      >
        <div className="canvas-artboard" ref={artboardRef}>
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
                    fontSize={element.fontSize * scaleY}
                    fontStyle={element.fontWeight >= 700 ? 'bold' : 'normal'}
                    fill={element.fill}
                    align={element.align}
                    visible={editingTextId !== element.id}
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
                ignoreStroke
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
                boundBoxFunc={(oldBox, newBox) =>
                  newBox.width < 8 || newBox.height < 8 ? oldBox : newBox
                }
                rotateAnchorOffset={28}
              />
            </Layer>
          </Stage>
          {visibleElements.map((element) => {
            if (element.type !== 'text' || editingTextId !== element.id) return null;

            return (
              <textarea
                aria-label="Edit text"
                className="canvas-text-editor"
                key={element.id}
                ref={textInputRef}
                value={editingTextValue}
                style={{
                  color: element.fill,
                  fontFamily: element.fontFamily,
                  fontSize: `${element.fontSize * scaleY}px`,
                  fontWeight: element.fontWeight,
                  height: `${element.height * scaleY}px`,
                  left: `${element.x * scaleX}px`,
                  textAlign: element.align,
                  top: `${element.y * scaleY}px`,
                  transform: `rotate(${element.rotation}deg)`,
                  width: `${element.width * scaleX}px`,
                }}
                onBlur={commitTextEditing}
                onChange={(event) => {
                  setEditingTextValue(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelTextEditing();
                  }
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    commitTextEditing();
                  }
                }}
              />
            );
          })}
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
