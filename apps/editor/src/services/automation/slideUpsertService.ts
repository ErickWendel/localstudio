import type {
  Asset,
  CropRect,
  DesignElement,
  ElementAnimationBuild,
  ElementAnimationKind,
  ElementType,
  PageBackground,
  ProjectDocument,
  ShapeKind,
} from '../../domain/documents/model';

export interface SlideElementFrameInput {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SlideElementAnimationInput {
  effect: ElementAnimationBuild['effect'];
  trigger?: ElementAnimationBuild['trigger'];
  kind?: ElementAnimationKind;
  delayMs?: number;
  durationMs?: number;
  direction?: ElementAnimationBuild['direction'];
  order: number;
}

interface SlideElementBaseInput {
  elementId: string;
  type: ElementType;
  frame: SlideElementFrameInput;
  zIndex: number;
  rotation?: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
  animations?: SlideElementAnimationInput[];
}

export interface SlideTextElementInput extends SlideElementBaseInput {
  type: 'text';
  content: { text: string };
  style: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    color: string;
    align?: 'left' | 'center' | 'right';
    verticalAlign?: 'bottom' | 'middle' | 'top';
    lineHeight?: number;
    highlight?: string;
  };
}

export interface SlideMediaContentInput {
  assetId?: string;
  url?: string;
  mediaRef?: string;
}

export interface SlideImageElementInput extends SlideElementBaseInput {
  type: 'image';
  content: SlideMediaContentInput;
  crop?: CropRect;
  flipX?: boolean;
  mask?: 'ellipse';
}

export interface SlideGifElementInput extends SlideElementBaseInput {
  type: 'gif';
  content: SlideMediaContentInput;
  playing?: boolean;
}

export interface SlideVideoElementInput extends SlideElementBaseInput {
  type: 'video';
  content: SlideMediaContentInput;
  playback?: {
    loop?: boolean;
    controls?: boolean;
    muted?: boolean;
    autoplayInPreview?: boolean;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
    playAcrossSlides?: boolean;
    startOnClick?: boolean;
    volume?: number;
  };
}

export interface SlideShapeElementInput extends SlideElementBaseInput {
  type: 'shape';
  content: {
    shape: ShapeKind;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
  };
}

export type SlideElementInput =
  | SlideTextElementInput
  | SlideImageElementInput
  | SlideGifElementInput
  | SlideVideoElementInput
  | SlideShapeElementInput;

export interface SlideUpsertBatch {
  requestId: string;
  slideId?: string;
  slideNumber?: number;
  mode: 'merge' | 'replace';
  slide?: {
    name?: string;
    width?: number;
    height?: number;
    background?: PageBackground;
    speakerNotes?: string;
  };
  elements: SlideElementInput[];
  deleteElementIds?: string[];
}

export interface SlideUpsertResult {
  requestId: string;
  slideId: string;
  slideNumber: number;
  createdSlide: boolean;
  createdElements: number;
  updatedElements: number;
  deletedElements: number;
  elementCount: number;
  project: ProjectDocument;
}

interface SlideUpsertOptions {
  createId(prefix: string): string;
  resolveMedia(
    input: SlideMediaContentInput,
    context: { elementId: string; type: 'gif' | 'image' | 'video' },
  ): Promise<Asset>;
}

const shapeKinds = new Set<ShapeKind>([
  'arc',
  'arrow',
  'diamond',
  'ellipse',
  'line',
  'parallelogram',
  'pentagon',
  'rect',
  'rounded-rect',
  'triangle',
]);
const animationEffects = new Set<ElementAnimationBuild['effect']>([
  'blinds',
  'clothesline',
  'color-planes',
  'confetti',
  'cube',
  'doorway',
  'dissolve',
  'drop',
  'droplet',
  'fade',
  'fade-and-move',
  'fade-through-color',
  'fall',
  'flip',
  'flop',
  'grid',
  'iris',
  'keyboard-typing',
  'line-draw',
  'mosaic',
  'move-in',
  'page-flip',
  'pivot',
  'push',
  'radial-wipe',
  'reflection',
  'reveal',
  'revolving-door',
  'scale',
  'swap',
  'switch',
  'swoosh',
  'twirl',
  'twist',
  'wipe',
]);
const elementTypes = new Set<ElementType>(['text', 'image', 'gif', 'video', 'shape']);
const animationTriggers = new Set(['on-click', 'after-transition', 'after-previous']);
const animationKinds = new Set(['build-in', 'build-out', 'emphasis']);
const animationDirections = new Set(['up', 'right', 'down', 'left']);

function requireFinite(value: number, label: string, minimum?: number) {
  if (!Number.isFinite(value) || (minimum !== undefined && value < minimum)) {
    throw new Error(
      `${label} must be a finite number${minimum === undefined ? '' : ` greater than or equal to ${minimum}`}.`,
    );
  }
}

