import type {
  Asset,
  BaseElement,
  DesignElement,
  ElementAnimationBuild,
  GifElement,
  ImageElement,
  ProjectDocument,
  ShapeElement,
  PresentationTheme,
  VideoElement,
} from '../../documents/model';
import { collectReferencedAssetIds } from '../../assets/assetUsage';
import { projectMutationUtils } from '../shared/projectMutationUtils';
import type { EditorCommand } from '../shared/types';

import { applyGeneratedSlideCommand } from '../generated-slides/applyGeneratedSlideCommand';
import { elementAnimationCommands } from './element-animation-commands';
import { mediaElementCommands } from './media-element-commands';
import { pageCommands } from './page-commands';
import { slideLayoutCommands } from './slide-layout-commands';

const {
  removeElementAnimationBuilds,
  ...elementAnimationCommandConstructors
} = elementAnimationCommands;

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

interface TextTranslationPatch {
  fontSize?: number;
  height?: number;
  width?: number;
  x?: number;
  text: string;
}

type TextTranslationValue = string | TextTranslationPatch;

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

class AlignElementCommand implements EditorCommand {
  readonly description = 'Align element';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
    private readonly mode: AlignMode,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const page = project.pages.find((item) => item.id === this.pageId);
    const element = project.elements[this.elementId];
    if (!page || !element || element.locked) return project;

    const patch = {
      x:
        this.mode === 'horizontal-center' || this.mode === 'page-center'
          ? (page.width - element.width) / 2
          : element.x,
      y:
        this.mode === 'vertical-center' || this.mode === 'page-center'
          ? (page.height - element.height) / 2
          : element.y,
    };

    return {
      ...project,
      elements: {
        ...project.elements,
        [this.elementId]: { ...element, ...patch },
      },
    };
  }
}

class SetZOrderCommand implements EditorCommand {
  readonly description = 'Set z-order';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
    private readonly mode: ZOrderMode,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      pages: project.pages.map((page) => {
        if (page.id !== this.pageId || !page.elementIds.includes(this.elementId)) return page;
        const without = page.elementIds.filter((id) => id !== this.elementId);
        const currentIndex = page.elementIds.indexOf(this.elementId);

        if (this.mode === 'front') return { ...page, elementIds: [...without, this.elementId] };
        if (this.mode === 'back') return { ...page, elementIds: [this.elementId, ...without] };

        const targetIndex =
          this.mode === 'forward'
            ? Math.min(currentIndex + 1, page.elementIds.length - 1)
            : Math.max(currentIndex - 1, 0);
        const next = [...without];
        next.splice(targetIndex, 0, this.elementId);
        return { ...page, elementIds: next };
      }),
    };
  }
}

class DuplicateElementCommand implements EditorCommand {
  readonly description = 'Duplicate element';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
    private readonly nextElementId: string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    const page = project.pages.find((item) => item.id === this.pageId);
    if (!element || !page || element.locked) return project;

    const nextElement: DesignElement = {
      ...element,
      id: this.nextElementId,
      x: element.x + 24,
      y: element.y + 24,
      locked: false,
    };

