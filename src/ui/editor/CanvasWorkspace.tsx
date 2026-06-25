import { useEffect, useRef, useState, type RefObject } from 'react';
import type Konva from 'konva';
import { Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from 'react-konva';
import type { ElementFramePatch } from '../../domain/commands/basicCommands';
import type { DesignElement, ProjectDocument, SelectionState } from '../../domain/model';
import { getNormalizedElementPoint } from './backgroundSelection';
import { FloatingSelectionToolbar } from './FloatingSelectionToolbar';

interface CanvasWorkspaceProps {
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  stageRef?: RefObject<Konva.Stage | null>;
  zoomPercent?: number;
  backgroundSelectionMode?: boolean;
  onAlignSelectedElement?: () => void;
  onBringSelectedElementForward?: () => void;
  onBackgroundSelectionToggle?: () => void;
  onBackgroundSubjectPick?: (elementId: string, point: { x: number; y: number }) => void;
  onCancelBackgroundSelection?: () => void;
  onDeleteSelectedElement?: () => void;
  onDuplicateSelectedElement?: () => void;
  onSelectElement?: (elementId: string) => void;
  onSendSelectedElementBackward?: () => void;
  onUpdateElementFrame?: (elementId: string, patch: ElementFramePatch) => void;
  onUpdateTextContent?: (elementId: string, text: string) => void;
}

interface CommonElementProps {
  draggable: boolean;
  height: number;
  opacity: number;
  ref: (node: Konva.Node | null) => void;
  rotation: number;
  width: number;
  x: number;
  y: number;
  onClick: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  onDblClick: () => void;
  onDblTap: () => void;
  onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onMouseEnter: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  onMouseLeave: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  onTap: () => void;
  onTransformEnd: (event: Konva.KonvaEventObject<Event>) => void;
}

function isDesignElement(element: DesignElement | undefined): element is DesignElement {
  return Boolean(element);
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

export function CanvasWorkspace({
  project,
  activePageId,
  selection,
  stageRef,
  zoomPercent = 100,
  backgroundSelectionMode = false,
  onAlignSelectedElement,
  onBackgroundSelectionToggle,
  onBackgroundSubjectPick,
  onBringSelectedElementForward,
  onCancelBackgroundSelection,
  onDeleteSelectedElement,
  onDuplicateSelectedElement,
  onSelectElement,
  onSendSelectedElementBackward,
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
  const visibleElements =
    page?.elementIds
      .map((id) => project.elements[id])
      .filter(isDesignElement)
      .filter((element) => element.visible !== false) ?? [];
  const hasSelection = selection.elementIds.length > 0;
  const selectedElement = project.elements[selection.elementIds[0] ?? ''];
  const backgroundSelectionTargetId =
    backgroundSelectionMode && selectedElement?.type === 'image' ? selectedElement.id : undefined;
  const stageWidth = stageSize.width;
  const stageHeight = stageSize.height;
  const scaleX = page ? stageWidth / page.width : 1;
  const scaleY = page ? stageHeight / page.height : 1;
  const pageBackground =
    page?.background.type === 'color'
      ? page.background.color
      : page?.background.colorFallback ?? '#050D10';

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

  function pickBackgroundSubject(element: DesignElement, event: Konva.KonvaEventObject<MouseEvent>) {
    if (element.id !== backgroundSelectionTargetId || element.type !== 'image') return;
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    onBackgroundSubjectPick?.(
      element.id,
      getNormalizedElementPoint({
        element,
        pointer,
        scale: { x: scaleX, y: scaleY },
      }),
    );
  }

  function getCommonElementProps(element: DesignElement): CommonElementProps {
    const isBackgroundSelectionTarget = element.id === backgroundSelectionTargetId;

    return {
      draggable: !element.locked && !backgroundSelectionMode,
      height: element.height * scaleY,
      opacity: element.opacity,
      ref: (node: Konva.Node | null) => {
        nodeRefs.current[element.id] = node;
      },
      rotation: element.rotation,
      width: element.width * scaleX,
      x: element.x * scaleX,
      y: element.y * scaleY,
      onClick: (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (backgroundSelectionMode) {
          pickBackgroundSubject(element, event);
          return;
        }
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
      onMouseEnter: (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (!isBackgroundSelectionTarget) return;
        const container = event.target.getStage()?.container();
        if (container) container.style.cursor = 'pointer';
      },
      onMouseLeave: (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (!isBackgroundSelectionTarget) return;
        const container = event.target.getStage()?.container();
        if (container) container.style.cursor = '';
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
        {...(backgroundSelectionTargetId
          ? { 'data-background-selection-target': backgroundSelectionTargetId }
          : {})}
        data-selected-elements={selection.elementIds.join(',')}
        style={{
          transform: `scale(${zoomPercent / 100})`,
        }}
      >
        <div className="canvas-artboard" ref={artboardRef} style={{ background: pageBackground }}>
          {backgroundSelectionMode ? (
            <div className="background-selection-hint" role="status">
              <span className="material-symbols-outlined" aria-hidden="true">
                ads_click
              </span>
              <span>Click the main object to keep. Everything else will be removed.</span>
              <button type="button" onClick={onCancelBackgroundSelection}>
                Esc
              </button>
            </div>
          ) : null}
          <Stage ref={stageRef} height={stageHeight} width={stageWidth}>
            <Layer>
              <Rect fill={pageBackground} height={stageHeight} listening={false} width={stageWidth} x={0} y={0} />
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
                  const asset = project.assets[element.assetId];
                  return (
                    <CanvasImageElement
                      key={element.id}
                      assetUrl={asset?.objectUrl}
                      commonProps={commonProps}
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
                    lineHeight={0.9}
                    visible={editingTextId !== element.id}
                  />
                );
              })}
              {backgroundSelectionTargetId && selectedElement?.type === 'image' ? (
                <Rect
                  dash={[8, 5]}
                  height={selectedElement.height * scaleY}
                  listening={false}
                  opacity={1}
                  rotation={selectedElement.rotation}
                  shadowBlur={18}
                  shadowColor="#37FD76"
                  stroke="#37FD76"
                  strokeWidth={2}
                  width={selectedElement.width * scaleX}
                  x={selectedElement.x * scaleX}
                  y={selectedElement.y * scaleY}
                />
              ) : null}
              <Transformer
                ref={transformerRef}
                anchorFill="#37FD76"
                anchorSize={8}
                anchorStroke="#0C160D"
                borderDash={[6, 4]}
                borderStroke="#37FD76"
                ignoreStroke
                resizeEnabled={!selectedElement?.locked}
                rotateEnabled={!selectedElement?.locked}
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
        {hasSelection ? (
          <FloatingSelectionToolbar
            onAlignCenter={onAlignSelectedElement}
            onBringForward={onBringSelectedElementForward}
            onDelete={onDeleteSelectedElement}
            onDuplicate={onDuplicateSelectedElement}
            onBackgroundSelectionToggle={onBackgroundSelectionToggle}
            onSendBackward={onSendSelectedElementBackward}
            backgroundSelectionActive={backgroundSelectionMode}
          />
        ) : null}
      </div>
    </div>
  );
}

interface CanvasImageElementProps {
  assetUrl: string | undefined;
  commonProps: CommonElementProps;
}

function CanvasImageElement({ assetUrl, commonProps }: CanvasImageElementProps) {
  const image = useCanvasImage(assetUrl);

  if (!image) {
    return (
      <Rect
        {...commonProps}
        fill="#101B1D"
        stroke="#37FD76"
        strokeWidth={1}
        cornerRadius={6}
      />
    );
  }

  return <KonvaImage {...commonProps} image={image} cornerRadius={6} />;
}
