import { useEffect, useRef, useState, type RefObject } from 'react';
import type Konva from 'konva';
import { Circle, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import type { ElementFramePatch } from '../../domain/commands/basicCommands';
import type { DesignElement, ProjectDocument, SelectionState } from '../../domain/model';
import { getNormalizedElementPoint } from './backgroundSelection';
import { FloatingSelectionToolbar } from './FloatingSelectionToolbar';

const TEXT_FRAME_PADDING = 6;

interface CanvasWorkspaceProps {
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  stageRef?: RefObject<Konva.Stage | null>;
  zoomPercent?: number;
  backgroundSelectionMode?: boolean;
  backgroundSelectionNotice?: string | undefined;
  processingElementIds?: string[];
  backgroundPreview?: { elementId: string; maskUrl?: string; pending: boolean; score?: number } | undefined;
  backgroundPreparation?:
    | { elementId: string; progress: number; status: 'preparing' | 'ready' | 'failed' }
    | undefined;
  canTranslateCurrentSlide?: boolean;
  canTranslateSelection?: boolean;
  isTranslating?: boolean;
  translationNotice?: string | undefined;
  onAlignSelectedElement?: () => void;
  onBringSelectedElementForward?: () => void;
  onBackgroundPreviewPoint?: (elementId: string, point: { x: number; y: number }) => void;
  onBackgroundRefinePoint?: (elementId: string, point: { x: number; y: number }) => void;
  onBackgroundSelectionToggle?: () => void;
  onBackgroundSubjectPick?: (elementId: string, point: { x: number; y: number }) => void;
  onCancelBackgroundSelection?: () => void;
  onClearSelection?: () => void;
  onDeleteSelectedElement?: () => void;
  onDuplicateSelectedElement?: () => void;
  onInsertImage?: () => void;
  onInsertText?: () => void;
  onSelectElement?: (elementId: string, options?: { additive?: boolean }) => void;
  onSendSelectedElementBackward?: () => void;
  onTranslateCurrentSlide?: () => void;
  onTranslateSelectedText?: () => void;
  onUpdateElementFrame?: (elementId: string, patch: ElementFramePatch) => void;
  onUpdateElementFrames?: (patches: Record<string, ElementFramePatch>) => void;
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
  onContextMenu: (event: Konva.KonvaEventObject<PointerEvent>) => void;
  onDblClick: () => void;
  onDblTap: () => void;
  onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onMouseEnter: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  onMouseLeave: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  onMouseMove: (event: Konva.KonvaEventObject<MouseEvent>) => void;
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
  backgroundSelectionNotice,
  processingElementIds = [],
  backgroundPreview,
  backgroundPreparation,
  canTranslateCurrentSlide = false,
  canTranslateSelection = false,
  isTranslating = false,
  translationNotice,
  onAlignSelectedElement,
  onBackgroundPreviewPoint,
  onBackgroundRefinePoint,
  onBackgroundSelectionToggle,
  onBackgroundSubjectPick,
  onBringSelectedElementForward,
  onCancelBackgroundSelection,
  onClearSelection,
  onDeleteSelectedElement,
  onDuplicateSelectedElement,
  onInsertImage,
  onInsertText,
  onSelectElement,
  onSendSelectedElementBackward,
  onTranslateCurrentSlide,
  onTranslateSelectedText,
  onUpdateElementFrame,
  onUpdateElementFrames,
  onUpdateTextContent,
}: CanvasWorkspaceProps) {
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  const artboardRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const [stageSize, setStageSize] = useState({ width: 768, height: 432 });
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const [fontRenderVersion, setFontRenderVersion] = useState(0);
  const [processingBlinkOn, setProcessingBlinkOn] = useState(false);
  const [backgroundPreviewPoint, setBackgroundPreviewPoint] = useState<{ x: number; y: number } | null>(null);
  const [dragGuide, setDragGuide] = useState<{ x: number; y: number } | null>(null);
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
  const activeBackgroundPreparation =
    backgroundSelectionTargetId && backgroundPreparation?.elementId === backgroundSelectionTargetId
      ? backgroundPreparation
      : undefined;
  const backgroundSelectionReady =
    Boolean(backgroundSelectionTargetId) && activeBackgroundPreparation?.status === 'ready';
  const hasProcessingElements = processingElementIds.length > 0;
  const activeProcessingBlink = hasProcessingElements && processingBlinkOn;
  const processingSelectedImageId =
    selectedElement?.type === 'image' && processingElementIds.includes(selectedElement.id)
      ? selectedElement.id
      : undefined;
  const stageWidth = stageSize.width;
  const stageHeight = stageSize.height;
  const scaleX = page ? stageWidth / page.width : 1;
  const scaleY = page ? stageHeight / page.height : 1;
  const pageBackground =
    page?.background.type === 'color'
      ? page.background.color
      : page?.background.colorFallback ?? '#050D10';

  useEffect(() => {
    const selectedNodes = selection.elementIds
      .map((elementId) => nodeRefs.current[elementId])
      .filter((node): node is Konva.Node => Boolean(node));
    transformerRef.current?.nodes(selectedNodes);
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

  useEffect(() => {
    const fontSet = document.fonts;
    if (!fontSet) return;
    let isMounted = true;

    void Promise.all([
      fontSet.load('800 96px Orbitron'),
      fontSet.load('600 40px "Open Sans"'),
      fontSet.ready,
    ]).then(() => {
      if (!isMounted) return;
      setFontRenderVersion((currentVersion) => currentVersion + 1);
      stageRef?.current?.batchDraw();
    });

    return () => {
      isMounted = false;
    };
  }, [stageRef]);

  useEffect(() => {
    if (backgroundSelectionMode || hasProcessingElements) return;
    const stageContainer = stageRef?.current?.container();
    if (stageContainer) stageContainer.style.cursor = '';
  }, [backgroundSelectionMode, hasProcessingElements, stageRef]);

  useEffect(() => {
    if (!hasProcessingElements) return;

    const intervalId = window.setInterval(() => {
      setProcessingBlinkOn((current) => !current);
    }, 420);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasProcessingElements]);

  function toDocumentX(value: number) {
    return value / scaleX;
  }

  function toDocumentY(value: number) {
    return value / scaleY;
  }

  function handleDragEnd(elementId: string, event: Konva.KonvaEventObject<DragEvent>) {
    setDragGuide(null);
    const element = project.elements[elementId];
    if (!element) return;
    const nextX = toDocumentX(event.target.x());
    const nextY = toDocumentY(event.target.y());
    const deltaX = nextX - element.x;
    const deltaY = nextY - element.y;
    const selectedMovableElementIds = selection.elementIds.filter((selectedElementId) => {
      const selected = project.elements[selectedElementId];
      return selected && !selected.locked;
    });

    if (selectedMovableElementIds.length > 1 && selection.elementIds.includes(elementId)) {
      onUpdateElementFrames?.(
        Object.fromEntries(
          selectedMovableElementIds.map((selectedElementId) => {
            const selected = project.elements[selectedElementId]!;
            return [
              selectedElementId,
              {
                x: selected.x + deltaX,
                y: selected.y + deltaY,
              },
            ];
          }),
        ),
      );
      return;
    }

    onUpdateElementFrame?.(elementId, { x: nextX, y: nextY });
  }

  function handleDragMove(event: Konva.KonvaEventObject<DragEvent>) {
    const node = event.target;
    const rect = node.getClientRect({ skipShadow: true, skipStroke: true });
    setDragGuide({
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
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
    if (!backgroundSelectionReady) return;
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const normalizedPoint = getNormalizedElementPoint({
      element,
      pointer,
      scale: { x: scaleX, y: scaleY },
    });

    if (event.evt.button === 2) {
      event.evt.preventDefault();
      onBackgroundRefinePoint?.(element.id, normalizedPoint);
      return;
    }

    onBackgroundSubjectPick?.(element.id, normalizedPoint);
  }

  function getBackgroundPreviewPoint(element: DesignElement, event: Konva.KonvaEventObject<MouseEvent>) {
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return null;
    const normalizedPoint = getNormalizedElementPoint({
      element,
      pointer,
      scale: { x: scaleX, y: scaleY },
    });
    return {
      x: element.x * scaleX + normalizedPoint.x * element.width * scaleX,
      y: element.y * scaleY + normalizedPoint.y * element.height * scaleY,
    };
  }

  function getCommonElementProps(element: DesignElement): CommonElementProps {
    const isBackgroundSelectionTarget = element.id === backgroundSelectionTargetId;
    const isProcessing = processingElementIds.includes(element.id);

    return {
      draggable: !element.locked && !backgroundSelectionMode && !isProcessing,
      height: element.height * scaleY,
      opacity: isProcessing && activeProcessingBlink ? 0.38 : element.opacity,
      ref: (node: Konva.Node | null) => {
        nodeRefs.current[element.id] = node;
      },
      rotation: element.rotation,
      width: element.width * scaleX,
      x: element.x * scaleX,
      y: element.y * scaleY,
      onClick: (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (isProcessing) return;
        if (backgroundSelectionMode) {
          pickBackgroundSubject(element, event);
          return;
        }
        if (event.evt.shiftKey) {
          onSelectElement?.(element.id, { additive: true });
          return;
        }
        onSelectElement?.(element.id);
      },
      onContextMenu: (event: Konva.KonvaEventObject<PointerEvent>) => {
        event.evt.preventDefault();
        if (isProcessing || !backgroundSelectionMode) return;
        pickBackgroundSubject(element, event);
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
      onDragMove: handleDragMove,
      onMouseEnter: (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (!isBackgroundSelectionTarget && !isProcessing) return;
        const container = event.target.getStage()?.container();
        if (container) container.style.cursor = isProcessing ? 'progress' : 'crosshair';
      },
      onMouseLeave: (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (!isBackgroundSelectionTarget && !isProcessing) return;
        if (isBackgroundSelectionTarget) setBackgroundPreviewPoint(null);
        const container = event.target.getStage()?.container();
        if (container) container.style.cursor = '';
      },
      onMouseMove: (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (!isBackgroundSelectionTarget || !backgroundSelectionReady) return;
        const nextPreviewPoint = getBackgroundPreviewPoint(element, event);
        setBackgroundPreviewPoint(nextPreviewPoint);
        if (nextPreviewPoint) {
          onBackgroundPreviewPoint?.(
            element.id,
            getNormalizedElementPoint({
              element,
              pointer: nextPreviewPoint,
              scale: { x: scaleX, y: scaleY },
            }),
          );
        }
      },
      onTap: () => {
        if (isProcessing) return;
        onSelectElement?.(element.id);
      },
      onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
        handleTransformEnd(element.id, event);
      },
    };
  }

  function handleStagePointerDown(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (backgroundSelectionMode || editingTextId) return;
    if (event.target !== event.target.getStage()) return;
    onClearSelection?.();
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
        data-drag-guide={dragGuide ? 'active' : 'idle'}
        style={{
          transform: `scale(${zoomPercent / 100})`,
        }}
      >
        <button
          aria-label="Translate Current Slide"
          className="slide-translate-button"
          disabled={!canTranslateCurrentSlide}
          title="Translate Current Slide"
          type="button"
          onClick={onTranslateCurrentSlide}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            translate
          </span>
        </button>
        <div className="canvas-artboard" ref={artboardRef} style={{ background: pageBackground }}>
          {backgroundSelectionMode || backgroundSelectionNotice || processingSelectedImageId || isTranslating || translationNotice ? (
            <div className="background-selection-hint" role="status">
              <span className="material-symbols-outlined" aria-hidden="true">
                {isTranslating || translationNotice
                  ? 'translate'
                  : processingSelectedImageId
                    ? 'auto_fix_high'
                    : backgroundSelectionNotice
                      ? 'download'
                      : 'ads_click'}
              </span>
              <span>
                {isTranslating
                  ? 'Translating text...'
                  : translationNotice ??
                    getBackgroundSelectionMessage({
                      backgroundPreparation: activeBackgroundPreparation,
                      backgroundPreview,
                      backgroundSelectionTargetId,
                      backgroundSelectionNotice,
                      processingSelectedImageId,
                    })}
              </span>
              {activeBackgroundPreparation?.status === 'preparing' && !isTranslating ? (
                <span
                  aria-label="Image extraction progress"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={activeBackgroundPreparation.progress}
                  className="background-selection-progress"
                  role="progressbar"
                >
                  <span style={{ width: `${activeBackgroundPreparation.progress}%` }} />
                </span>
              ) : null}
              {processingSelectedImageId || isTranslating ? null : (
                <button type="button" onClick={onCancelBackgroundSelection}>
                  Esc
                </button>
              )}
            </div>
          ) : null}
          <Stage
            ref={stageRef}
            height={stageHeight}
            width={stageWidth}
            onMouseDown={handleStagePointerDown}
            onTouchStart={handleStagePointerDown}
          >
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
                    key={`${element.id}-font-${fontRenderVersion}`}
                    text={element.text}
                    fontFamily={element.fontFamily}
                    fontSize={element.fontSize * scaleY}
                    fontStyle={element.fontWeight >= 700 ? 'bold' : 'normal'}
                    fill={element.fill}
                    align={element.align}
                    lineHeight={0.9}
                    padding={TEXT_FRAME_PADDING * scaleY}
                    visible={editingTextId !== element.id}
                  />
                );
              })}
              {backgroundSelectionTargetId && selectedElement?.type === 'image' ? (
                <>
                  <BackgroundSelectionPreview
                    element={selectedElement}
                    maskUrl={
                      backgroundPreview?.elementId === selectedElement.id ? backgroundPreview.maskUrl : undefined
                    }
                    pending={backgroundPreview?.elementId === selectedElement.id && backgroundPreview.pending}
                    point={backgroundPreviewPoint}
                    scale={{ x: scaleX, y: scaleY }}
                  />
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
                </>
              ) : null}
              {backgroundSelectionMode || processingSelectedImageId ? null : (
                <>
                  {dragGuide ? (
                    <>
                      <Line
                        listening={false}
                        points={[dragGuide.x, 0, dragGuide.x, stageHeight]}
                        stroke="#37FD76"
                        strokeWidth={1}
                        opacity={0.78}
                        dash={[2, 7]}
                        shadowBlur={10}
                        shadowColor="#37FD76"
                      />
                      <Line
                        listening={false}
                        points={[0, dragGuide.y, stageWidth, dragGuide.y]}
                        stroke="#37FD76"
                        strokeWidth={1}
                        opacity={0.78}
                        dash={[2, 7]}
                        shadowBlur={10}
                        shadowColor="#37FD76"
                      />
                    </>
                  ) : null}
                </>
              )}
              {backgroundSelectionMode || processingSelectedImageId ? null : (
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
              )}
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
                  padding: `${TEXT_FRAME_PADDING * scaleY}px`,
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
            onInsertImage={onInsertImage}
            onInsertText={onInsertText}
            onBackgroundSelectionToggle={onBackgroundSelectionToggle}
            onSendBackward={onSendSelectedElementBackward}
            onTranslateSelectedText={onTranslateSelectedText}
            backgroundSelectionActive={backgroundSelectionMode}
            canTranslateSelection={canTranslateSelection}
            disabled={Boolean(processingSelectedImageId) || isTranslating}
          />
        ) : null}
      </div>
    </div>
  );
}

