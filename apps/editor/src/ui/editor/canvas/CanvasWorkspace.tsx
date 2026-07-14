import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import type Konva from 'konva';
import {
  Circle,
  Group,
  Layer,
  Rect,
  Stage,
  Text,
  Transformer,
} from 'react-konva';
import type {
  ElementFramePatch,
  ImageCropPatch,
} from '../../../domain/commands/elements/basicCommands';
import type {
  CropRect,
  DesignElement,
  ElementAnimationBuild,
  ElementAnimationBuild as ElementAnimationPreviewBuild,
  GifElement,
  ImageElement,
  ProjectDocument,
  SelectionState,
  VideoElement,
} from '../../../domain/documents/model';
import { getNormalizedElementPoint } from '../background-selection/backgroundSelection';
import { FloatingSelectionToolbar } from '../toolbars/FloatingSelectionToolbar';
import { imageCrop } from './imageCrop';
import type { ImageCropHandle } from './imageCrop';
import { canvasWorkspaceUtils } from './canvasWorkspaceUtils';
import { movieStartPlayback } from '../media/movieStartPlayback';
import { animationPresetEngine } from '../animation/animationPresetEngine';
import { BackgroundSelectionPreview } from './BackgroundSelectionPreview';
import { CanvasImageElement } from './CanvasImageElement';
import { CanvasMediaElement } from './CanvasMediaElement';
import { CanvasReadOnlyMediaElement } from './CanvasReadOnlyMediaElement';
import { CanvasShapeElement } from './CanvasShapeElement';
import { CanvasStatusHint } from './CanvasStatusHint';
import { CanvasDragGuide } from './CanvasDragGuide';
import { CropFrameOverlay } from './CropFrameOverlay';
import type { CommonElementProps, ElementAnimationRenderState } from './canvas-element-props';
import { shapeLineDraw } from './shape-line-draw';

const TEXT_FRAME_PADDING = 6;
const TEXT_EDITOR_HEIGHT_BUFFER = 4;

