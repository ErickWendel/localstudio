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

export interface ProjectDocument {
  id: string;
  name: string;
  pages: Page[];
  assets: Record<string, Asset>;
  elements: Record<string, DesignElement>;
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  id: string;
  name: string;
  width: number;
  height: number;
  background: PageBackground;
  elementIds: string[];
  visible?: boolean;
}

export type PageBackground =
  | { type: 'color'; color: string }
  | { type: 'asset'; assetId: string; colorFallback: string };

export interface Asset {
  id: string;
  type: 'image' | 'gif' | 'video';
  name: string;
  mimeType: string;
  objectUrl?: string;
  fileName?: string;
  storage?: 'inline' | 'file' | 'remote';
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

export interface VideoElement extends BaseElement {
  type: 'video';
  assetId: string;
  loop: boolean;
  controls: boolean;
  muted: boolean;
  autoplayInPreview: boolean;
  trimStartSeconds: number;
  trimEndSeconds?: number;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: ShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
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
