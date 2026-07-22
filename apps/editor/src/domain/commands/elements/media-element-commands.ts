import type {
  Asset,
  DesignElement,
  GifElement,
  ImageElement,
  ProjectDocument,
  VideoElement,
} from '../../documents/model';
import { projectMutationUtils } from '../shared/projectMutationUtils';
import type { EditorCommand } from '../shared/types';
import type {
  GifPlaybackPatch,
  ImageCropPatch,
  MediaPlaybackPatch,
  VideoPlaybackPatch,
} from './basicCommands';

class AddImageElementCommand implements EditorCommand {
  readonly description = 'Add image element';

  constructor(
    private readonly pageId: string,
    private readonly payload: { asset: Asset; element: ImageElement },
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      assets: {
        ...project.assets,
        [this.payload.asset.id]: this.payload.asset,
      },
      elements: {
        ...project.elements,
        [this.payload.element.id]: this.payload.element,
      },
      pages: project.pages.map((page) =>
        page.id === this.pageId
          ? { ...page, elementIds: [...page.elementIds, this.payload.element.id] }
          : page,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class AddMediaElementCommand implements EditorCommand {
  readonly description = 'Add media element';

  constructor(
    private readonly pageId: string,
    private readonly payload: { asset: Asset; element: GifElement | VideoElement },
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      assets: {
        ...project.assets,
        [this.payload.asset.id]: this.payload.asset,
      },
      elements: {
        ...project.elements,
        [this.payload.element.id]: this.payload.element,
      },
      pages: project.pages.map((page) =>
        page.id === this.pageId
          ? { ...page, elementIds: [...page.elementIds, this.payload.element.id] }
          : page,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class UpdateMediaPlaybackCommand implements EditorCommand {
  readonly description = 'Update media playback';

  constructor(
    private readonly elementId: string,
    private readonly patch: MediaPlaybackPatch,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element || element.locked) return project;
    if (element.type !== 'gif' && element.type !== 'video') return project;
    const nextElement: DesignElement =
      element.type === 'gif'
        ? { ...element, ...(this.patch as GifPlaybackPatch) }
        : (() => {
            const { trimEndSeconds, ...patch } = this.patch as VideoPlaybackPatch;
            const next: VideoElement = { ...element, ...patch };
            if (trimEndSeconds !== undefined) {
              next.trimEndSeconds = trimEndSeconds;
            } else if ('trimEndSeconds' in this.patch) {
              delete next.trimEndSeconds;
            }
            return next;
          })();

    return {
      ...project,
      elements: {
        ...project.elements,
        [this.elementId]: nextElement,
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class ReplaceImageAssetCommand implements EditorCommand {
  readonly description = 'Replace image asset';

  constructor(
    private readonly elementId: string,
    private readonly asset: Asset,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element || element.type !== 'image' || element.locked) return project;

    return {
      ...project,
      assets: {
        ...project.assets,
        [this.asset.id]: this.asset,
      },
      elements: {
        ...project.elements,
        [this.elementId]: {
          ...element,
          assetId: this.asset.id,
        },
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class ReplaceVideoAssetCommand implements EditorCommand {
  readonly description = 'Replace video asset';

  constructor(
    private readonly elementId: string,
    private readonly asset: Asset,
    private readonly metadata: { durationSeconds?: number } = {},
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element || element.type !== 'video' || element.locked) return project;

    const nextElement: VideoElement = {
      ...element,
      assetId: this.asset.id,
      playbackPositionSeconds: 0,
      playing: false,
      trimStartSeconds: 0,
    };
    delete nextElement.durationSeconds;
    delete nextElement.posterFrameSeconds;
    delete nextElement.trimEndSeconds;
    if (this.metadata.durationSeconds !== undefined) {
      nextElement.durationSeconds = this.metadata.durationSeconds;
      nextElement.trimEndSeconds = this.metadata.durationSeconds;
    }

    return {
      ...project,
      assets: {
        ...project.assets,
        [this.asset.id]: this.asset,
      },
      elements: {
        ...project.elements,
        [this.elementId]: nextElement,
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class ReplaceElementWithMediaCommand implements EditorCommand {
  readonly description = 'Replace element with media';

  constructor(
    private readonly elementId: string,
    private readonly payload: { asset: Asset; element: ImageElement | GifElement | VideoElement },
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element || element.locked || this.payload.element.id !== this.elementId) return project;

    return {
      ...project,
      assets: {
        ...project.assets,
        [this.payload.asset.id]: this.payload.asset,
      },
      elements: {
        ...project.elements,
        [this.elementId]: this.payload.element,
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class ToggleImageFlipCommand implements EditorCommand {
  readonly description = 'Flip image';

  constructor(private readonly elementId: string) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element || element.type !== 'image' || element.locked) return project;

    return {
      ...project,
      elements: {
        ...project.elements,
        [this.elementId]: {
          ...element,
          flipX: !element.flipX,
        },
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class UpdateImageCropCommand implements EditorCommand {
  readonly description = 'Crop image';

  constructor(
    private readonly elementId: string,
    private readonly patch: ImageCropPatch,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element || element.type !== 'image' || element.locked) return project;

    return {
      ...project,
      elements: {
        ...project.elements,
        [this.elementId]: {
          ...element,
          ...this.patch,
          width: this.patch.width === undefined ? element.width : Math.max(1, this.patch.width),
          height: this.patch.height === undefined ? element.height : Math.max(1, this.patch.height),
        },
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

export const mediaElementCommands = {
  AddImageElementCommand,
  AddMediaElementCommand,
  ReplaceElementWithMediaCommand,
  ReplaceImageAssetCommand,
  ReplaceVideoAssetCommand,
  ToggleImageFlipCommand,
  UpdateImageCropCommand,
  UpdateMediaPlaybackCommand,
};