interface CanvasWorkspaceProps {
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  canvasLabel?: string;
  slideFrameRef?: RefObject<HTMLDivElement | null>;
  stageRef?: RefObject<Konva.Stage | null>;
  presentationMode?: boolean;
  readOnly?: boolean;
  zoomPercent?: number;
  backgroundSelectionMode?: boolean;
  backgroundSelectionNotice?: string | undefined;
  processingElementIds?: string[];
  backgroundPreview?:
    | { elementId: string; maskUrl?: string; pending: boolean; score?: number }
    | undefined;
  animationPreview?:
    | {
        activeBuildElementId: string | undefined;
        activeBuild?: ElementAnimationPreviewBuild | undefined;
        animationProgress?: number;
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
  onBackgroundPreviewPoint?:
    | ((elementId: string, point: { x: number; y: number }) => void)
    | undefined;
  onBackgroundRefinePoint?:
    | ((elementId: string, point: { x: number; y: number }) => void)
    | undefined;
  onBackgroundSelectionToggle?: (() => void) | undefined;
  onBackgroundSubjectPick?:
    | ((elementId: string, point: { x: number; y: number }) => void)
    | undefined;
  onCancelBackgroundSelection?: (() => void) | undefined;
  onClearSelection?: (() => void) | undefined;
  onDeleteSelectedElement?: (() => void) | undefined;
  onDuplicateSelectedElement?: (() => void) | undefined;
  onFlipSelectedImage?: (() => void) | undefined;
  onInsertMedia?: (() => void) | undefined;
  onInsertText?: (() => void) | undefined;
  onOpenAnimations?: (() => void) | undefined;
  onSelectPresentation?: (() => void) | undefined;
  onSelectSlide?: (() => void) | undefined;
  onSelectElement?: ((elementId: string, options?: { additive?: boolean }) => void) | undefined;
  onSendSelectedElementBackward?: (() => void) | undefined;
  onTranslateSelectedText?: (() => void) | undefined;
  onUpdateImageCrop?: ((elementId: string, patch: ImageCropPatch) => void) | undefined;
  onUpdateElementFrame?: ((elementId: string, patch: ElementFramePatch) => void) | undefined;
  onUpdateElementFrames?: ((patches: Record<string, ElementFramePatch>) => void) | undefined;
  onUpdateTextContent?: ((elementId: string, text: string) => void) | undefined;
}

interface MarqueeSelection {
  anchor: { x: number; y: number };
  current: { x: number; y: number };
}

interface StageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function clampAnimationProgress(value: number | undefined) {
  return Math.max(0, Math.min(1, value ?? 0));
}

function getAnimationOpacity(baseOpacity: number, state: ElementAnimationRenderState) {
  if (state.activeBuild?.mediaAction === 'play') return baseOpacity;
  if (state.activeBuild) return baseOpacity * (state.preset?.opacity ?? 1);
  return state.hidden ? 0 : baseOpacity;
}

function getTypedText(text: string, state: ElementAnimationRenderState) {
  if (state.activeBuild?.effect !== 'keyboard-typing') return text;
  return text.slice(0, Math.ceil(text.length * state.progress));
}

function getNormalizedStageRect(start: { x: number; y: number }, end: { x: number; y: number }) {
  return {
    height: Math.abs(end.y - start.y),
    width: Math.abs(end.x - start.x),
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
  };
}

function stageRectsIntersect(first: StageRect, second: StageRect) {
  return (
    first.x <= second.x + second.width &&
    first.x + first.width >= second.x &&
    first.y <= second.y + second.height &&
    first.y + first.height >= second.y
  );
}

export function CanvasWorkspace({
  project,
  activePageId,
  selection,
  canvasLabel = 'Slide canvas',
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
  onDeleteSelectedElement,
  onDuplicateSelectedElement,
  onFlipSelectedImage,
  onInsertMedia,
  onInsertText,
  onOpenAnimations,
  onSelectPresentation,
  onSelectSlide,
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
  const [editingTextHeight, setEditingTextHeight] = useState<number | undefined>(undefined);
  const [fontRenderVersion, setFontRenderVersion] = useState(0);
  const [processingBlinkOn, setProcessingBlinkOn] = useState(false);
  const [backgroundPreviewPoint, setBackgroundPreviewPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [dragGuide, setDragGuide] = useState<{ x: number; y: number } | null>(null);
  const [marqueeSelection, setMarqueeSelection] = useState<MarqueeSelection | null>(null);
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
  const activeLayout = page?.layoutId ? project.slideLayouts?.[page.layoutId] : undefined;
  const layoutVisibleElements =
    activeLayout?.elementIds
      .map((id) => activeLayout.elements[id])
      .filter(canvasWorkspaceUtils.isDesignElement)
      .filter((element) => element.visible !== false && !element.placeholderRole) ?? [];
  const layoutVisibleElementIds = new Set(layoutVisibleElements.map((element) => element.id));
  const sourceVisibleElements =
    page?.elementIds
      .map((id) => project.elements[id])
      .filter(canvasWorkspaceUtils.isDesignElement)
      .filter((element) => element.visible !== false) ?? [];
  const getDraftedElement = (element: DesignElement | undefined): DesignElement | undefined => {
    if (!element || element.type !== 'image' || cropDraft?.elementId !== element.id) return element;
    return { ...element, ...cropDraft.frame, crop: cropDraft.crop };
  };
  const pageVisibleElements = sourceVisibleElements
    .map((element) => getDraftedElement(element))
    .filter(canvasWorkspaceUtils.isDesignElement);
  const visibleElements = [...layoutVisibleElements, ...pageVisibleElements];
  const visibleMediaElements = visibleElements.filter(
    (element): element is GifElement | VideoElement =>
      element.type === 'gif' || element.type === 'video',
  );
  const projectFontSignature = useMemo(
    () =>
      Object.values(project.fonts ?? {})
        .map((font) => `${font.family}:${font.fontStyle}:${font.fontWeight}:${font.objectUrl ?? ''}`)
        .sort()
        .join('|'),
    [project.fonts],
  );
  const hasSelection = selection.elementIds.length > 0;
  const isPresenterPlayback = presentationMode || animationPreview?.mode === 'presenter';
  const showEditorOverlays = !isPresenterPlayback && !readOnly;
  const selectedElement = getDraftedElement(project.elements[selection.elementIds[0] ?? '']);
  const isCropModeActive =
    selectedElement?.type === 'image' && cropModeElementId === selectedElement.id;
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
  const activeAnimationBuild =
    animationPreview?.pageId === activePageId && animationPreview.phase === 'animation'
      ? animationPreview.activeBuild
      : undefined;
  const isAnimationPreviewRunning =
    animationPreview?.pageId === activePageId &&
    animationPreview.playing &&
    animationPreview.phase !== 'complete';
  const canAdvanceAnimationPreviewByClick =
    animationPreview?.pageId === activePageId &&
    (animationPreview.waitingForClick ||
      (isPresenterPlayback && animationPreview.playing && animationPreview.phase === 'complete'));
  const animationBuildBadges: Array<{
    build: ElementAnimationBuild;
    element: DesignElement;
    index: number;
  }> = [];
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
      : (page?.background.colorFallback ?? '#050D10');
  const transformAnchors =
    selectedElement?.type === 'text'
      ? ([
          'top-left',
          'top-right',
          'middle-left',
          'middle-right',
          'bottom-left',
          'bottom-right',
        ] as const)
      : ([
          'top-left',
          'top-center',
          'top-right',
          'middle-left',
          'middle-right',
          'bottom-left',
          'bottom-center',
          'bottom-right',
        ] as const);
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

    const projectFontLoads = Object.values(project.fonts ?? {}).map((font) =>
      fontSet.load(`${font.fontWeight} 16px "${font.family}"`),
    );

    void Promise.all([
      fontSet.load('800 96px Orbitron'),
      fontSet.load('600 40px "Open Sans"'),
      ...projectFontLoads,
      fontSet.ready,
    ]).then(() => {
      if (!isMounted) return;
      setFontRenderVersion((currentVersion) => currentVersion + 1);
      stageRef?.current?.batchDraw();
    });

    return () => {
      isMounted = false;
    };
  }, [project.fonts, projectFontSignature, stageRef]);

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

  function getStagePoint(event: MouseEvent) {
    const artboard = artboardRef.current;
    if (!artboard) return null;
    const stageBounds = artboard.getBoundingClientRect();
    return {
      x: event.clientX - stageBounds.left,
      y: event.clientY - stageBounds.top,
    };
  }

  function getElementStageRect(element: DesignElement) {
    const nodeRect = nodeRefs.current[element.id]?.getClientRect({
      skipShadow: true,
      skipStroke: true,
    });
    if (nodeRect) {
      return {
        height: nodeRect.height,
        width: nodeRect.width,
        x: nodeRect.x,
        y: nodeRect.y,
      };
    }
    return {
      height: element.height * scaleY,
      width: element.width * scaleX,
      x: element.x * scaleX,
      y: element.y * scaleY,
    };
  }

  function selectElementsInMarquee(rect: StageRect) {
    const selectedElementIds = pageVisibleElements
      .filter((element) => stageRectsIntersect(rect, getElementStageRect(element)))
      .map((element) => element.id);
    selectedElementIds.forEach((elementId, index) => {
      if (index === 0) {
        onSelectElement?.(elementId);
        return;
      }
      onSelectElement?.(elementId, { additive: true });
    });
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

  function getTransformFramePatch(elementId: string, node: Konva.Node): ElementFramePatch | undefined {
    const element = project.elements[elementId];
    if (!element) return undefined;
    const scaleXValue = Math.abs(node.scaleX());
    const scaleYValue = Math.abs(node.scaleY());
    const nextWidth = toDocumentX(Math.max(8, node.width() * scaleXValue));
    const nextHeight = toDocumentY(Math.max(8, node.height() * scaleYValue));
    return {
      x:
        element.type === 'image' && element.flipX
          ? toDocumentX(node.x()) - nextWidth
          : toDocumentX(node.x()),
      y: toDocumentY(node.y()),
      width: nextWidth,
      height: nextHeight,
      rotation: node.rotation(),
    };
  }

  function applyTransformPatchToNode(
    elementId: string,
    node: Konva.Node,
    patch: ElementFramePatch,
  ) {
    const element = project.elements[elementId];
    if (!element) return;
    const width = patch.width ?? element.width;
    const height = patch.height ?? element.height;
    const x = patch.x ?? element.x;
    const y = patch.y ?? element.y;

    node.width(width * scaleX);
    node.height(height * scaleY);
    node.x(element.type === 'image' && element.flipX ? (x + width) * scaleX : x * scaleX);
    node.y(y * scaleY);
    node.rotation(patch.rotation ?? element.rotation);
    node.scaleX(element.type === 'image' && element.flipX ? -1 : 1);
    node.scaleY(1);
  }

  function handleTransform(elementId: string, event: Konva.KonvaEventObject<Event>) {
    const node = event.target;
    const frame = getTransformFramePatch(elementId, node);
    if (!frame) return;

    applyTransformPatchToNode(elementId, node, frame);
  }

  function handleTransformEnd(elementId: string, event: Konva.KonvaEventObject<Event>) {
    const node = event.target;
    const draft = getTransformFramePatch(elementId, node);
    if (!draft) return;

    applyTransformPatchToNode(elementId, node, draft);
    onUpdateElementFrame?.(elementId, draft);
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

  function beginCropDrag(
    element: ImageElement,
    handle: ImageCropHandle,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY };
    let latestPatch: ReturnType<typeof imageCrop.calculateImageCropPatch> | undefined;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      latestPatch = imageCrop.calculateImageCropPatch(element, handle, {
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
    setEditingTextHeight(element.height);
  }

  function commitTextEditing() {
    if (!editingTextId) return;
    onUpdateTextContent?.(editingTextId, editingTextValue);
    setEditingTextId(null);
    setEditingTextHeight(undefined);
  }

  function cancelTextEditing() {
    setEditingTextId(null);
    setEditingTextValue('');
    setEditingTextHeight(undefined);
  }

  function updateTextEditing(element: Extract<DesignElement, { type: 'text' }>, input: HTMLTextAreaElement) {
    const nextValue = input.value;
    setEditingTextValue(nextValue);
    onUpdateTextContent?.(element.id, nextValue);

    const nextHeight = Math.ceil(
      Math.max(8, toDocumentY(input.scrollHeight + TEXT_EDITOR_HEIGHT_BUFFER)),
    );
    setEditingTextHeight(nextHeight);
    if (nextHeight !== element.height) {
      onUpdateElementFrame?.(element.id, { height: nextHeight });
    }
  }

  function pickBackgroundSubject(
    element: DesignElement,
    event: Konva.KonvaEventObject<MouseEvent>,
  ) {
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

  function getBackgroundPreviewPoint(
    element: DesignElement,
    event: Konva.KonvaEventObject<MouseEvent>,
  ) {
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

  function getCommonElementProps(element: DesignElement, options: { interactive?: boolean } = {}): CommonElementProps {
    const isInteractive = options.interactive ?? true;
    const isBackgroundSelectionTarget = element.id === backgroundSelectionTargetId;
    const isProcessing = processingElementIds.includes(element.id);
    const animationState = getElementAnimationState(element);
    const animationTransform = animationState.preset?.transform;

    return {
      draggable: isInteractive && !readOnly && !element.locked && !backgroundSelectionMode && !isProcessing,
      height: element.height * scaleY,
      ...(!isInteractive ? { listening: false } : {}),
      ...(animationState.activeBuild ? { name: `animated-element-${element.id}` } : {}),
      offsetX: animationTransform?.offsetX ?? 0,
      offsetY: animationTransform?.offsetY ?? 0,
      opacity:
        animationPreviewHiddenElementIds.includes(element.id) || animationState.activeBuild
          ? getAnimationOpacity(element.opacity, animationState)
          : isProcessing && activeProcessingBlink
            ? 0.38
            : element.opacity,
      rotation: element.rotation + (animationTransform?.rotation ?? 0),
      scaleX: animationTransform?.scaleX ?? 1,
      scaleY: animationTransform?.scaleY ?? 1,
      skewX: animationTransform?.skewX ?? 0,
      skewY: animationTransform?.skewY ?? 0,
      width: element.width * scaleX,
      x: element.x * scaleX + (animationTransform?.x ?? 0),
      y: element.y * scaleY + (animationTransform?.y ?? 0),
      onClick: (event: Konva.KonvaEventObject<MouseEvent>) => {
        if (!isInteractive) return;
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
        if (!isInteractive) return;
        if (isProcessing || !backgroundSelectionMode) return;
        pickBackgroundSubject(element, event);
      },
      onDblClick: () => {
        if (!isInteractive) return;
        if (readOnly) return;
        startTextEditing(element);
      },
      onDblTap: () => {
        if (!isInteractive) return;
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
        if (!isInteractive) return;
        if (isProcessing) return;
        onSelectElement?.(element.id);
      },
      onTransform: (event: Konva.KonvaEventObject<Event>) => {
        handleTransform(element.id, event);
      },
      onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
        handleTransformEnd(element.id, event);
      },
    };
  }

  function getElementAnimationState(element: DesignElement): ElementAnimationRenderState {
    const activeBuild =
      activeAnimationBuild?.elementId === element.id ? activeAnimationBuild : undefined;
    const progress = activeBuild ? clampAnimationProgress(animationPreview?.animationProgress) : 1;
    return {
      activeBuild,
      hidden: animationPreviewHiddenElementIds.includes(element.id),
      preset: activeBuild
        ? animationPresetEngine.getRenderState({
            bounds: {
              height: element.height * scaleY,
              width: element.width * scaleX,
              x: element.x * scaleX,
              y: element.y * scaleY,
            },
            direction: activeBuild.direction,
            effect: activeBuild.effect,
            progress,
            seed: `${activeBuild.id}-${element.id}`,
          })
        : undefined,
      progress,
    };
  }

  function getAnimationMaskFill(fill: string) {
    if (fill !== '#ffffff') return fill;
    return pageBackground.startsWith('#') || pageBackground.startsWith('rgb')
      ? pageBackground
      : '#050D10';
  }

  function renderAnimationOverlays(element: DesignElement) {
    const animationState = getElementAnimationState(element);
    const preset = animationState.preset;
    if (!animationState.activeBuild || !preset) return null;
    const baseX = element.x * scaleX;
    const baseY = element.y * scaleY;
    return (
      <Group key={`${element.id}-animation-overlays`} listening={false}>
        {preset.masks.map((mask, index) => (
          <Rect
            fill={getAnimationMaskFill(mask.fill)}
            height={mask.height}
            key={`${element.id}-animation-mask-${index}`}
            name="animation-mask"
            opacity={mask.opacity}
            rotation={mask.rotation}
            width={mask.width}
            x={baseX + mask.x}
            y={baseY + mask.y}
          />
        ))}
        {preset.particles.map((particle, index) =>
          particle.radius > 0 ? (
            <Circle
              fill={particle.fill}
              key={`${element.id}-animation-particle-${index}`}
              name="animation-particle"
              opacity={particle.opacity}
              radius={particle.radius}
              rotation={particle.rotation}
              x={baseX + particle.x}
              y={baseY + particle.y}
            />
          ) : (
            <Rect
              fill={particle.fill}
              height={particle.height}
              key={`${element.id}-animation-particle-${index}`}
              name="animation-particle"
              opacity={particle.opacity}
              rotation={particle.rotation}
              width={particle.width}
              x={baseX + particle.x}
              y={baseY + particle.y}
            />
          ),
        )}
      </Group>
    );
  }

  function handleStagePointerDown(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (canAdvanceAnimationPreviewByClick) {
      movieStartPlayback.playPendingMovieStart(artboardRef.current, project, animationPreview);
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
    onSelectSlide?.();
    if (readOnly || !onSelectElement || !(event.evt instanceof MouseEvent)) return;
    const startPoint = getStagePoint(event.evt);
    if (!startPoint) return;
    setMarqueeSelection({ anchor: startPoint, current: startPoint });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentPoint = getStagePoint(moveEvent);
      if (!currentPoint) return;
      setMarqueeSelection({ anchor: startPoint, current: currentPoint });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setMarqueeSelection(null);
      const endPoint = getStagePoint(upEvent);
      if (!endPoint) return;
      const marqueeRect = getNormalizedStageRect(startPoint, endPoint);
      if (marqueeRect.width < 4 || marqueeRect.height < 4) return;
      selectElementsInMarquee(marqueeRect);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  const marqueeRect = marqueeSelection
    ? getNormalizedStageRect(marqueeSelection.anchor, marqueeSelection.current)
    : undefined;

  return (
    <div
      className="canvas-workspace ew-viewport-stage"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onSelectPresentation?.();
      }}
    >
      <div
        className="canvas-frame neon-border"
        aria-label={canvasLabel}
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
        data-marquee-selection={marqueeSelection ? 'active' : 'idle'}
        data-animation-preview={
          animationPreview?.playing && animationPreview.pageId === activePageId ? 'playing' : 'idle'
        }
        data-animation-preview-mode={
          animationPreview?.pageId === activePageId ? (animationPreview.mode ?? 'editor') : 'idle'
        }
        data-animation-preview-phase={
          animationPreview?.pageId === activePageId ? animationPreview.phase : 'idle'
        }
        data-animation-preview-waiting={animationPreview?.waitingForClick ? 'true' : 'false'}
        data-testid="slide-canvas-frame"
        style={{ '--canvas-zoom': `${zoomPercent / 100}` } as CSSProperties}
      >
        <div className="canvas-artboard" ref={artboardRef} style={{ background: pageBackground }}>
          {showEditorOverlays &&
          (backgroundSelectionMode ||
            backgroundSelectionNotice ||
            processingSelectedImageId ||
            isTranslating ||
            translationNotice) ? (
            <CanvasStatusHint
              backgroundPreparation={activeBackgroundPreparation}
              backgroundPreview={backgroundPreview}
              backgroundSelectionNotice={backgroundSelectionNotice}
              backgroundSelectionTargetId={backgroundSelectionTargetId}
              isTranslating={isTranslating}
              processingSelectedImageId={processingSelectedImageId}
              translationNotice={translationNotice}
              onCancelBackgroundSelection={onCancelBackgroundSelection}
            />
          ) : null}
          <Stage
            ref={stageRef}
            height={stageHeight}
            width={stageWidth}
            onMouseDown={handleStagePointerDown}
            onTouchStart={handleStagePointerDown}
          >
            <Layer>
              <Rect
                fill={pageBackground}
                height={stageHeight}
                listening={false}
                width={stageWidth}
                x={0}
                y={0}
              />
              {visibleElements.map((element) => {
                const animationState = getElementAnimationState(element);
                const isLayoutElement = layoutVisibleElementIds.has(element.id);
                const commonProps = getCommonElementProps(element, {
                  interactive: !isLayoutElement,
                });
                const nodeRef = (node: Konva.Node | null) => {
                  setElementNodeRef(element.id, node);
                };

                if (element.type === 'shape') {
                  const lineDrawState = shapeLineDraw.getState(element, animationState);
                  return (
                    <CanvasShapeElement
                      commonProps={commonProps}
                      element={element}
                      key={element.id}
                      lineDrawState={lineDrawState}
                      nodeRef={nodeRef}
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
                      nodeRef={nodeRef}
                    />
                  );
                }

                if (element.type === 'gif' || element.type === 'video') {
                  const selected = selection.elementIds.includes(element.id);
                  const asset = project.assets[element.assetId];
                  if (readOnly) {
                    return (
                      <CanvasReadOnlyMediaElement
                        commonProps={commonProps}
                        element={element}
                        key={element.id}
                        label={asset?.name ?? (element.type === 'video' ? 'Imported video' : 'Imported GIF')}
                        nodeRef={nodeRef}
                      />
                    );
                  }
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
                    text={getTypedText(element.text, animationState)}
                    fontFamily={element.fontFamily}
                    fontSize={element.fontSize * scaleY}
                    fontStyle={element.fontWeight >= 700 ? 'bold' : 'normal'}
                    fill={element.fill}
                    align={element.align}
                    lineHeight={element.lineHeight ?? 1.05}
                    padding={TEXT_FRAME_PADDING * scaleY}
                    ref={nodeRef}
                    verticalAlign={element.verticalAlign ?? 'top'}
                    visible={editingTextId !== element.id}
                  />
                );
              })}
              {visibleElements.map((element) => renderAnimationOverlays(element))}
              {showEditorOverlays &&
              backgroundSelectionTargetId &&
              selectedElement?.type === 'image' ? (
                <>
                  <BackgroundSelectionPreview
                    element={selectedElement}
                    maskUrl={
                      backgroundPreview?.elementId === selectedElement.id
                        ? backgroundPreview.maskUrl
                        : undefined
                    }
                    pending={
                      backgroundPreview?.elementId === selectedElement.id &&
                      backgroundPreview.pending
                    }
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
                dragGuide ? (
                  <CanvasDragGuide
                    guide={dragGuide}
                    stageHeight={stageHeight}
                    stageWidth={stageWidth}
                  />
                ) : null
              ) : null}
              {showEditorOverlays &&
              !backgroundSelectionMode &&
              !processingSelectedImageId &&
              !isCropModeActive ? (
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
                  enabledAnchors={[...transformAnchors]}
                  boundBoxFunc={(oldBox, newBox) =>
                    newBox.width < 8 || newBox.height < 8 ? oldBox : newBox
                  }
                  rotateAnchorOffset={28}
                />
              ) : null}
            </Layer>
          </Stage>
          <div
            className="canvas-media-layer"
            aria-hidden={visibleMediaElements.length === 0 ? true : undefined}
          >
            {visibleMediaElements.map((element) => {
              const asset = project.assets[element.assetId];
              const animationState = getElementAnimationState(element);
              return (
                <CanvasMediaElement
                  animationState={animationState}
                  key={element.id}
                  assetName={
                    asset?.name ?? (element.type === 'video' ? 'Imported video' : 'Imported GIF')
                  }
                  assetUrl={asset?.objectUrl}
                  element={element}
                  interactive={presentationMode || readOnly}
                  opacity={getAnimationOpacity(element.opacity, animationState)}
                  previewMode={presentationMode || readOnly || isAnimationPreviewRunning}
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
          {showEditorOverlays && marqueeRect ? (
            <div
              aria-hidden="true"
              className="marquee-selection-box"
              data-testid="marquee-selection-box"
              style={{
                height: `${marqueeRect.height}px`,
                left: `${marqueeRect.x}px`,
                top: `${marqueeRect.y}px`,
                width: `${marqueeRect.width}px`,
              }}
            />
          ) : null}
          {showEditorOverlays
            ? visibleElements.map((element) => {
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
                      height: `${Math.max(element.height, editingTextHeight ?? element.height) * scaleY}px`,
                      left: `${element.x * scaleX}px`,
                      lineHeight: element.lineHeight ?? 1.05,
                      padding: `${TEXT_FRAME_PADDING * scaleY}px`,
                      textAlign: element.align,
                      top: `${element.y * scaleY}px`,
                      transform: `rotate(${element.rotation}deg)`,
                      width: `${element.width * scaleX}px`,
                    }}
                    onBlur={commitTextEditing}
                    onChange={(event) => {
                      updateTextEditing(element, event.currentTarget);
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
              })
            : null}
          {showEditorOverlays ? (
            <div className="animation-build-badges" aria-label="Animation build badges">
              {animationBuildBadges.map(({ build, element, index }) => (
                <span
                  aria-label={`Animation build ${index + 1} for ${canvasWorkspaceUtils.getElementLabel(element)}`}
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
        </div>
        {showEditorOverlays &&
        animationPreview?.pageId === activePageId &&
        animationPreview.waitingForClick ? (
          <div className="animation-preview-hint" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">
              ads_click
            </span>
            Click the slide to play the next animation.
          </div>
        ) : null}
        {showEditorOverlays &&
        !backgroundSelectionMode &&
        !processingSelectedImageId &&
        !isAnimationPreviewRunning ? (
          <div className="canvas-quick-actions" aria-label="Canvas insert actions">
            <button
              type="button"
              aria-label="Insert Text"
              title="Insert Text"
              onClick={onInsertText}
            >
              <span className="material-symbols-outlined">title</span>
            </button>
            <button
              type="button"
              aria-label="Insert Media"
              title="Insert Media"
              onClick={onInsertMedia}
            >
              <span className="material-symbols-outlined">add_photo_alternate</span>
            </button>
          </div>
        ) : null}
        {showEditorOverlays &&
        hasSelection &&
        selectedElement &&
        selectedElement.type !== 'text' ? (
          <FloatingSelectionToolbar
            elementType={selectedElement.type}
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