interface BackgroundSelectionPreviewProps {
  element: DesignElement;
  maskUrl: string | undefined;
  pending?: boolean;
  point: { x: number; y: number } | null;
  scale: { x: number; y: number };
}

function BackgroundSelectionPreview({ element, maskUrl, pending = false, point, scale }: BackgroundSelectionPreviewProps) {
  const maskImage = useCanvasImage(maskUrl);
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

interface BackgroundSelectionMessageOptions {
  backgroundPreparation:
    | { elementId: string; progress: number; status: 'preparing' | 'ready' | 'failed' }
    | undefined;
  backgroundPreview: { elementId: string; maskUrl?: string; pending: boolean; score?: number } | undefined;
  backgroundSelectionNotice: string | undefined;
  backgroundSelectionTargetId: string | undefined;
  processingSelectedImageId: string | undefined;
}

function getBackgroundSelectionMessage({
  backgroundPreparation,
  backgroundPreview,
  backgroundSelectionNotice,
  backgroundSelectionTargetId,
  processingSelectedImageId,
}: BackgroundSelectionMessageOptions) {
  if (processingSelectedImageId) return 'Removing background...';
  if (backgroundSelectionNotice) return backgroundSelectionNotice;
  if (backgroundPreparation?.status === 'failed') return 'Image extraction failed. Try background removal again.';
  if (backgroundPreparation?.status === 'preparing') return 'Extracting image embedding...';
  const previewScore =
    backgroundPreview && backgroundPreview.elementId === backgroundSelectionTargetId
      ? backgroundPreview.score
      : undefined;
  if (previewScore !== undefined) {
    return `Segment score: ${previewScore.toFixed(2)}`;
  }
  return 'Right click adds areas to keep. Left click applies the background removal.';
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
