import type {
  Asset,
  BaseElement,
  DesignElement,
  ElementAnimationBuild,
  GifElement,
  ImageElement,
  Page,
  PageBackground,
  ProjectDocument,
  ShapeElement,
  SlideTransition,
  VideoElement,
} from '../../documents/model';
import { collectReferencedAssetIds } from '../../assets/assetUsage';
import { projectMutationUtils } from '../shared/projectMutationUtils';
import type { EditorCommand } from '../shared/types';

import { applyGeneratedSlideCommand } from '../generated-slides/applyGeneratedSlideCommand';

export type AlignMode = 'horizontal-center' | 'vertical-center' | 'page-center';
export type ZOrderMode = 'front' | 'back' | 'forward' | 'backward';
export type ElementFramePatch = Partial<
  Pick<BaseElement, 'height' | 'rotation' | 'width' | 'x' | 'y'>
>;
export type ImageCropPatch = ElementFramePatch & { crop: NonNullable<ImageElement['crop']> };
export type GifPlaybackPatch = Partial<Pick<GifElement, 'playing'>>;
export type VideoPlaybackPatch = Partial<
  Pick<VideoElement, 'autoplayInPreview' | 'controls' | 'loop' | 'muted' | 'trimStartSeconds'>
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

function getPageAnimationBuilds(page: Page) {
  return page.animationBuilds ?? [];
}