function validateElement(input: SlideElementInput) {
  if (!input.elementId.trim()) throw new Error('Every element needs a stable elementId.');
  if (!elementTypes.has(input.type))
    throw new Error(`${input.elementId} uses an unsupported type.`);
  requireFinite(input.frame.x, `${input.elementId}.frame.x`);
  requireFinite(input.frame.y, `${input.elementId}.frame.y`);
  requireFinite(input.frame.width, `${input.elementId}.frame.width`, 1);
  requireFinite(input.frame.height, `${input.elementId}.frame.height`, 1);
  requireFinite(input.zIndex, `${input.elementId}.zIndex`, 0);
  if (!Number.isInteger(input.zIndex))
    throw new Error(`${input.elementId}.zIndex must be an integer.`);
  if (input.opacity !== undefined) {
    requireFinite(input.opacity, `${input.elementId}.opacity`, 0);
    if (input.opacity > 1) throw new Error(`${input.elementId}.opacity must be at most 1.`);
  }
  for (const animation of input.animations ?? []) {
    if (!animationEffects.has(animation.effect)) {
      throw new Error(`${input.elementId} uses an unsupported animation effect.`);
    }
    requireFinite(animation.order, `${input.elementId}.animation.order`, 0);
    if (!Number.isInteger(animation.order)) {
      throw new Error(`${input.elementId}.animation.order must be an integer.`);
    }
    if (animation.trigger && !animationTriggers.has(animation.trigger)) {
      throw new Error(`${input.elementId} uses an unsupported animation trigger.`);
    }
    if (animation.kind && !animationKinds.has(animation.kind)) {
      throw new Error(`${input.elementId} uses an unsupported animation kind.`);
    }
    if (animation.direction && !animationDirections.has(animation.direction)) {
      throw new Error(`${input.elementId} uses an unsupported animation direction.`);
    }
    if (animation.delayMs !== undefined) {
      requireFinite(animation.delayMs, `${input.elementId}.animation.delayMs`, 0);
    }
    if (animation.durationMs !== undefined) {
      requireFinite(animation.durationMs, `${input.elementId}.animation.durationMs`, 0);
    }
  }
  if (input.type === 'text') {
    if (!input.style.fontFamily.trim()) throw new Error(`${input.elementId} needs a font family.`);
    requireFinite(input.style.fontSize, `${input.elementId}.style.fontSize`, 1);
    requireFinite(input.style.fontWeight, `${input.elementId}.style.fontWeight`, 1);
  }
  if (input.type === 'shape' && !shapeKinds.has(input.content.shape)) {
    throw new Error(`${input.elementId} uses an unsupported shape.`);
  }
  if (input.type === 'image' || input.type === 'gif' || input.type === 'video') {
    const sources = [input.content.assetId, input.content.url, input.content.mediaRef].filter(
      Boolean,
    );
    if (sources.length !== 1) {
      throw new Error(`${input.elementId} needs exactly one of assetId, url, or mediaRef.`);
    }
  }
}

function commonElement(input: SlideElementInput) {
  return {
    id: input.elementId,
    type: input.type,
    ...input.frame,
    rotation: input.rotation ?? 0,
    opacity: Math.min(1, input.opacity ?? 1),
    visible: input.visible ?? true,
    locked: input.locked ?? false,
  };
}

