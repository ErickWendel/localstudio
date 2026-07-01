import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type Konva from 'konva';
import { Arrow, Circle, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import type { ElementFramePatch, ImageCropPatch } from '../../domain/commands/basicCommands';
import type {
  CropRect,
  DesignElement,
  ElementAnimationBuild,
  GifElement,
  ImageElement,
  ProjectDocument,
  SelectionState,
  VideoElement,
} from '../../domain/model';
import { getNormalizedElementPoint } from './backgroundSelection';
import { FloatingSelectionToolbar } from './FloatingSelectionToolbar';
import { calculateImageCropPatch, type ImageCropHandle } from './imageCrop';
import {
  getElementLabel,
  getPolygonPoints,
  getShapePaint,
  isDesignElement,
  useCanvasImage,
} from './canvasWorkspaceUtils';

const TEXT_FRAME_PADDING = 6;

interface CanvasWorkspaceProps {
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  slideFrameRef?: RefObject<HTMLDivElement | null>;
  stageRef?: RefObject<Konva.Stage | null>;
  presentationMode?: boolean;
  readOnly?: boolean;
  zoomPercent?: number;
  backgroundSelectionMode?: boolean;
  backgroundSelectionNotice?: string | undefined;
  processingElementIds?: string[];
  backgroundPreview?: { elementId: string; maskUrl?: string; pending: boolean; score?: number } | undefined;
  animationPreview?:
    | {
        activeBuildElementId: string | undefined;
        hiddenElementIds: string[];
        mode?: 'editor' | 'presenter';
        pageId: string;
        phase: 'transition' | 'animation' | 'waiting' | 'complete';
        playing: boolean;
        waitingForClick: boolean;
      }
    | undefined;
  backgroundPreparation?:
    | { elementId: string; progress: number; status: 'preparing' | 'ready' | 'failed' }
    | undefined;
  canTranslateSelection?: boolean;
  isTranslating?: boolean;
  translationNotice?: string | undefined;
  onAlignSelectedElement?: (() => void) | undefined;
  onAnimationPreviewAdvance?: (() => void) | undefined;
  onBringSelectedElementForward?: (() => void) | undefined;
  onBackgroundPreviewPoint?: ((elementId: string, point: { x: number; y: number }) => void) | undefined;
  onBackgroundRefinePoint?: ((elementId: string, point: { x: number; y: number }) => void) | undefined;
  onBackgroundSelectionToggle?: (() => void) | undefined;
  onBackgroundSubjectPick?: ((elementId: string, point: { x: number; y: number }) => void) | undefined;
  onCancelBackgroundSelection?: (() => void) | undefined;
  onClearSelection?: (() => void) | undefined;
  onDeleteSelectedElement?: (() => void) | undefined;
  onDuplicateSelectedElement?: (() => void) | undefined;
  onFlipSelectedImage?: (() => void) | undefined;
  onInsertMedia?: (() => void) | undefined;
  onInsertText?: (() => void) | undefined;
  onOpenAnimations?: (() => void) | undefined;
  onSelectElement?: ((elementId: string, options?: { additive?: boolean }) => void) | undefined;
  onSendSelectedElementBackward?: (() => void) | undefined;
  onTranslateSelectedText?: (() => void) | undefined;
  onUpdateImageCrop?: ((elementId: string, patch: ImageCropPatch) => void) | undefined;
  onUpdateElementFrame?: ((elementId: string, patch: ElementFramePatch) => void) | undefined;
  onUpdateElementFrames?: ((patches: Record<string, ElementFramePatch>) => void) | undefined;
  onUpdateTextContent?: ((elementId: string, text: string) => void) | undefined;
}

interface CommonElementProps {
  draggable: boolean;
  height: number;
  opacity: number;
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

export function CanvasWorkspace({
  project,
  activePageId,
  selection,
  slideFrameRef,
  stageRef,
  presentationMode = false,
  readOnly = false,
  zoomPercent = 100,
  backgroundSelectionMode = false,
  backgroundSelectionNotice,
  processingElementIds = [],
  backgroundPreview,
  animationPreview,
  backgroundPreparation,
  canTranslateSelection = false,
  isTranslating = false,
  translationNotice,
  onAlignSelectedElement,
  onAnimationPreviewAdvance,
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
  onInsertMedia,
  onInsertText,
  onOpenAnimations,
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
  const visibleMediaElements = visibleElements.filter(
    (element): element is GifElement | VideoElement => element.type === 'gif' || element.type === 'video',
  );
  const hasSelection = selection.elementIds.length > 0;
  const isPresenterPlayback = presentationMode || animationPreview?.mode === 'presenter';
  const showEditorOverlays = !isPresenterPlayback && !readOnly;
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
  const animationPreviewHiddenElementIds =
    animationPreview?.pageId === activePageId ? animationPreview.hiddenElementIds : [];
  const isAnimationPreviewRunning =
    animationPreview?.pageId === activePageId &&
    animationPreview.playing &&
    animationPreview.phase !== 'complete';
  const canAdvanceAnimationPreviewByClick =
    animationPreview?.pageId === activePageId &&
    (animationPreview.waitingForClick ||
      (isPresenterPlayback && animationPreview.playing && animationPreview.phase === 'complete'));
  const animationBuildBadges: Array<{ build: ElementAnimationBuild; element: DesignElement; index: number }> = [];
  for (const [index, build] of (page?.animationBuilds ?? []).entries()) {
    const element = getDraftedElement(project.elements[build.elementId]);
    if (element && element.visible !== false) {
      animationBuildBadges.push({ build, element, index });
    }
  }
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
  const setElementNodeRef = useCallback((elementId: string, node: Konva.Node | null) => {
    nodeRefs.current[elementId] = node;
  }, []);

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
    if (readOnly) return;
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
      draggable: !readOnly && !element.locked && !backgroundSelectionMode && !isProcessing,
      height: element.height * scaleY,
      opacity: animationPreviewHiddenElementIds.includes(element.id)
        ? 0
        : isProcessing && activeProcessingBlink
          ? 0.38
          : element.opacity,
      rotation: element.rotation,
      width: element.width * scaleX,
      x: element.x * scaleX,
      y: element.y * scaleY,
      onClick: (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (canAdvanceAnimationPreviewByClick) {
          event.cancelBubble = true;
          onAnimationPreviewAdvance?.();
          return;
        }
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
        if (readOnly) return;
        startTextEditing(element);
      },
      onDblTap: () => {
        if (readOnly) return;
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
    if (canAdvanceAnimationPreviewByClick) {
      onAnimationPreviewAdvance?.();
      return;
    }
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
        data-animation-preview={animationPreview?.playing && animationPreview.pageId === activePageId ? 'playing' : 'idle'}
        data-animation-preview-mode={animationPreview?.pageId === activePageId ? (animationPreview.mode ?? 'editor') : 'idle'}
        data-animation-preview-phase={animationPreview?.pageId === activePageId ? animationPreview.phase : 'idle'}
        data-animation-preview-waiting={animationPreview?.waitingForClick ? 'true' : 'false'}
        style={{
          transform: `scale(${zoomPercent / 100})`,
        }}
      >
        <div className="canvas-artboard" ref={artboardRef} style={{ background: pageBackground }}>
          {showEditorOverlays &&
          (backgroundSelectionMode || backgroundSelectionNotice || processingSelectedImageId || isTranslating || translationNotice) ? (
            <div
              className={`background-selection-hint ${
                isTranslating || translationNotice ? 'background-selection-hint-translation' : ''
              }`}
              role="status"
            >
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
                const nodeRef = (node: Konva.Node | null) => {
                  setElementNodeRef(element.id, node);
                };

                if (element.type === 'shape') {
                  const paint = getShapePaint(element);
                  if (element.shape === 'ellipse') {
                    return (
                      <Rect
                        {...commonProps}
                        {...paint}
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
                        key={element.id}
                        cornerRadius={Math.min(commonProps.width, commonProps.height) * 0.18}
                        ref={nodeRef}
                      />
                    );
                  }
                  if (element.shape === 'line') {
                    return (
                      <Line
                        {...commonProps}
                        key={element.id}
                        points={[0, commonProps.height, commonProps.width, 0]}
                        ref={nodeRef}
                        stroke={element.stroke ?? element.fill ?? '#37FD76'}
                        strokeWidth={Math.max(1, element.strokeWidth ?? 4)}
                      />
                    );
                  }
                  if (element.shape === 'arrow') {
                    return (
                      <Arrow
                        {...commonProps}
                        key={element.id}
                        fill={element.stroke ?? element.fill ?? '#37FD76'}
                        points={[0, commonProps.height / 2, commonProps.width, commonProps.height / 2]}
                        pointerLength={Math.min(42, commonProps.width * 0.22)}
                        pointerWidth={Math.min(46, commonProps.height * 0.48)}
                        ref={nodeRef}
                        stroke={element.stroke ?? element.fill ?? '#37FD76'}
                        strokeWidth={Math.max(1, element.strokeWidth ?? 10)}
                      />
                    );
                  }
                  if (element.shape === 'arc') {
                    return (
                      <Line
                        {...commonProps}
                        key={element.id}
                        bezier
                        ref={nodeRef}
                        points={[
                          0,
                          commonProps.height,
                          commonProps.width * 0.12,
                          0,
                          commonProps.width * 0.88,
                          0,
                          commonProps.width,
                          commonProps.height,
                        ]}
                        stroke={element.stroke ?? element.fill ?? '#37FD76'}
                        strokeWidth={Math.max(1, element.strokeWidth ?? 4)}
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
                        closed
                        key={element.id}
                        points={getPolygonPoints(element.shape, commonProps.width, commonProps.height)}
                        ref={nodeRef}
                      />
                    );
                  }
                  return <Rect {...commonProps} {...paint} key={element.id} ref={nodeRef} />;
                }

                if (element.type === 'image') {
                  const asset = project.assets[element.assetId];
                  return (
                    <CanvasImageElement
                      key={element.id}
                      assetUrl={asset?.objectUrl}
                      commonProps={commonProps}
                      element={element}
                      nodeRef={nodeRef}
                    />
                  );
                }

                if (element.type === 'gif' || element.type === 'video') {
                  const selected = selection.elementIds.includes(element.id);
                  return (
                    <Rect
                      {...commonProps}
                      key={element.id}
                      fill="rgba(0,0,0,0.01)"
                      ref={nodeRef}
                      stroke={selected ? '#37FD76' : 'rgba(55,253,118,0.28)'}
                      strokeWidth={selected ? 2 : 1}
                      {...(!selected ? { dash: [6, 5] } : {})}
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
                    ref={nodeRef}
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
          <div className="canvas-media-layer" aria-hidden={visibleMediaElements.length === 0 ? true : undefined}>
            {visibleMediaElements.map((element) => {
              const asset = project.assets[element.assetId];
              return (
                <CanvasMediaElement
                  key={element.id}
                  assetName={asset?.name ?? (element.type === 'video' ? 'Imported video' : 'Imported GIF')}
                  assetUrl={asset?.objectUrl}
                  element={element}
                  interactive={
                    presentationMode ||
                    readOnly ||
                    (element.type === 'video' && selection.elementIds.includes(element.id))
                  }
                  previewMode={presentationMode || readOnly}
                  scale={{ x: scaleX, y: scaleY }}
                />
              );
            })}
          </div>
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
          {showEditorOverlays ? (
            <div className="animation-build-badges" aria-label="Animation build badges">
              {animationBuildBadges.map(({ build, element, index }) => (
                <span
                  aria-label={`Animation build ${index + 1} for ${getElementLabel(element)}`}
                  className={
                    selection.elementIds.includes(build.elementId)
                      ? 'animation-build-badge animation-build-badge-selected'
                      : 'animation-build-badge'
                  }
                  data-selected={selection.elementIds.includes(build.elementId) ? 'true' : 'false'}
                  key={build.id}
                  style={{
                    left: `${element.x * scaleX}px`,
                    top: `${element.y * scaleY}px`,
                  }}
                >
                  {index + 1}
                </span>
              ))}
            </div>
          ) : null}
          <span className="canvas-fallback-label">Selected Image</span>
        </div>
        {showEditorOverlays && animationPreview?.pageId === activePageId && animationPreview.waitingForClick ? (
          <div className="animation-preview-hint" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">
              ads_click
            </span>
            Click the slide to play the next animation.
          </div>
        ) : null}
        {showEditorOverlays && !backgroundSelectionMode && !processingSelectedImageId && !isAnimationPreviewRunning ? (
          <div className="canvas-quick-actions" aria-label="Canvas insert actions">
            <button type="button" aria-label="Insert Text" title="Insert Text" onClick={onInsertText}>
              <span className="material-symbols-outlined">title</span>
            </button>
            <button type="button" aria-label="Insert Media" title="Insert Media" onClick={onInsertMedia}>
              <span className="material-symbols-outlined">add_photo_alternate</span>
            </button>
          </div>
        ) : null}
        {showEditorOverlays && hasSelection && (selectedElement?.type === 'image' || selectedElement?.type === 'shape') ? (
          <FloatingSelectionToolbar
            elementType={selectedElement?.type === 'image' ? 'image' : 'shape'}
            onAlignCenter={onAlignSelectedElement}
            onBringForward={onBringSelectedElementForward}
            onDelete={onDeleteSelectedElement}
            onDuplicate={onDuplicateSelectedElement}
            onFlipImage={onFlipSelectedImage}
            onCropImage={toggleCropMode}
            onBackgroundSelectionToggle={onBackgroundSelectionToggle}
            onOpenAnimations={onOpenAnimations}
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
  nodeRef: (node: Konva.Node | null) => void;
}

interface CanvasMediaElementProps {
  assetName: string;
  assetUrl: string | undefined;
  element: GifElement | VideoElement;
  interactive: boolean;
  previewMode: boolean;
  scale: { x: number; y: number };
}

function getMediaStyle(element: GifElement | VideoElement, scale: { x: number; y: number }, interactive: boolean) {
  return {
    height: `${element.height * scale.y}px`,
    left: `${element.x * scale.x}px`,
    opacity: element.opacity,
    pointerEvents: interactive ? 'auto' : 'none',
    top: `${element.y * scale.y}px`,
    transform: `rotate(${element.rotation}deg)`,
    width: `${element.width * scale.x}px`,
  } as const;
}

function CanvasMediaElement({ assetName, assetUrl, element, interactive, previewMode, scale }: CanvasMediaElementProps) {
  if (element.type === 'gif') {
    return (
      <img
        aria-label={assetName}
        className="canvas-media-element"
        src={element.playing ? assetUrl : undefined}
        style={getMediaStyle(element, scale, interactive)}
      />
    );
  }

  return (
    <CanvasVideoElement
      assetName={assetName}
      assetUrl={assetUrl}
      element={element}
      interactive={interactive}
      previewMode={previewMode}
      scale={scale}
    />
  );
}

interface CanvasVideoElementProps {
  assetName: string;
  assetUrl: string | undefined;
  element: VideoElement;
  interactive: boolean;
  previewMode: boolean;
  scale: { x: number; y: number };
}

function CanvasVideoElement({ assetName, assetUrl, element, interactive, previewMode, scale }: CanvasVideoElementProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previousTrimRef = useRef<{ assetUrl: string | undefined; end: number | undefined; start: number } | undefined>(undefined);
  const autoplay = previewMode && element.autoplayInPreview;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const start = Math.max(0, element.trimStartSeconds);
    const end = element.trimEndSeconds !== undefined && element.trimEndSeconds > 0
      ? Math.max(0, element.trimEndSeconds)
      : undefined;
    const previousTrim = previousTrimRef.current;
    const assetChanged = previousTrim?.assetUrl !== assetUrl;
    if (assetChanged || previousTrim?.start !== start) {
      video.currentTime = start;
    } else if (previousTrim?.end !== end && end !== undefined) {
      video.currentTime = end;
    }
    previousTrimRef.current = { assetUrl, end, start };
  }, [assetUrl, element.trimEndSeconds, element.trimStartSeconds]);

  function enforceTrimWindow(video: HTMLVideoElement) {
    const trimEnd = element.trimEndSeconds;
    if (trimEnd === undefined || trimEnd <= 0) return;
    if (video.currentTime < trimEnd) return;
    if (element.loop) {
      video.currentTime = Math.max(0, element.trimStartSeconds);
      return;
    }
    video.pause();
  }

  return (
    <video
      aria-label={assetName}
      autoPlay={autoplay}
      className="canvas-media-element"
      controls={element.controls}
      data-trim-end={element.trimEndSeconds ?? ''}
      data-trim-start={element.trimStartSeconds}
      loop={element.loop}
      muted={element.muted}
      playsInline
      preload="metadata"
      ref={videoRef}
      src={assetUrl}
      style={getMediaStyle(element, scale, interactive)}
      onLoadedMetadata={(event) => {
        event.currentTarget.currentTime = Math.max(0, element.trimStartSeconds);
      }}
      onTimeUpdate={(event) => {
        enforceTrimWindow(event.currentTarget);
      }}
    />
  );
}

function CanvasImageElement({ assetUrl, commonProps, element, nodeRef }: CanvasImageElementProps) {
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
        ref={nodeRef}
      />
    );
  }

  return <KonvaImage {...imageProps} image={image} {...(crop ? { crop } : {})} cornerRadius={6} ref={nodeRef} />;
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
