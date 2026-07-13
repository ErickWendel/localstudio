import type {
  AnimationEffect,
  AnimationTrigger,
  CropRect,
  ElementAnimationBuild,
  ImportWarning,
  PlaceholderRole,
  ShapeKind,
  ShapeLineEndpoint,
} from '../../../domain/documents/model';
import type { PptxPackage } from './pptxPackage';

export interface PptxRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface PptxTransform extends PptxRect {
  childOffsetX?: number;
  childOffsetY?: number;
  flipX?: boolean;
  rotation: number;
  scaleX?: number;
  scaleY?: number;
}

export interface PptxTextStyle {
  align: 'left' | 'center' | 'right';
  capitalization?: 'all';
  fill: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  verticalAlign: 'bottom' | 'middle' | 'top';
}

export interface PptxTextInsets {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface PptxTextBox {
  autoFit: 'none' | 'shrink-text';
  insets: PptxTextInsets;
  verticalAlign: 'bottom' | 'middle' | 'top';
}

export type PptxSlideObject =
  | {
      frame: PptxRect;
      frameSource?: 'inherited' | 'self';
      id: string;
      kind: 'text';
      opacity?: number;
      placeholderIndex?: string;
      placeholderRole?: PlaceholderRole;
      rotation?: number;
      source: 'layout' | 'master' | 'slide';
      sourceShapeId: string;
      style: PptxTextStyle;
      text: string;
      textBox: PptxTextBox;
      zIndex: number;
    }
  | {
      assetPath: string;
      crop?: CropRect;
      frame: PptxRect;
      frameSource?: 'inherited' | 'self';
      id: string;
      kind: 'image' | 'gif' | 'video';
      opacity?: number;
      placeholderIndex?: string;
      placeholderOnly?: boolean;
      placeholderRole?: PlaceholderRole;
      rotation?: number;
      source: 'layout' | 'master' | 'slide';
      startTrigger?: AnimationTrigger;
      sourceShapeId: string;
      zIndex: number;
    }
  | {
      endEndpoint?: ShapeLineEndpoint;
      fill?: string;
      frame: PptxRect;
      id: string;
      kind: 'shape';
      opacity?: number;
      placeholderIndex?: string;
      placeholderRole?: PlaceholderRole;
      rotation?: number;
      shape: ShapeKind;
      source: 'layout' | 'master' | 'slide';
      sourceShapeId: string;
      startEndpoint?: ShapeLineEndpoint;
      stroke?: string;
      strokeWidth?: number;
      zIndex: number;
    };

export interface PptxSlide {
  backgroundColor: string;
  id: string;
  layoutId?: string;
  layoutName?: string;
  layoutObjects: PptxSlideObject[];
  name: string;
  animationBuilds: ElementAnimationBuild[];
  objects: PptxSlideObject[];
  placeholderRoles: PlaceholderRole[];
  speakerNotes?: string;
  transitionEffect: AnimationEffect;
  visible: boolean;
}

export interface PptxLayout {
  backgroundColor: string;
  id: string;
  name: string;
  objects: PptxSlideObject[];
  placeholderRoles: PlaceholderRole[];
  sourcePath: string;
}

export interface PptxDeck {
  height: number;
  layouts: PptxLayout[];
  name: string;
  slides: PptxSlide[];
  warnings: ImportWarning[];
  width: number;
}

export interface PptxTextDefaults {
  bodyParagraphProperties: Element | undefined;
  bodyRunProperties: Element | undefined;
  defaultParagraphProperties: Element | undefined;
  defaultRunProperties: Element | undefined;
  listParagraphProperties: Element | undefined;
  listRunProperties: Element | undefined;
  titleParagraphProperties: Element | undefined;
  titleRunProperties: Element | undefined;
}

export interface PptxTheme {
  colors: Map<string, string>;
}

export interface ParseContext {
  package: PptxPackage;
  themeCache: Map<string, PptxTheme>;
}

export interface ParseScope {
  groupTransform?: PptxTransform;
  theme: PptxTheme | undefined;
}

export const pptxParserDefaults = {
  pageHeight: 1080,
  pageWidth: 1920,
  textInsetsEmu: {
    bottom: 45720,
    left: 91440,
    right: 91440,
    top: 45720,
  },
  textStyle: {
    align: 'left',
    fill: '#ffffff',
    fontFamily: 'Open Sans',
    fontSize: 32,
    fontWeight: 400,
    lineHeight: 1.05,
    verticalAlign: 'top',
  } satisfies PptxTextStyle,
} as const;