async function createElement(
  input: SlideElementInput,
  options: SlideUpsertOptions,
): Promise<{ asset?: Asset; element: DesignElement }> {
  const common = commonElement(input);
  if (input.type === 'text') {
    return {
      element: {
        ...common,
        type: 'text',
        text: input.content.text,
        fontFamily: input.style.fontFamily,
        fontSize: input.style.fontSize,
        fontWeight: input.style.fontWeight,
        fill: input.style.color,
        align: input.style.align ?? 'left',
        ...(input.style.verticalAlign ? { verticalAlign: input.style.verticalAlign } : {}),
        ...(input.style.lineHeight !== undefined ? { lineHeight: input.style.lineHeight } : {}),
        ...(input.style.highlight ? { highlight: input.style.highlight } : {}),
      },
    };
  }
  if (input.type === 'shape') {
    return {
      element: {
        ...common,
        type: 'shape',
        shape: input.content.shape,
        ...(input.content.fill ? { fill: input.content.fill } : {}),
        ...(input.content.stroke ? { stroke: input.content.stroke } : {}),
        ...(input.content.strokeWidth !== undefined
          ? { strokeWidth: input.content.strokeWidth }
          : {}),
      },
    };
  }

  const asset = await options.resolveMedia(input.content, {
    elementId: input.elementId,
    type: input.type,
  });
  if (input.type === 'image') {
    return {
      asset,
      element: {
        ...common,
        type: 'image',
        assetId: asset.id,
        ...(input.crop ? { crop: input.crop } : {}),
        ...(input.flipX !== undefined ? { flipX: input.flipX } : {}),
        ...(input.mask ? { mask: input.mask } : {}),
      },
    };
  }
  if (input.type === 'gif') {
    return {
      asset,
      element: {
        ...common,
        type: 'gif',
        assetId: asset.id,
        playing: input.playing ?? true,
      },
    };
  }
  return {
    asset,
    element: {
      ...common,
      type: 'video',
      assetId: asset.id,
      loop: input.playback?.loop ?? false,
      controls: input.playback?.controls ?? true,
      muted: input.playback?.muted ?? false,
      autoplayInPreview: input.playback?.autoplayInPreview ?? false,
      trimStartSeconds: input.playback?.trimStartSeconds ?? 0,
      ...(input.playback?.trimEndSeconds !== undefined
        ? { trimEndSeconds: input.playback.trimEndSeconds }
        : {}),
      ...(input.playback?.playAcrossSlides !== undefined
        ? { playAcrossSlides: input.playback.playAcrossSlides }
        : {}),
      ...(input.playback?.startOnClick !== undefined
        ? { startOnClick: input.playback.startOnClick }
        : {}),
      ...(input.playback?.volume !== undefined ? { volume: input.playback.volume } : {}),
    },
  };
}

function resolvePageIndex(project: ProjectDocument, batch: SlideUpsertBatch) {
  if (batch.slideId) {
    const index = project.pages.findIndex((page) => page.id === batch.slideId);
    if (index < 0) throw new Error(`Unknown slideId: ${batch.slideId}.`);
    return { index, created: false };
  }
  if (!Number.isInteger(batch.slideNumber) || (batch.slideNumber ?? 0) < 1) {
    throw new Error('Provide a valid one-based slideNumber or slideId.');
  }
  const index = (batch.slideNumber ?? 1) - 1;
  if (index > project.pages.length) throw new Error('Slide numbers cannot contain gaps.');
  return { index, created: index === project.pages.length };
}

async function apply(
  project: ProjectDocument,
  batch: SlideUpsertBatch,
  options: SlideUpsertOptions,
): Promise<SlideUpsertResult> {
  validate(project, batch);
  const target = resolvePageIndex(project, batch);
  const existingPage = project.pages[target.index];
  const slideId = existingPage?.id ?? options.createId('page');
  const previousElementIds = existingPage?.elementIds ?? [];
  const deleteIds = new Set(batch.deleteElementIds ?? []);
  if (batch.mode === 'replace') previousElementIds.forEach((elementId) => deleteIds.add(elementId));

  const resolvedElements = await Promise.all(
    batch.elements.map(async (input) => ({ input, ...(await createElement(input, options)) })),
  );

  const elements = { ...project.elements };
  deleteIds.forEach((elementId) => delete elements[elementId]);
  const assets = { ...project.assets };
  resolvedElements.forEach(({ asset, element }) => {
    elements[element.id] = element;
    if (asset) assets[asset.id] = asset;
  });

  const retainedIds = previousElementIds.filter(
    (elementId) =>
      !deleteIds.has(elementId) && !batch.elements.some((item) => item.elementId === elementId),
  );
  const zIndexes = new Map(batch.elements.map((element) => [element.elementId, element.zIndex]));
  const orderedElementIds = [
    ...retainedIds,
    ...batch.elements.map((element) => element.elementId),
  ].sort(
    (first, second) =>
      (zIndexes.get(first) ?? previousElementIds.indexOf(first)) -
      (zIndexes.get(second) ?? previousElementIds.indexOf(second)),
  );
  const animations = batch.elements
    .flatMap((element) =>
      (element.animations ?? []).map((animation) => ({ elementId: element.elementId, animation })),
    )
    .sort((first, second) => first.animation.order - second.animation.order)
    .map<ElementAnimationBuild>(({ elementId, animation }) => ({
      id: options.createId(`animation-${elementId}`),
      elementId,
      effect: animation.effect,
      trigger: animation.trigger ?? 'on-click',
      delayMs: animation.delayMs ?? 0,
      ...(animation.kind ? { kind: animation.kind } : {}),
      order: animation.order,
      ...(animation.durationMs !== undefined ? { durationMs: animation.durationMs } : {}),
      ...(animation.direction ? { direction: animation.direction } : {}),
    }));
  const retainedAnimations = (existingPage?.animationBuilds ?? []).filter(
    (build) =>
      !deleteIds.has(build.elementId) &&
      !batch.elements.some((item) => item.elementId === build.elementId),
  );
  const orderedAnimations = [...retainedAnimations, ...animations].sort(
    (first, second) => (first.order ?? 0) - (second.order ?? 0),
  );
  const timestamp = new Date().toISOString();
  const page = {
    id: slideId,
    name: batch.slide?.name ?? existingPage?.name ?? `Slide ${target.index + 1}`,
    width: batch.slide?.width ?? existingPage?.width ?? 1920,
    height: batch.slide?.height ?? existingPage?.height ?? 1080,
    background: batch.slide?.background ??
      existingPage?.background ?? { type: 'color' as const, color: '#050D10' },
    elementIds: orderedElementIds,
    ...(batch.slide?.speakerNotes !== undefined
      ? { speakerNotes: batch.slide.speakerNotes }
      : existingPage?.speakerNotes
        ? { speakerNotes: existingPage.speakerNotes }
        : {}),
    ...(orderedAnimations.length > 0 ? { animationBuilds: orderedAnimations } : {}),
    ...(existingPage?.semanticDescription
      ? { semanticDescription: { ...existingPage.semanticDescription, stale: true } }
      : {}),
    visible: existingPage?.visible ?? true,
  };
  const pages = [...project.pages];
  if (target.created) pages.push(page);
  else pages[target.index] = page;
  const nextProject = { ...project, pages, elements, assets, updatedAt: timestamp };

  return {
    requestId: batch.requestId,
    slideId,
    slideNumber: target.index + 1,
    createdSlide: target.created,
    createdElements: batch.elements.filter((element) => !project.elements[element.elementId])
      .length,
    updatedElements: batch.elements.filter((element) =>
      Boolean(project.elements[element.elementId]),
    ).length,
    deletedElements: deleteIds.size,
    elementCount: orderedElementIds.length,
    project: nextProject,
  };
}