    return {
      ...project,
      elements: {
        ...project.elements,
        [this.nextElementId]: nextElement,
      },
      pages: project.pages.map((item) =>
        item.id === this.pageId
          ? { ...item, elementIds: [...item.elementIds, this.nextElementId] }
          : item,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class DeleteElementCommand implements EditorCommand {
  readonly description = 'Delete element';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const { [this.elementId]: deleted, ...remainingElements } = project.elements;
    void deleted;

    return {
      ...project,
      elements: remainingElements,
      pages: project.pages.map((page) =>
        page.id === this.pageId
          ? removeElementAnimationBuilds(
              { ...page, elementIds: page.elementIds.filter((id) => id !== this.elementId) },
              new Set([this.elementId]),
            )
          : page,
      ),
    };
  }
}

class ReorderElementCommand implements EditorCommand {
  readonly description = 'Reorder element';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
    private readonly targetIndex: number,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      pages: project.pages.map((page) => {
        if (page.id !== this.pageId || !page.elementIds.includes(this.elementId)) return page;
        const without = page.elementIds.filter((id) => id !== this.elementId);
        const next = [...without];
        next.splice(Math.max(0, Math.min(this.targetIndex, next.length)), 0, this.elementId);
        return { ...page, elementIds: next };
      }),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class SetElementVisibilityCommand implements EditorCommand {
  readonly description = 'Set element visibility';

  constructor(
    private readonly elementId: string,
    private readonly visible: boolean,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element) return project;

    return {
      ...project,
      elements: {
        ...project.elements,
        [this.elementId]: { ...element, visible: this.visible },
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class SetElementLockCommand implements EditorCommand {
  readonly description = 'Set element lock';

  constructor(
    private readonly elementId: string,
    private readonly locked: boolean,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element) return project;

    return {
      ...project,
      elements: {
        ...project.elements,
        [this.elementId]: { ...element, locked: this.locked },
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class AddElementsCommand implements EditorCommand {
  readonly description = 'Add elements';

  constructor(
    private readonly pageId: string,
    private readonly elements: DesignElement[],
    private readonly assets: Record<string, Asset> = {},
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    if (this.elements.length === 0) return project;

    return {
      ...project,
      assets: {
        ...project.assets,
        ...this.assets,
      },
      elements: {
        ...project.elements,
        ...Object.fromEntries(this.elements.map((element) => [element.id, element])),
      },
      pages: project.pages.map((page) =>
        page.id === this.pageId
          ? {
              ...page,
              elementIds: [...page.elementIds, ...this.elements.map((element) => element.id)],
            }
          : page,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class UpdateElementFrameCommand implements EditorCommand {
  readonly description = 'Update element frame';

  constructor(
    private readonly elementId: string,
    private readonly patch: ElementFramePatch,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element || element.locked) return project;

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

class UpdateElementFramesCommand implements EditorCommand {
  readonly description = 'Update element frames';

  constructor(private readonly patches: Record<string, ElementFramePatch>) {}

  execute(project: ProjectDocument): ProjectDocument {
    const nextElements = { ...project.elements };
    let didChange = false;

    for (const [elementId, patch] of Object.entries(this.patches)) {
      const element = nextElements[elementId];
      if (!element || element.locked) continue;
      nextElements[elementId] = {
        ...element,
        ...patch,
        width: patch.width === undefined ? element.width : Math.max(1, patch.width),
        height: patch.height === undefined ? element.height : Math.max(1, patch.height),
      };
      didChange = true;
    }

    if (!didChange) return project;

    return {
      ...project,
      elements: nextElements,
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class UpdateTextContentCommand implements EditorCommand {
  readonly description = 'Update text content';

  constructor(
    private readonly elementId: string,
    private readonly text: string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element || element.type !== 'text' || element.locked) return project;

    return {
      ...project,
      elements: {
        ...project.elements,
        [this.elementId]: {
          ...element,
          text: this.text,
        },
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class UpdateElementStyleCommand implements EditorCommand {
  readonly description = 'Update element style';

  constructor(
    private readonly elementId: string,
    private readonly patch: ElementStylePatch,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element || element.locked) return project;

    const opacity =
      this.patch.opacity === undefined
        ? element.opacity
        : Math.max(0, Math.min(1, this.patch.opacity));
    let nextElement: DesignElement = { ...element, opacity };

    if (element.type === 'text') {
      nextElement = {
        ...nextElement,
        ...(this.patch.align ? { align: this.patch.align } : {}),
        ...(typeof this.patch.fill === 'string' ? { fill: this.patch.fill } : {}),
        ...(this.patch.fontFamily ? { fontFamily: this.patch.fontFamily } : {}),
        ...(this.patch.fontSize !== undefined
          ? { fontSize: Math.max(1, this.patch.fontSize) }
          : {}),
        ...(this.patch.fontWeight !== undefined ? { fontWeight: this.patch.fontWeight } : {}),
      };
    }

    if (element.type === 'shape') {
      const { endEndpoint, fill, startEndpoint, stroke, strokeWidth } = this.patch;
      const nextShapeElement = {
        ...nextElement,
        ...(typeof fill === 'string' ? { fill } : {}),
        ...(typeof stroke === 'string' ? { stroke } : {}),
        ...(strokeWidth !== undefined ? { strokeWidth: Math.max(0, strokeWidth) } : {}),
        ...(startEndpoint !== undefined ? { startEndpoint } : {}),
        ...(endEndpoint !== undefined ? { endEndpoint } : {}),
      };
      if (fill === null) {
        delete nextShapeElement.fill;
      }
      if (stroke === null) {
        delete nextShapeElement.stroke;
      }
      nextElement = nextShapeElement;
    }

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

class TranslateTextElementsCommand implements EditorCommand {
  readonly description = 'Translate text elements';

  constructor(private readonly translations: Record<string, TextTranslationValue>) {}

  execute(project: ProjectDocument): ProjectDocument {
    const nextElements = { ...project.elements };
    let didChange = false;

    for (const [elementId, translation] of Object.entries(this.translations)) {
      const element = nextElements[elementId];
      if (!element || element.type !== 'text' || element.locked) continue;
      const patch = typeof translation === 'string' ? { text: translation } : translation;
      if (patch.text === element.text && patch.fontSize === undefined) continue;

      nextElements[elementId] = {
        ...element,
        ...patch,
      };
      didChange = true;
    }

    if (!didChange) return project;

    return {
      ...project,
      elements: nextElements,
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class ApplyThemeCommand implements EditorCommand {
  readonly description = 'Apply theme';

  constructor(private readonly themeId: string) {}

  execute(project: ProjectDocument): ProjectDocument {
    if (!project.themes?.[this.themeId]) return project;
    return {
      ...project,
      themeId: this.themeId,
      themeGallery: Array.from(new Set([...(project.themeGallery ?? []), this.themeId])),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class SaveThemeCommand implements EditorCommand {
  readonly description: string = 'Save theme';

  constructor(private readonly theme: PresentationTheme) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      themes: {
        ...(project.themes ?? {}),
        [this.theme.id]: this.theme,
      },
      themeGallery: Array.from(new Set([...(project.themeGallery ?? []), this.theme.id])),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class EditThemeCommand extends SaveThemeCommand {
  override readonly description: string = 'Edit theme';
}

export const basicCommands = {
  AddGeneratedSlideElementCommand: applyGeneratedSlideCommand.AddGeneratedSlideElementCommand,
  PrepareGeneratedSlideCommand: applyGeneratedSlideCommand.PrepareGeneratedSlideCommand,
  RemoveAssetCommand,
  AlignElementCommand,
  SetZOrderCommand,
  DuplicateElementCommand,
  DeleteElementCommand,
  ...pageCommands,
  ReorderElementCommand,
  SetElementVisibilityCommand,
  SetElementLockCommand,
  ...mediaElementCommands,
  AddElementsCommand,
  UpdateElementFrameCommand,
  UpdateElementFramesCommand,
  UpdateTextContentCommand,
  UpdateElementStyleCommand,
  ...elementAnimationCommandConstructors,
  TranslateTextElementsCommand,
  ApplyThemeCommand,
  SaveThemeCommand,
  EditThemeCommand,
  ...slideLayoutCommands,
};
