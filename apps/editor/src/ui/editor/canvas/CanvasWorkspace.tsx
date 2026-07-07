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
  Image as KonvaImage,
  Layer,
  Line,
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
  ShapeElement,
  ShapeLineEndpoint,
  VideoElement,
} from '../../../domain/documents/model';
import { getNormalizedElementPoint } from '../background-selection/backgroundSelection';
import { FloatingSelectionToolbar } from '../toolbars/FloatingSelectionToolbar';
import { imageCrop } from './imageCrop';
import type { ImageCropHandle } from './imageCrop';
import { canvasWorkspaceUtils } from './canvasWorkspaceUtils';
import { movieStartPlayback } from '../media/movieStartPlayback';
import {
  animationPresetEngine,
  type AnimationPresetRenderState,
} from '../animation/animationPresetEngine';

const TEXT_FRAME_PADDING = 6;

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

interface CommonElementProps {
  draggable: boolean;
  height: number;
  name?: string;
  offsetX: number;
  offsetY: number;
  opacity: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
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

interface ElementAnimationRenderState {
  activeBuild: ElementAnimationPreviewBuild | undefined;
  hidden: boolean;
  preset: AnimationPresetRenderState | undefined;
  progress: number;
}

function clampAnimationProgress(value: number | undefined) {
  return Math.max(0, Math.min(1, value ?? 0));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
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

function getLineDrawPoints(
  points: number[],
  progress: number,
  direction: ElementAnimationPreviewBuild['lineDrawDirection'],
) {
  if (points.length < 4) return points;
  const startX = points[0] ?? 0;
  const startY = points[1] ?? 0;
  const endX = points[points.length - 2] ?? startX;
  const endY = points[points.length - 1] ?? startY;
  const lerp = (start: number, end: number, ratio = progress) => start + (end - start) * ratio;

  if (direction === 'end-to-start') {
    return [endX, endY, lerp(endX, startX), lerp(endY, startY)];
  }
  if (direction === 'middle-to-ends') {
    const middleX = (startX + endX) / 2;
    const middleY = (startY + endY) / 2;
    return [
      lerp(middleX, startX, progress),
      lerp(middleY, startY, progress),
      lerp(middleX, endX, progress),
      lerp(middleY, endY, progress),
    ];
  }
  return [startX, startY, lerp(startX, endX, progress), lerp(startY, endY, progress)];
}

function getLineDrawDash(
  length: number,
  progress: number,
  direction: ElementAnimationPreviewBuild['lineDrawDirection'],
) {
  const safeLength = Math.max(1, length);
  if (direction === 'middle-to-ends') {
    return {
      dash: [safeLength * progress, safeLength],
      dashOffset: (safeLength * progress) / 2,
    };
  }
  return {
    dash: [safeLength, safeLength],
    dashOffset:
      direction === 'end-to-start' ? -safeLength * (1 - progress) : safeLength * (1 - progress),
  };
}

function getLineDrawPerimeter(width: number, height: number) {
  return Math.max(1, width * 2 + height * 2);
}

function getShapeLineDrawState(element: ShapeElement, state: ElementAnimationRenderState) {
  if (state.activeBuild?.effect !== 'line-draw') {
    return {
      direction: undefined,
      progress: 1,
    };
  }
  return {
    direction: state.activeBuild.lineDrawDirection ?? 'start-to-end',
    progress: easeOutCubic(state.progress),
  };
}

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
  color,
  endpoint,
  point,
  angle,
  strokeWidth,
}: {
  color: string;
  endpoint: ShapeLineEndpoint;
  point: { x: number; y: number };
  angle: number;
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

function LinearShapeElement({
  commonProps,
  element,
  lineDrawState,
  nodeRef,
}: {
  commonProps: CommonElementProps;
  element: ShapeElement;
  lineDrawState: { direction: ElementAnimationPreviewBuild['lineDrawDirection']; progress: number };
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
      ? getLineDrawPoints(fullPoints, lineDrawState.progress, lineDrawState.direction)
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
          ? getLineDrawDash(
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
  const [fontRenderVersion, setFontRenderVersion] = useState(0);
  const [processingBlinkOn, setProcessingBlinkOn] = useState(false);
  const [backgroundPreviewPoint, setBackgroundPreviewPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
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
      .filter(canvasWorkspaceUtils.isDesignElement)
      .filter((element) => element.visible !== false) ?? [];
  const getDraftedElement = (element: DesignElement | undefined): DesignElement | undefined => {
    if (!element || element.type !== 'image' || cropDraft?.elementId !== element.id) return element;
    return { ...element, ...cropDraft.frame, crop: cropDraft.crop };
  };
  const visibleElements = sourceVisibleElements
    .map((element) => getDraftedElement(element))
    .filter(canvasWorkspaceUtils.isDesignElement);
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

  function getCommonElementProps(element: DesignElement): CommonElementProps {
    const isBackgroundSelectionTarget = element.id === backgroundSelectionTargetId;
    const isProcessing = processingElementIds.includes(element.id);
    const animationState = getElementAnimationState(element);
    const animationTransform = animationState.preset?.transform;

    return {
      draggable: !readOnly && !element.locked && !backgroundSelectionMode && !isProcessing,
      height: element.height * scaleY,
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
  }

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
                  : (translationNotice ??
                    getBackgroundSelectionMessage({
                      backgroundPreparation: activeBackgroundPreparation,
                      backgroundPreview,
                      backgroundSelectionTargetId,
                      backgroundSelectionNotice,
                      processingSelectedImageId,
                    }))}
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
                const commonProps = getCommonElementProps(element);
                const nodeRef = (node: Konva.Node | null) => {
                  setElementNodeRef(element.id, node);
                };

                if (element.type === 'shape') {
                  const paint = canvasWorkspaceUtils.getShapePaint(element);
                  const lineDrawState = getShapeLineDrawState(element, animationState);
                  if (element.shape === 'ellipse') {
                    return (
                      <Rect
                        {...commonProps}
                        {...paint}
                        key={element.id}
                        cornerRadius={Math.min(commonProps.width, commonProps.height) / 2}
                        {...(lineDrawState.direction
                          ? getLineDrawDash(
                              getLineDrawPerimeter(commonProps.width, commonProps.height),
                              lineDrawState.progress,
                              lineDrawState.direction,
                            )
                          : {})}
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
                        {...(lineDrawState.direction
                          ? getLineDrawDash(
                              getLineDrawPerimeter(commonProps.width, commonProps.height),
                              lineDrawState.progress,
                              lineDrawState.direction,
                            )
                          : {})}
                        ref={nodeRef}
                      />
                    );
                  }
                  if (element.shape === 'line') {
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
                  if (element.shape === 'arrow') {
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
                  if (element.shape === 'arc') {
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
                        closed
                        key={element.id}
                        points={canvasWorkspaceUtils.getPolygonPoints(
                          element.shape,
                          commonProps.width,
                          commonProps.height,
                        )}
                        {...(lineDrawState.direction
                          ? getLineDrawDash(
                              getLineDrawPerimeter(commonProps.width, commonProps.height),
                              lineDrawState.progress,
                              lineDrawState.direction,
                            )
                          : {})}
                        ref={nodeRef}
                      />
                    );
                  }
                  return (
                    <Rect
                      {...commonProps}
                      {...paint}
                      key={element.id}
                      {...(lineDrawState.direction
                        ? getLineDrawDash(
                            getLineDrawPerimeter(commonProps.width, commonProps.height),
                            lineDrawState.progress,
                            lineDrawState.direction,
                          )
                        : {})}
                      ref={nodeRef}
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
                    const label = asset?.name ?? (element.type === 'video' ? 'Imported video' : 'Imported GIF');
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
                      height: `${element.height * scaleY}px`,
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
          <span className="canvas-fallback-label">Selected Image</span>
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

interface BackgroundSelectionPreviewProps {
  element: DesignElement;
  maskUrl: string | undefined;
  pending?: boolean;
  point: { x: number; y: number } | null;
  scale: { x: number; y: number };
}

function BackgroundSelectionPreview({
  element,
  maskUrl,
  pending = false,
  point,
  scale,
}: BackgroundSelectionPreviewProps) {
  const maskImage = canvasWorkspaceUtils.useCanvasImage(maskUrl);
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
  backgroundPreview:
    | { elementId: string; maskUrl?: string; pending: boolean; score?: number }
    | undefined;
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
  if (backgroundPreparation?.status === 'failed')
    return 'Image extraction failed. Try background removal again.';
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
  animationState: ElementAnimationRenderState;
  assetName: string;
  assetUrl: string | undefined;
  element: GifElement | VideoElement;
  interactive: boolean;
  opacity: number;
  previewMode: boolean;
  scale: { x: number; y: number };
}

function getMediaStyle(
  element: GifElement | VideoElement,
  scale: { x: number; y: number },
  interactive: boolean,
  opacity: number,
) {
  return {
    height: `${element.height * scale.y}px`,
    left: `${element.x * scale.x}px`,
    opacity,
    pointerEvents: interactive ? 'auto' : 'none',
    top: `${element.y * scale.y}px`,
    transform: `rotate(${element.rotation}deg)`,
    width: `${element.width * scale.x}px`,
  } as const;
}

function CanvasMediaElement({
  animationState,
  assetName,
  assetUrl,
  element,
  interactive,
  opacity,
  previewMode,
  scale,
}: CanvasMediaElementProps) {
  if (element.type === 'gif') {
    return (
      <img
        aria-label={assetName}
        className="canvas-media-element"
        src={element.playing ? assetUrl : undefined}
        style={getMediaStyle(element, scale, interactive, opacity)}
      />
    );
  }

  return (
    <CanvasVideoElement
      assetName={assetName}
      assetUrl={assetUrl}
      element={element}
      animationState={animationState}
      interactive={interactive}
      opacity={opacity}
      previewMode={previewMode}
      scale={scale}
    />
  );
}

interface CanvasVideoElementProps {
  animationState: ElementAnimationRenderState;
  assetName: string;
  assetUrl: string | undefined;
  element: VideoElement;
  interactive: boolean;
  opacity: number;
  previewMode: boolean;
  scale: { x: number; y: number };
}

function CanvasVideoElement({
  animationState,
  assetName,
  assetUrl,
  element,
  interactive,
  opacity,
  previewMode,
  scale,
}: CanvasVideoElementProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reverseIntervalRef = useRef<number | undefined>(undefined);
  const previousTrimRef = useRef<
    | {
        assetUrl: string | undefined;
        end: number | undefined;
        poster: number | undefined;
        start: number;
      }
    | undefined
  >(undefined);
  const repeatMode = element.repeatMode ?? (element.loop ? 'loop' : 'none');
  const autoplay =
    previewMode && element.autoplayInPreview && !element.startOnClick && !animationState.hidden;

  function stopReversePlayback() {
    if (reverseIntervalRef.current === undefined) return;
    window.clearInterval(reverseIntervalRef.current);
    reverseIntervalRef.current = undefined;
  }

  function getTrimStart() {
    return Math.max(0, element.trimStartSeconds);
  }

  function getTrimEnd(video: HTMLVideoElement) {
    if (element.trimEndSeconds !== undefined && element.trimEndSeconds > 0) {
      return Math.max(0, element.trimEndSeconds);
    }
    return Number.isFinite(video.duration) ? video.duration : undefined;
  }

  function playVideo(video: HTMLVideoElement) {
    const playResult = video.play() as Promise<void> | undefined;
    if (playResult !== undefined) {
      void playResult.catch(() => {
        video.pause();
      });
    }
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const start = Math.max(0, element.trimStartSeconds);
    const end =
      element.trimEndSeconds !== undefined && element.trimEndSeconds > 0
        ? Math.max(0, element.trimEndSeconds)
        : Number.isFinite(video.duration)
          ? video.duration
          : undefined;
    const previousTrim = previousTrimRef.current;
    const assetChanged = previousTrim?.assetUrl !== assetUrl;
    const poster =
      element.posterFrameSeconds !== undefined
        ? Math.max(0, element.posterFrameSeconds)
        : undefined;
    const posterChanged = previousTrim?.poster !== poster;
    video.volume = Math.min(1, Math.max(0, element.volume ?? 1));
    if (posterChanged && poster !== undefined) {
      video.currentTime = poster;
    } else if (assetChanged || previousTrim?.start !== start) {
      video.currentTime = start;
    } else if (previousTrim?.end !== end && end !== undefined) {
      video.currentTime = end;
    }
    previousTrimRef.current = { assetUrl, end, poster, start };
  }, [
    assetUrl,
    element.posterFrameSeconds,
    element.trimEndSeconds,
    element.trimStartSeconds,
    element.volume,
  ]);

  useEffect(() => {
    return () => {
      if (reverseIntervalRef.current === undefined) return;
      window.clearInterval(reverseIntervalRef.current);
      reverseIntervalRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || element.playbackPositionSeconds === undefined) return;
    stopReversePlayback();
    video.currentTime = Math.max(0, element.playbackPositionSeconds);
  }, [element.playbackPositionSeconds]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || element.playing === undefined) return;
    stopReversePlayback();
    if (!element.playing) {
      video.pause();
      return;
    }
    playVideo(video);
  }, [element.playing]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !previewMode || !element.autoplayInPreview) return;
    if (animationState.activeBuild?.mediaAction === 'play') {
      stopReversePlayback();
      video.currentTime = Math.max(0, element.trimStartSeconds);
      if (movieStartPlayback.consumeStartedBuild(video, animationState.activeBuild.id)) return;
      playVideo(video);
      return;
    }
    if (animationState.hidden || element.startOnClick) {
      stopReversePlayback();
      video.pause();
      video.currentTime = Math.max(0, element.trimStartSeconds);
    }
  }, [
    animationState.activeBuild,
    animationState.hidden,
    element.autoplayInPreview,
    element.startOnClick,
    element.trimStartSeconds,
    previewMode,
  ]);

  function playReverse(video: HTMLVideoElement) {
    stopReversePlayback();
    video.pause();
    reverseIntervalRef.current = window.setInterval(() => {
      const trimStart = getTrimStart();
      const nextTime = Math.max(trimStart, video.currentTime - 1 / 30);
      video.currentTime = nextTime;
      if (nextTime > trimStart) return;
      stopReversePlayback();
      playVideo(video);
    }, 1000 / 30);
  }

  function enforceTrimWindow(video: HTMLVideoElement) {
    const trimEnd = getTrimEnd(video);
    if (trimEnd === undefined || trimEnd <= 0) return;
    if (video.currentTime < trimEnd) return;
    if (repeatMode === 'loop') {
      video.currentTime = getTrimStart();
      playVideo(video);
      return;
    }
    if (repeatMode === 'loop-back-and-forth') {
      playReverse(video);
      return;
    }
    video.pause();
  }

  return (
    <video
      aria-label={assetName}
      autoPlay={autoplay}
      className="canvas-media-element"
      controls={false}
      data-element-id={element.id}
      data-trim-end={element.trimEndSeconds ?? ''}
      data-trim-start={element.trimStartSeconds}
      data-media-element-id={element.id}
      loop={repeatMode === 'loop' && element.trimEndSeconds === undefined}
      muted={element.muted}
      playsInline
      preload="auto"
      ref={videoRef}
      src={assetUrl}
      style={getMediaStyle(element, scale, interactive, opacity)}
      onLoadedMetadata={(event) => {
        event.currentTarget.volume = Math.min(1, Math.max(0, element.volume ?? 1));
        event.currentTarget.currentTime = element.posterFrameSeconds ?? getTrimStart();
      }}
      onTimeUpdate={(event) => {
        enforceTrimWindow(event.currentTarget);
      }}
    />
  );
}

function CanvasImageElement({ assetUrl, commonProps, element, nodeRef }: CanvasImageElementProps) {
  const image = canvasWorkspaceUtils.useCanvasImage(assetUrl);
  const crop =
    element.crop && image
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

  return (
    <KonvaImage
      {...imageProps}
      image={image}
      {...(crop ? { crop } : {})}
      cornerRadius={6}
      ref={nodeRef}
    />
  );
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
