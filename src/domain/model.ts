export type ElementType = 'text' | 'image' | 'shape';

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
}

export type PageBackground =
  | { type: 'color'; color: string }
  | { type: 'asset'; assetId: string; colorFallback: string };

export interface Asset {
  id: string;
  type: 'image';
  name: string;
  mimeType: string;
  objectUrl?: string;
}

export type DesignElement = TextElement | ImageElement | ShapeElement;

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
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: 'rect' | 'ellipse';
  fill: string;
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