function validate(project: ProjectDocument, batch: SlideUpsertBatch) {
  if (!batch.requestId?.trim()) throw new Error('requestId is required for idempotent upserts.');
  if (!['merge', 'replace'].includes(batch.mode)) throw new Error('mode must be merge or replace.');
  if (Boolean(batch.slideId) === Boolean(batch.slideNumber)) {
    throw new Error('Provide exactly one of slideId or slideNumber.');
  }
  if (!Array.isArray(batch.elements)) throw new Error('elements must be an array.');
  if (batch.elements.length > 100) throw new Error('A batch can contain at most 100 elements.');
  if ((batch.deleteElementIds?.length ?? 0) > 100) {
    throw new Error('A batch can delete at most 100 elements.');
  }
  if (batch.slide?.width !== undefined) requireFinite(batch.slide.width, 'slide.width', 1);
  if (batch.slide?.height !== undefined) requireFinite(batch.slide.height, 'slide.height', 1);
  if (
    batch.slide?.background?.type === 'asset' &&
    !project.assets[batch.slide.background.assetId]
  ) {
    throw new Error(`Unknown background assetId: ${batch.slide.background.assetId}.`);
  }
  const elementIds = new Set<string>();
  batch.elements.forEach((element) => {
    validateElement(element);
    if (elementIds.has(element.elementId))
      throw new Error(`Duplicate elementId: ${element.elementId}.`);
    elementIds.add(element.elementId);
  });
  const animationOrders = batch.elements.flatMap((element) =>
    (element.animations ?? []).map((animation) => animation.order),
  );
  if (new Set(animationOrders).size !== animationOrders.length) {
    throw new Error('Animation order values must be unique within a batch.');
  }

  const target = resolvePageIndex(project, batch);
  const existingPage = project.pages[target.index];
  const slideId = existingPage?.id ?? 'new-slide';
  const foreignElementIds = new Set(
    project.pages.filter((page) => page.id !== slideId).flatMap((page) => page.elementIds),
  );
  for (const elementId of elementIds) {
    if (foreignElementIds.has(elementId)) {
      throw new Error(`elementId ${elementId} belongs to another slide.`);
    }
  }

  const previousElementIds = existingPage?.elementIds ?? [];
  const deleteIds = new Set(batch.deleteElementIds ?? []);
  if (deleteIds.size !== (batch.deleteElementIds?.length ?? 0)) {
    throw new Error('deleteElementIds cannot contain duplicates.');
  }
  for (const elementId of elementIds) {
    if (deleteIds.has(elementId)) {
      throw new Error(`Cannot upsert and delete ${elementId} in the same batch.`);
    }
  }
  for (const elementId of deleteIds) {
    if (!previousElementIds.includes(elementId)) {
      throw new Error(`Cannot delete ${elementId}; it does not belong to the target slide.`);
    }
  }
}

export const slideUpsertService = { apply, validate };
