import type Konva from 'konva';
import type { ElementAnimationBuild as ElementAnimationPreviewBuild } from '../../../domain/documents/model';
import type { AnimationPresetRenderState } from '../animation/animationPresetEngine';

export interface CommonElementProps {
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

export interface ElementAnimationRenderState {
  activeBuild: ElementAnimationPreviewBuild | undefined;
  hidden: boolean;
  preset: AnimationPresetRenderState | undefined;
  progress: number;
}
