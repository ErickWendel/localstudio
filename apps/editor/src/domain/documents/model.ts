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

export const shapeLineDashValues = [
  'dash',
  'dashDot',
  'dot',
  'lgDash',
  'lgDashDot',
  'lgDashDotDot',
  'solid',
  'sysDash',
  'sysDashDot',
  'sysDashDotDot',
  'sysDot',
] as const;

export type ShapeLineDash = (typeof shapeLineDashValues)[number];

export type ConnectorPreset =
  | 'straightConnector1'
  | `bentConnector${2 | 3 | 4 | 5}`
  | `curvedConnector${2 | 3 | 4 | 5}`;

export interface ShapePath {
  kind: 'bezier' | 'polyline';
  points: number[];
}

export interface ProjectDocument {
  id: string;
  name: string;
  pages: Page[];
  assets: Record<string, Asset>;
  fonts?: Record<string, ProjectFont>;
  recordings?: Record<string, TranscriptRecording>;
  elements: Record<string, DesignElement>;
  themes?: Record<string, PresentationTheme>;
  themeId?: string;
  themeGallery?: string[];
  slideLayouts?: Record<string, SlideLayout>;
  pageSizePoints?: { height: number; width: number };
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
  layoutId?: string;
  speakerNotes?: string;
  semanticDescription?: SemanticSlideDescription;
  visible?: boolean;
}

export interface SemanticSlideDescription {
  text: string;
  language: string;
  generatedAt: string;
  generator: string;
  sourceRevision: string;
  reviewed: boolean;
  stale: boolean;
}

export type PageBackground =
  | { type: 'color'; color: string }
  | { type: 'asset'; assetId: string; colorFallback: string };

export type AnimationEffect =
  | 'blinds'
  | 'clothesline'
  | 'color-planes'
  | 'confetti'
  | 'cube'
  | 'doorway'
  | 'dissolve'
  | 'drop'
  | 'droplet'
  | 'fade'
  | 'fade-and-move'
  | 'fade-through-color'
  | 'fall'
  | 'flip'
  | 'flop'
  | 'grid'
  | 'iris'
  | 'keyboard-typing'
  | 'line-draw'
  | 'mosaic'
  | 'move-in'
  | 'page-flip'
  | 'pivot'
  | 'push'
  | 'radial-wipe'
  | 'reflection'
  | 'reveal'
  | 'revolving-door'
  | 'scale'
  | 'swap'
  | 'switch'
  | 'swoosh'
  | 'twirl'
  | 'twist'
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
  order?: number;
  lineDrawDirection?: AnimationLineDrawDirection;
  mediaAction?: 'play';
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
  source: 'google-fonts' | 'uploaded';
  requestedFamily: string;
  fontStyle: 'normal' | 'italic';
  fontWeight: number;
  mimeType: 'font/woff2' | 'font/woff' | 'font/ttf' | 'font/otf';
  fileName: string;
  storage: 'inline' | 'file' | 'remote';
  objectUrl?: string;
  sourceUrl?: string;
}

export interface TranscriptRecording {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  durationMs: number;
  language?: string;
  modelPresetId: string;
  audio: TranscriptRecordingAudio;
  segments: TranscriptSegment[];
}

export interface TranscriptRecordingAudio {
  mimeType: string;
  fileName?: string;
  objectUrl?: string;
  storage?: 'file' | 'inline' | 'remote';
  publicShareAuthorized?: boolean;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  pageId?: string;
  pageIndex?: number;
  pageName?: string;
  final: boolean;
}

export type DesignElement = TextElement | ImageElement | GifElement | VideoElement | ShapeElement;

export type ElementTemplateSource = { layoutId: string; type: 'layout' };
export type ElementImportSource = {
  format: 'pptx';
  pageId: string;
  shapeId: string;
  source: 'layout' | 'master' | 'slide';
  layoutId?: string;
  placeholderIndex?: string;
  placeholderRole?: PlaceholderRole;
};
export type PlaceholderRole = 'body' | 'footer' | 'slideNumber' | 'title';

export interface PresentationTheme {
  id: string;
  name: string;
  palette: ThemePalette;
  typography: ThemeTypography;
  preview?: ThemePreview;
}

export interface ThemePalette {
  accent: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
}

export interface ThemeTypography {
  bodyFontFamily: string;
  headingFontFamily: string;
}

export interface ThemePreview {
  background: string;
  foreground: string;
}

export interface SlideLayout {
  id: string;
  name: string;
  background: PageBackground;
  elementIds: string[];
  elements: Record<string, DesignElement>;
  placeholderRoles: PlaceholderRole[];
  placeholderVisibility: Record<PlaceholderRole, boolean>;
  thumbnail?: ThemePreview;
}

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
  templateSource?: ElementTemplateSource;
  placeholderRole?: PlaceholderRole;
  importSource?: ElementImportSource;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fill: string;
  highlight?: string;
  stroke?: string;
  strokeWidth?: number;
  align: 'left' | 'center' | 'right';
  hyperlink?: string;
  lineHeight?: number;
  paragraphs?: TextParagraph[];
  verticalAlign?: 'bottom' | 'middle' | 'top';
  verticalOverflow?: 'clip' | 'overflow';
}

export interface TextParagraph {
  align: 'left' | 'center' | 'right';
  fill: string;
  fontFamily: string;
  fontSize: number;
  fontStyle: 'italic' | 'normal';
  fontWeight: number;
  highlight?: string;
  indent: number;
  lineHeight: number;
  marginLeft: number;
  runs?: TextRun[];
  spaceAfter: number;
  spaceBefore: number;
  text: string;
  textDecoration?: 'line-through' | 'underline';
}

export interface TextRun {
  fill: string;
  fontFamily: string;
  fontSize: number;
  fontStyle: 'italic' | 'normal';
  fontWeight: number;
  highlight?: string;
  text: string;
  textDecoration?: 'line-through' | 'underline';
}

export interface ImageElement extends BaseElement {
  type: 'image';
  assetId: string;
  crop?: CropRect;
  flipX?: boolean;
  mask?: 'ellipse';
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
  lineDash?: ShapeLineDash;
  startEndpoint?: ShapeLineEndpoint;
  endEndpoint?: ShapeLineEndpoint;
  path?: ShapePath;
  connectorPreset?: ConnectorPreset;
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
  target?: 'elements' | 'presentation' | 'slide';
}
