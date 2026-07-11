import type {
  BaseElement,
  ElementAnimationBuild,
  GifElement,
  ImageElement,
  ProjectDocument,
  ShapeElement,
  VideoElement,
} from '../../documents/model';
import { collectReferencedAssetIds } from '../../assets/assetUsage';
import { projectMutationUtils } from '../shared/projectMutationUtils';
import type { EditorCommand } from '../shared/types';

import { applyGeneratedSlideCommand } from '../generated-slides/applyGeneratedSlideCommand';
import { elementAnimationCommands } from './element-animation-commands';
import { elementEditCommands } from './element-edit-commands';
import { elementStructureCommands } from './element-structure-commands';
import { mediaElementCommands } from './media-element-commands';
import { pageCommands } from './page-commands';
import { slideLayoutCommands } from './slide-layout-commands';
import { textThemeCommands } from './text-theme-commands';

const elementAnimationCommandConstructors = {
  ClearElementAnimationBuildCommand: elementAnimationCommands.ClearElementAnimationBuildCommand,
  ReorderElementAnimationBuildCommand: elementAnimationCommands.ReorderElementAnimationBuildCommand,
  SetElementAnimationBuildsCommand: elementAnimationCommands.SetElementAnimationBuildsCommand,
};

export type AlignMode = 'horizontal-center' | 'vertical-center' | 'page-center';
export type ZOrderMode = 'front' | 'back' | 'forward' | 'backward';
export type ElementFramePatch = Partial<
  Pick<BaseElement, 'height' | 'rotation' | 'width' | 'x' | 'y'>
>;
export type ImageCropPatch = ElementFramePatch & { crop: NonNullable<ImageElement['crop']> };
export type GifPlaybackPatch = Partial<Pick<GifElement, 'playing'>>;
export type VideoPlaybackPatch = Partial<
  Pick<
    VideoElement,
    | 'autoplayInPreview'
    | 'controls'
    | 'loop'
    | 'muted'
    | 'playAcrossSlides'
    | 'playbackPositionSeconds'
    | 'playing'
    | 'posterFrameSeconds'
    | 'repeatMode'
    | 'startOnClick'
    | 'trimStartSeconds'
    | 'volume'
  >
> & {
  trimEndSeconds?: number | undefined;
};
export type MediaPlaybackPatch = GifPlaybackPatch | VideoPlaybackPatch;
export type ElementStylePatch = Partial<{
  align: 'left' | 'center' | 'right';
  fill: string | null;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  opacity: number;
  stroke: string | null;
  strokeWidth: number;
  startEndpoint: ShapeElement['startEndpoint'];
  endEndpoint: ShapeElement['endEndpoint'];
}>;
export type ElementAnimationPatch = Omit<ElementAnimationBuild, 'elementId' | 'id'>;

class RemoveAssetCommand implements EditorCommand {
  readonly description = 'Remove asset';

  constructor(private readonly assetId: string) {}

  execute(project: ProjectDocument): ProjectDocument {
    if (!project.assets[this.assetId] || collectReferencedAssetIds(project).has(this.assetId))
      return project;

    const { [this.assetId]: removedAsset, ...assets } = project.assets;
    void removedAsset;
    return {
      ...project,
      assets,
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

export const basicCommands = {
  AddGeneratedSlideElementCommand: applyGeneratedSlideCommand.AddGeneratedSlideElementCommand,
  PrepareGeneratedSlideCommand: applyGeneratedSlideCommand.PrepareGeneratedSlideCommand,
  RemoveAssetCommand,
  ...elementStructureCommands,
  ...pageCommands,
  ...mediaElementCommands,
  ...elementEditCommands,
  ...elementAnimationCommandConstructors,
  ...textThemeCommands,
  ...slideLayoutCommands,
};
