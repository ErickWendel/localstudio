import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type Konva from 'konva';
import { Circle, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import type { ElementFramePatch, ImageCropPatch } from '../../domain/commands/basicCommands';
import type { CropRect, DesignElement, ImageElement, ProjectDocument, SelectionState } from '../../domain/model';
import { getNormalizedElementPoint } from './backgroundSelection';
import { FloatingSelectionToolbar } from './FloatingSelectionToolbar';
import { calculateImageCropPatch, type ImageCropHandle } from './imageCrop';

const TEXT_FRAME_PADDING = 6;

interface CanvasWorkspaceProps {
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  slideFrameRef?: RefObject<HTMLDivElement | null>;
  stageRef?: RefObject<Konva.Stage | null>;
  presentationMode?: boolean;
  zoomPercent?: number;
  backgroundSelectionMode?: boolean;
  backgroundSelectionNotice?: string | undefined;
  processingElementIds?: string[];
  backgroundPreview?: { elementId: string; maskUrl?: string; pending: boolean; score?: number } | undefined;
  backgroundPreparation?:
    | { elementId: string; progress: number; status: 'preparing' | 'ready' | 'failed' }
    | undefined;
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
  onFlipSelectedImage?: () => void;
  onInsertImage?: () => void;
  onInsertText?: () => void;
  onSelectElement?: (elementId: string, options?: { additive?: boolean }) => void;
  onSendSelectedElementBackward?: () => void;
  onTranslateSelectedText?: () => void;
  onUpdateImageCrop?: (elementId: string, patch: ImageCropPatch) => void;
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
  slideFrameRef,
  stageRef,
  presentationMode = false,
  zoomPercent = 100,
  backgroundSelectionMode = false,
  backgroundSelectionNotice,
  processingElementIds = [],
  backgroundPreview,
  backgroundPreparation,
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
  onFlipSelectedImage,
  onInsertImage,
  onInsertText,
  onSelectElement,
  onSendSelectedElementBackward,
  onTranslateSelectedText,
  onUpdateImageCrop,
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
  const [cropModeElementId, setCropModeElementId] = useState<string | null>(null);
  const [cropDraft, setCropDraft] = useState<
    | {
        elementId: string;
        crop: CropRect;
        frame: ImageCropPatch;
      }
    | undefined
  >();
  const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
  const sourceVisibleElements =
    page?.elementIds
      .map((id) => project.elements[id])
      .filter(isDesignElement)
      .filter((element) => element.visible !== false) ?? [];
  const getDraftedElement = (element: DesignElement | undefined): DesignElement | undefined => {
    if (!element || element.type !== 'image' || cropDraft?.elementId !== element.id) return element;
    return { ...element, ...cropDraft.frame, crop: cropDraft.crop };
  };
  const visibleElements = sourceVisibleElements
    .map((element) => getDraftedElement(element))
    .filter(isDesignElement);
  const hasSelection = selection.elementIds.length > 0;
  const showEditorOverlays = !presentationMode;
  const selectedElement = getDraftedElement(project.elements[selection.elementIds[0] ?? '']);
  const isCropModeActive = selectedElement?.type === 'image' && cropModeElementId === selectedElement.id;
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
    const nextX =
      element.type === 'image' && element.flipX
        ? toDocumentX(event.target.x()) - element.width
        : toDocumentX(event.target.x());
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
    const element = project.elements[elementId];
    const scaleX = Math.abs(node.scaleX());
    const scaleY = node.scaleY();
    const nextWidth = toDocumentX(Math.max(8, node.width() * scaleX));

    node.scaleX(1);
    node.scaleY(1);

    onUpdateElementFrame?.(elementId, {
      x:
        element?.type === 'image' && element.flipX
          ? toDocumentX(node.x()) - nextWidth
          : toDocumentX(node.x()),
      y: toDocumentY(node.y()),
      width: nextWidth,
      height: toDocumentY(Math.max(8, node.height() * scaleY)),
      rotation: node.rotation(),
    });
  }

  function toggleCropMode() {
    if (selectedElement?.type !== 'image') return;
    setCropDraft(undefined);
    setCropModeElementId((current) => (current === selectedElement.id ? null : selectedElement.id));
  }

  function finishCropMode() {
    setCropDraft(undefined);
    setCropModeElementId(null);
  }

  function beginCropDrag(element: ImageElement, handle: ImageCropHandle, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY };
    let latestPatch: ReturnType<typeof calculateImageCropPatch> | undefined;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      latestPatch = calculateImageCropPatch(element, handle, {
        x: (moveEvent.clientX - start.x) / scaleX,
        y: (moveEvent.clientY - start.y) / scaleY,
      });
      setCropDraft({
        elementId: element.id,
        crop: latestPatch.crop,
        frame: {
          ...latestPatch.frame,
          crop: latestPatch.crop,
        },
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (latestPatch) {
        onUpdateImageCrop?.(element.id, {
          ...latestPatch.frame,
          crop: latestPatch.crop,
        });
      }
      setCropDraft(undefined);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
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
    if (event.target !== event.target.getStage()) {
      if (isCropModeActive) finishCropMode();
      return;
    }
    if (isCropModeActive) {
      finishCropMode();
      return;
    }
    onClearSelection?.();
  }

  return (
    <div className="canvas-workspace">
      <div
        className="canvas-frame neon-border"
        aria-label="Slide canvas"
        ref={slideFrameRef}
        onPointerDown={(event) => {
          if (!isCropModeActive) return;
          if (event.target !== event.currentTarget) return;
          finishCropMode();
        }}
        {...(backgroundSelectionTargetId
          ? { 'data-background-selection-target': backgroundSelectionTargetId }
          : {})}
        data-selected-elements={selection.elementIds.join(',')}
        data-drag-guide={dragGuide ? 'active' : 'idle'}
        style={{
          transform: `scale(${zoomPercent / 100})`,
        }}
      >
        <div className="canvas-artboard" ref={artboardRef} style={{ background: pageBackground }}>
          {showEditorOverlays &&
          (backgroundSelectionMode || backgroundSelectionNotice || processingSelectedImageId || isTranslating || translationNotice) ? (
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
                      element={element}
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
              {showEditorOverlays && backgroundSelectionTargetId && selectedElement?.type === 'image' ? (
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
              {showEditorOverlays && !backgroundSelectionMode && !processingSelectedImageId ? (
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
              ) : null}
              {showEditorOverlays && !backgroundSelectionMode && !processingSelectedImageId && !isCropModeActive ? (
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
              ) : null}
            </Layer>
          </Stage>
          {showEditorOverlays && selectedElement?.type === 'image' && isCropModeActive ? (
            <CropFrameOverlay
              element={selectedElement}
              scale={{ x: scaleX, y: scaleY }}
              onHandlePointerDown={beginCropDrag}
            />
          ) : null}
          {showEditorOverlays ? visibleElements.map((element) => {
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
          }) : null}
          <span className="canvas-fallback-label">Selected Image</span>
        </div>
        {showEditorOverlays && !backgroundSelectionMode && !processingSelectedImageId ? (
          <div className="canvas-quick-actions" aria-label="Canvas insert actions">
            <button type="button" aria-label="Insert Text" title="Insert Text" onClick={onInsertText}>
              <span className="material-symbols-outlined">title</span>
            </button>
            <button type="button" aria-label="Insert Image" title="Insert Image" onClick={onInsertImage}>
              <span className="material-symbols-outlined">add_photo_alternate</span>
            </button>
          </div>
        ) : null}
        {showEditorOverlays && hasSelection && selectedElement?.type !== 'text' ? (
          <FloatingSelectionToolbar
            elementType={selectedElement?.type === 'image' ? 'image' : 'shape'}
            onAlignCenter={onAlignSelectedElement}
            onBringForward={onBringSelectedElementForward}
            onDelete={onDeleteSelectedElement}
            onDuplicate={onDuplicateSelectedElement}
            onFlipImage={onFlipSelectedImage}
            onCropImage={toggleCropMode}
            onBackgroundSelectionToggle={onBackgroundSelectionToggle}
            onSendBackward={onSendSelectedElementBackward}
            onTranslateSelectedText={onTranslateSelectedText}
            backgroundSelectionActive={backgroundSelectionMode}
            cropActive={isCropModeActive}
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
  element: Extract<DesignElement, { type: 'image' }>;
}

function CanvasImageElement({ assetUrl, commonProps, element }: CanvasImageElementProps) {
  const image = useCanvasImage(assetUrl);
  const crop = element.crop && image
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
      />
    );
  }

  return <KonvaImage {...imageProps} image={image} {...(crop ? { crop } : {})} cornerRadius={6} />;
}

interface CropFrameOverlayProps {
  element: ImageElement;
  scale: { x: number; y: number };
  onHandlePointerDown: (
    element: ImageElement,
    handle: ImageCropHandle,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
}

const cropHandles: Array<{ handle: ImageCropHandle; label: string }> = [
  { handle: 'top-left', label: 'Crop top left' },
  { handle: 'top', label: 'Crop top' },
  { handle: 'top-right', label: 'Crop top right' },
  { handle: 'right', label: 'Crop right' },
  { handle: 'bottom-right', label: 'Crop bottom right' },
  { handle: 'bottom', label: 'Crop bottom' },
  { handle: 'bottom-left', label: 'Crop bottom left' },
  { handle: 'left', label: 'Crop left' },
];

function CropFrameOverlay({ element, scale, onHandlePointerDown }: CropFrameOverlayProps) {
  return (
    <div
      className="image-crop-frame"
      style={{
        height: `${element.height * scale.y}px`,
        left: `${element.x * scale.x}px`,
        top: `${element.y * scale.y}px`,
        transform: `rotate(${element.rotation}deg)`,
        width: `${element.width * scale.x}px`,
      }}
    >
      <div className="image-crop-grid" aria-hidden="true" />
      {cropHandles.map(({ handle, label }) => (
        <button
          key={handle}
          aria-label={label}
          className={`image-crop-handle image-crop-handle-${handle}`}
          type="button"
          onPointerDown={(event) => {
            onHandlePointerDown(element, handle, event);
          }}
        />
      ))}
    </div>
  );
}
