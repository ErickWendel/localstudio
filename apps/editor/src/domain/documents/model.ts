export type ElementType = 'text' | 'image' | 'gif' | 'video' | 'shape';
export type ShapeKind =
  | 'arc'
  | 'arrow'
  | 'diamond'
  | 'ellipse'
  | 'line'
  | 'parallelogram'
  | 'pentagon'
  | 'rect'
  | 'rounded-rect'
  | 'triangle';
export type ShapeLineEndpoint =
  | 'arrow'
  | 'bar'
  | 'circle'
  | 'diamond'
  | 'none'
  | 'open-arrow'
  | 'open-circle'
  | 'open-square'
  | 'square';

export interface ProjectDocument {
  id: string;
  name: string;
  pages: Page[];
  assets: Record<string, Asset>;
  fonts?: Record<string, ProjectFont>;
  elements: Record<string, DesignElement>;
  createdAt: string;
  updatedAt: string;
  importWarnings?: ImportWarning[];
}

export interface Page {
  id: string;
  name: string;
  width: number;
  height: number;
  background: PageBackground;
  elementIds: string[];
  transition?: SlideTransition;
  animationBuilds?: ElementAnimationBuild[];
  speakerNotes?: string;
  visible?: boolean;
}

export type PageBackground =
  | { type: 'color'; color: string }
  | { type: 'asset'; assetId: string; colorFallback: string };

export type AnimationEffect =
  | 'dissolve'
  | 'fade'
  | 'keyboard-typing'
  | 'line-draw'
  | 'push'
  | 'reveal'
  | 'wipe';
export type AnimationDirection = 'down' | 'left' | 'right' | 'up';
export type AnimationLineDrawDirection = 'start-to-end' | 'end-to-start' | 'middle-to-ends';
export type ElementAnimationKind = 'build-in' | 'build-out' | 'emphasis';
export type AnimationTrigger = 'on-click' | 'after-transition' | 'after-previous';

export interface SlideTransition {
  effect: AnimationEffect;
  delayMs: number;
  direction?: AnimationDirection;
  durationMs?: number;
}

export interface ElementAnimationBuild {
  id: string;
  elementId: string;
  effect: AnimationEffect;
  trigger: AnimationTrigger;
  delayMs: number;
  direction?: AnimationDirection;
  durationMs?: number;
  kind?: ElementAnimationKind;
  lineDrawDirection?: AnimationLineDrawDirection;
}

export interface ImportWarning {
  code: string;
  message: string;
  pageId?: string;
  severity: 'info' | 'warning';
}

export interface Asset {
  id: string;
  type: 'image' | 'gif' | 'video';
  name: string;
  mimeType: string;
  objectUrl?: string;
  fileName?: string;
  storage?: 'inline' | 'file' | 'remote';
}

export interface ProjectFont {
  id: string;
  family: string;
  source: 'google-fonts';
  requestedFamily: string;
  fontStyle: 'normal' | 'italic';
  fontWeight: number;
  mimeType: 'font/woff2';
  fileName: string;
  storage: 'inline' | 'file' | 'remote';
  objectUrl?: string;
  sourceUrl?: string;
}

export type DesignElement = TextElement | ImageElement | GifElement | VideoElement | ShapeElement;

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  visible: boolean;
  opacity: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fill: string;
  align: 'left' | 'center' | 'right';
  lineHeight?: number;
  verticalAlign?: 'bottom' | 'middle' | 'top';
}

export interface ImageElement extends BaseElement {
  type: 'image';
  assetId: string;
  crop?: CropRect;
  flipX?: boolean;
}

export interface GifElement extends BaseElement {
  type: 'gif';
  assetId: string;
  playing: boolean;
}

export type VideoRepeatMode = 'loop' | 'loop-back-and-forth' | 'none';

export interface VideoElement extends BaseElement {
  type: 'video';
  assetId: string;
  loop: boolean;
  controls: boolean;
  muted: boolean;
  autoplayInPreview: boolean;
  playing?: boolean;
  playbackPositionSeconds?: number;
  trimStartSeconds: number;
  trimEndSeconds?: number;
  durationSeconds?: number;
  playAcrossSlides?: boolean;
  posterFrameSeconds?: number;
  repeatMode?: VideoRepeatMode;
  startOnClick?: boolean;
  volume?: number;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: ShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  startEndpoint?: ShapeLineEndpoint;
  endEndpoint?: ShapeLineEndpoint;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionState {
  pageId: string;
  elementIds: string[];
}