function removeElementAnimationBuilds(page: Page, elementIds: Set<string>): Page {
  if (!page.animationBuilds) return page;
  return {
    ...page,
    animationBuilds: page.animationBuilds.filter((build) => !elementIds.has(build.elementId)),
  };
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

class DuplicatePageCommand implements EditorCommand {
  readonly description = 'Duplicate page';

  constructor(
    private readonly pageId: string,
    private readonly nextPageId: string,
    private readonly createElementId: (elementId: string) => string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const page = project.pages.find((item) => item.id === this.pageId);
    if (!page) return project;

    const elementIdPairs = page.elementIds.map(
      (elementId) => [elementId, this.createElementId(elementId)] as const,
    );
    const elementIdMap = new Map(elementIdPairs);
    const duplicatedElements = Object.fromEntries(
      elementIdPairs
        .map(([sourceElementId, nextElementId]) => {
          const element = project.elements[sourceElementId];
          return element
            ? [nextElementId, { ...element, id: nextElementId, locked: false }]
            : undefined;
        })
        .filter((entry): entry is [string, DesignElement] => Boolean(entry)),
    );
    const pageIndex = project.pages.indexOf(page);
    const duplicatedPage: Page = {
      ...page,
      id: this.nextPageId,
      name: `${page.name} copy`,
      elementIds: page.elementIds
        .map((elementId) => elementIdMap.get(elementId))
        .filter((elementId): elementId is string => Boolean(elementId)),
      animationBuilds: getPageAnimationBuilds(page)
        .map((build) => {
          const nextElementId = elementIdMap.get(build.elementId);
          return nextElementId
            ? {
                ...build,
                id: this.createElementId(build.id),
                elementId: nextElementId,
              }
            : undefined;
        })
        .filter((build): build is ElementAnimationBuild => Boolean(build)),
      visible: page.visible ?? true,
    };
    const pages = [...project.pages];
    pages.splice(pageIndex + 1, 0, duplicatedPage);

    return {
      ...project,
      elements: {
        ...project.elements,
        ...duplicatedElements,
      },
      pages,
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class DeletePageCommand implements EditorCommand {
  readonly description = 'Delete page';

  constructor(private readonly pageId: string) {}

  execute(project: ProjectDocument): ProjectDocument {
    if (project.pages.length <= 1) return project;
    const page = project.pages.find((item) => item.id === this.pageId);
    if (!page) return project;
    const deletedElementIds = new Set(page.elementIds);
    const elements = Object.fromEntries(
      Object.entries(project.elements).filter(([elementId]) => !deletedElementIds.has(elementId)),
    );
    return {
      ...project,
      elements,
      pages: project.pages.filter((item) => item.id !== this.pageId),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class ReorderPageCommand implements EditorCommand {
  readonly description = 'Reorder page';

  constructor(
    private readonly pageId: string,
    private readonly targetIndex: number,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const currentIndex = project.pages.findIndex((page) => page.id === this.pageId);
    if (currentIndex < 0) return project;
    const pages = project.pages.filter((page) => page.id !== this.pageId);
    pages.splice(
      Math.max(0, Math.min(this.targetIndex, pages.length)),
      0,
      project.pages[currentIndex]!,
    );
    return {
      ...project,
      pages,
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class RenamePageCommand implements EditorCommand {
  readonly description = 'Rename page';

  constructor(
    private readonly pageId: string,
    private readonly name: string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const nextName = this.name.trim();
    if (!nextName) return project;
    return {
      ...project,
      pages: project.pages.map((page) =>
        page.id === this.pageId ? { ...page, name: nextName } : page,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class SetPageVisibilityCommand implements EditorCommand {
  readonly description = 'Set page visibility';

  constructor(
    private readonly pageId: string,
    private readonly visible: boolean,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      pages: project.pages.map((page) =>
        page.id === this.pageId ? { ...page, visible: this.visible } : page,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
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

class UpdatePageBackgroundCommand implements EditorCommand {
  readonly description = 'Update page background';

  constructor(
    private readonly pageId: string,
    private readonly background: PageBackground,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      pages: project.pages.map((page) =>
        page.id === this.pageId ? { ...page, background: this.background } : page,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class SetPageTransitionCommand implements EditorCommand {
  readonly description = 'Set page transition';

  constructor(
    private readonly pageId: string,
    private readonly transition: SlideTransition,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      pages: project.pages.map((page) =>
        page.id === this.pageId
          ? {
              ...page,
              transition: { ...this.transition, delayMs: Math.max(0, this.transition.delayMs) },
            }
          : page,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class ClearPageTransitionCommand implements EditorCommand {
  readonly description = 'Clear page transition';

  constructor(private readonly pageId: string) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      pages: project.pages.map((page) => {
        if (page.id !== this.pageId) return page;
        const { transition, ...nextPage } = page;
        void transition;
        return nextPage;
      }),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class SetElementAnimationBuildsCommand implements EditorCommand {
  readonly description = 'Set element animation builds';

  constructor(
    private readonly pageId: string,
    private readonly elementIds: string[],
    private readonly createBuildId: (elementId: string) => string,
    private readonly patch: ElementAnimationPatch,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const selectedIds = new Set(this.elementIds);

    return {
      ...project,
      pages: project.pages.map((page) => {
        if (page.id !== this.pageId) return page;
        const pageElementIds = new Set(page.elementIds);
        const orderedSelectedIds = page.elementIds.filter((elementId) =>
          selectedIds.has(elementId),
        );
        if (orderedSelectedIds.length === 0) return page;
        const existingByElementId = new Map(
          getPageAnimationBuilds(page).map((build) => [build.elementId, build]),
        );
        const retainedBuilds = getPageAnimationBuilds(page).filter(
          (build) => !selectedIds.has(build.elementId) && pageElementIds.has(build.elementId),
        );
        const nextBuilds = orderedSelectedIds.map((elementId) => {
          const existing = existingByElementId.get(elementId);
          return {
            id: existing?.id ?? this.createBuildId(elementId),
            elementId,
            effect: this.patch.effect,
            trigger: this.patch.trigger,
            delayMs: Math.max(0, this.patch.delayMs),
            ...(this.patch.direction ? { direction: this.patch.direction } : {}),
            ...(this.patch.durationMs !== undefined
              ? { durationMs: Math.max(0, this.patch.durationMs) }
              : {}),
            ...(this.patch.kind ? { kind: this.patch.kind } : {}),
            ...(this.patch.lineDrawDirection
              ? { lineDrawDirection: this.patch.lineDrawDirection }
              : {}),
          };
        });
        return { ...page, animationBuilds: [...retainedBuilds, ...nextBuilds] };
      }),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class ClearElementAnimationBuildCommand implements EditorCommand {
  readonly description = 'Clear element animation build';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      pages: project.pages.map((page) =>
        page.id === this.pageId
          ? removeElementAnimationBuilds(page, new Set([this.elementId]))
          : page,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class ReorderElementAnimationBuildCommand implements EditorCommand {
  readonly description = 'Reorder element animation build';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
    private readonly targetIndex: number,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      pages: project.pages.map((page) => {
        if (page.id !== this.pageId) return page;
        const builds = getPageAnimationBuilds(page);
        const currentIndex = builds.findIndex((build) => build.elementId === this.elementId);
        if (currentIndex < 0) return page;
        const nextBuilds = builds.filter((build) => build.elementId !== this.elementId);
        nextBuilds.splice(
          Math.max(0, Math.min(this.targetIndex, nextBuilds.length)),
          0,
          builds[currentIndex]!,
        );
        return { ...page, animationBuilds: nextBuilds };
      }),
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

export const basicCommands = {
  AddGeneratedSlideElementCommand: applyGeneratedSlideCommand.AddGeneratedSlideElementCommand,
  PrepareGeneratedSlideCommand: applyGeneratedSlideCommand.PrepareGeneratedSlideCommand,
  RemoveAssetCommand,
  AlignElementCommand,
  SetZOrderCommand,
  DuplicateElementCommand,
  DeleteElementCommand,
  DuplicatePageCommand,
  DeletePageCommand,
  ReorderPageCommand,
  RenamePageCommand,
  SetPageVisibilityCommand,
  ReorderElementCommand,
  SetElementVisibilityCommand,
  SetElementLockCommand,
  AddImageElementCommand,
  AddMediaElementCommand,
  UpdateMediaPlaybackCommand,
  ReplaceImageAssetCommand,
  AddElementsCommand,
  UpdateElementFrameCommand,
  UpdateElementFramesCommand,
  UpdateTextContentCommand,
  UpdateElementStyleCommand,
  ToggleImageFlipCommand,
  UpdateImageCropCommand,
  UpdatePageBackgroundCommand,
  SetPageTransitionCommand,
  ClearPageTransitionCommand,
  SetElementAnimationBuildsCommand,
  ClearElementAnimationBuildCommand,
  ReorderElementAnimationBuildCommand,
  TranslateTextElementsCommand,
};
