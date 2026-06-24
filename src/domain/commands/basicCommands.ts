import type { Asset, BaseElement, ImageElement, ProjectDocument } from '../model';
import type { EditorCommand } from './types';

export type AlignMode = 'horizontal-center' | 'vertical-center' | 'page-center';
export type ZOrderMode = 'front' | 'back' | 'forward' | 'backward';
export type ElementFramePatch = Partial<Pick<BaseElement, 'height' | 'rotation' | 'width' | 'x' | 'y'>>;

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

export class DeleteElementCommand implements EditorCommand {
  readonly description = 'Delete element';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    const { [this.elementId]: deleted, ...remainingElements } = project.elements;
    void deleted;
    const shouldDeleteAsset =
      element?.type === 'image' &&
      !Object.values(remainingElements).some(
        (remainingElement) =>
          remainingElement.type === 'image' && remainingElement.assetId === element.assetId,
      );
    const { [element?.type === 'image' ? element.assetId : '']: deletedAsset, ...remainingAssets } =
      project.assets;
    void deletedAsset;

    return {
      ...project,
      assets: shouldDeleteAsset ? remainingAssets : project.assets,
      elements: remainingElements,
      pages: project.pages.map((page) =>
        page.id === this.pageId
          ? { ...page, elementIds: page.elementIds.filter((id) => id !== this.elementId) }
          : page,
      ),
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
