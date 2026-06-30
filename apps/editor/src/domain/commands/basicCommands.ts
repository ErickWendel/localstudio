import type {
  Asset,
  BaseElement,
  DesignElement,
  GifElement,
  ImageElement,
  Page,
  PageBackground,
  ProjectDocument,
  VideoElement,
} from '../model';
import { collectReferencedAssetIds } from '../assetUsage';
import type { EditorCommand } from './types';

export {
  AddGeneratedSlideElementCommand,
  PrepareGeneratedSlideCommand,
} from './applyGeneratedSlideCommand';

export type AlignMode = 'horizontal-center' | 'vertical-center' | 'page-center';
export type ZOrderMode = 'front' | 'back' | 'forward' | 'backward';
export type ElementFramePatch = Partial<Pick<BaseElement, 'height' | 'rotation' | 'width' | 'x' | 'y'>>;
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
  fill: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  opacity: number;
  stroke: string;
  strokeWidth: number;
}>;

interface TextTranslationPatch {
  fontSize?: number;
  height?: number;
  width?: number;
  x?: number;
  text: string;
}

type TextTranslationValue = string | TextTranslationPatch;

export class RemoveAssetCommand implements EditorCommand {
  readonly description = 'Remove asset';

  constructor(private readonly assetId: string) {}

  execute(project: ProjectDocument): ProjectDocument {
    if (!project.assets[this.assetId] || collectReferencedAssetIds(project).has(this.assetId)) return project;

    const { [this.assetId]: removedAsset, ...assets } = project.assets;
    void removedAsset;
    return {
      ...project,
      assets,
      updatedAt: new Date().toISOString(),
    };
  }
}

export class AlignElementCommand implements EditorCommand {
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

export class SetZOrderCommand implements EditorCommand {
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

export class DuplicateElementCommand implements EditorCommand {
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
      updatedAt: new Date().toISOString(),
    };
  }
}

export class DeleteElementCommand implements EditorCommand {
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
          ? { ...page, elementIds: page.elementIds.filter((id) => id !== this.elementId) }
          : page,
      ),
    };
  }
}

export class DuplicatePageCommand implements EditorCommand {
  readonly description = 'Duplicate page';

  constructor(
    private readonly pageId: string,
    private readonly nextPageId: string,
    private readonly createElementId: (elementId: string) => string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const page = project.pages.find((item) => item.id === this.pageId);
    if (!page) return project;

    const elementIdPairs = page.elementIds.map((elementId) => [elementId, this.createElementId(elementId)] as const);
    const elementIdMap = new Map(elementIdPairs);
    const duplicatedElements = Object.fromEntries(
      elementIdPairs
        .map(([sourceElementId, nextElementId]) => {
          const element = project.elements[sourceElementId];
          return element ? [nextElementId, { ...element, id: nextElementId, locked: false }] : undefined;
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
      updatedAt: new Date().toISOString(),
    };
  }
}

export class DeletePageCommand implements EditorCommand {
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
      updatedAt: new Date().toISOString(),
    };
  }
}

export class ReorderPageCommand implements EditorCommand {
  readonly description = 'Reorder page';

  constructor(
    private readonly pageId: string,
    private readonly targetIndex: number,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const currentIndex = project.pages.findIndex((page) => page.id === this.pageId);
    if (currentIndex < 0) return project;
    const pages = project.pages.filter((page) => page.id !== this.pageId);
    pages.splice(Math.max(0, Math.min(this.targetIndex, pages.length)), 0, project.pages[currentIndex]!);
    return {
      ...project,
      pages,
      updatedAt: new Date().toISOString(),
    };
  }
}

export class RenamePageCommand implements EditorCommand {
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
      pages: project.pages.map((page) => (page.id === this.pageId ? { ...page, name: nextName } : page)),
      updatedAt: new Date().toISOString(),
    };
  }
}

export class SetPageVisibilityCommand implements EditorCommand {
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
      updatedAt: new Date().toISOString(),
    };
  }
}

export class ReorderElementCommand implements EditorCommand {
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
      updatedAt: new Date().toISOString(),
    };
  }
}

export class SetElementVisibilityCommand implements EditorCommand {
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
      updatedAt: new Date().toISOString(),
    };
  }
}

export class SetElementLockCommand implements EditorCommand {
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
      updatedAt: new Date().toISOString(),
    };
  }
}

export class AddImageElementCommand implements EditorCommand {
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
      updatedAt: new Date().toISOString(),
    };
  }
}

export class AddMediaElementCommand implements EditorCommand {
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
      updatedAt: new Date().toISOString(),
    };
  }
}

export class UpdateMediaPlaybackCommand implements EditorCommand {
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
      updatedAt: new Date().toISOString(),
    };
  }
}

export class ReplaceImageAssetCommand implements EditorCommand {
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
      updatedAt: new Date().toISOString(),
    };
  }
}

export class AddElementsCommand implements EditorCommand {
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
          ? { ...page, elementIds: [...page.elementIds, ...this.elements.map((element) => element.id)] }
          : page,
      ),
      updatedAt: new Date().toISOString(),
    };
  }
}

export class UpdateElementFrameCommand implements EditorCommand {
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
      updatedAt: new Date().toISOString(),
    };
  }
}

export class UpdateElementFramesCommand implements EditorCommand {
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
      updatedAt: new Date().toISOString(),
    };
  }
}

export class UpdateTextContentCommand implements EditorCommand {
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
      updatedAt: new Date().toISOString(),
    };
  }
}

export class UpdateElementStyleCommand implements EditorCommand {
  readonly description = 'Update element style';

  constructor(
    private readonly elementId: string,
    private readonly patch: ElementStylePatch,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element || element.locked) return project;

    const opacity =
      this.patch.opacity === undefined ? element.opacity : Math.max(0, Math.min(1, this.patch.opacity));
    let nextElement: DesignElement = { ...element, opacity };

    if (element.type === 'text') {
      nextElement = {
        ...nextElement,
        ...(this.patch.align ? { align: this.patch.align } : {}),
        ...(this.patch.fill ? { fill: this.patch.fill } : {}),
        ...(this.patch.fontFamily ? { fontFamily: this.patch.fontFamily } : {}),
        ...(this.patch.fontSize !== undefined ? { fontSize: Math.max(1, this.patch.fontSize) } : {}),
        ...(this.patch.fontWeight !== undefined ? { fontWeight: this.patch.fontWeight } : {}),
      };
    }

    if (element.type === 'shape') {
      nextElement = {
        ...nextElement,
        ...(this.patch.fill ? { fill: this.patch.fill } : {}),
        ...(this.patch.stroke ? { stroke: this.patch.stroke } : {}),
        ...(this.patch.strokeWidth !== undefined ? { strokeWidth: Math.max(0, this.patch.strokeWidth) } : {}),
      };
    }

    return {
      ...project,
      elements: {
        ...project.elements,
        [this.elementId]: nextElement,
      },
      updatedAt: new Date().toISOString(),
    };
  }
}

export class ToggleImageFlipCommand implements EditorCommand {
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
      updatedAt: new Date().toISOString(),
    };
  }
}

export class UpdateImageCropCommand implements EditorCommand {
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
      updatedAt: new Date().toISOString(),
    };
  }
}

export class UpdatePageBackgroundCommand implements EditorCommand {
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
      updatedAt: new Date().toISOString(),
    };
  }
}

export class TranslateTextElementsCommand implements EditorCommand {
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
      updatedAt: new Date().toISOString(),
    };
  }
}
